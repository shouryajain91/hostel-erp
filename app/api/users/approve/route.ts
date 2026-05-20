import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { phoneToEmail } from '@/lib/utils'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify caller is owner
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { requestId, action, notes } = await request.json()

  if (!requestId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Get the approval request
  const { data: approvalRequest, error: fetchError } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single()

  if (fetchError || !approvalRequest) {
    return NextResponse.json({ error: 'Request not found or already resolved' }, { status: 404 })
  }

  if (action === 'reject') {
    await supabase
      .from('approval_requests')
      .update({ status: 'rejected', notes, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', requestId)

    return NextResponse.json({ success: true })
  }

  // Approve: execute the action
  const admin = createAdminClient()

  if (approvalRequest.request_type === 'create_user') {
    const { name, phone } = approvalRequest.payload as { name: string; phone: string }
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: phoneToEmail(phone),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name, phone, role: 'management' },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Return temp password so owner can share with new staff
    await supabase
      .from('approval_requests')
      .update({
        status: 'approved',
        notes: `Temporary password: ${tempPassword}`,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    return NextResponse.json({ success: true, tempPassword, userId: newUser.user?.id })
  }

  if (approvalRequest.request_type === 'deactivate_user') {
    const { userId } = approvalRequest.payload as { userId: string }

    await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
    await supabase.from('profiles').update({ is_active: false }).eq('id', userId)

    await supabase
      .from('approval_requests')
      .update({ status: 'approved', resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', requestId)

    return NextResponse.json({ success: true })
  }

  if (approvalRequest.request_type === 'add_tenant') {
    const payload = approvalRequest.payload as Record<string, unknown>
    const { data: room } = await supabase
      .from('rooms')
      .select('id, room_types(capacity)')
      .eq('id', payload.room_id as string)
      .single()

    if (room) {
      const { count } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', payload.room_id as string)
        .eq('status', 'active')

      const capacity = ((room.room_types as unknown) as { capacity: number })?.capacity ?? 1
      if ((count ?? 0) >= capacity) {
        return NextResponse.json({ error: `Room is at full capacity (${capacity}).` }, { status: 409 })
      }
    }

    const { error: insertError } = await supabase.from('tenants').insert({
      ...payload,
      security_deposit: parseFloat(String(payload.security_deposit)),
      created_by: approvalRequest.requested_by,
      approved_by: user.id,
    })
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // Mark room occupied
    await supabase.from('rooms').update({ status: 'occupied' }).eq('id', payload.room_id as string)

    await supabase.from('approval_requests')
      .update({ status: 'approved', resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', requestId)

    return NextResponse.json({ success: true })
  }

  if (approvalRequest.request_type === 'update_tenant') {
    const { tenant_id, ...updates } = approvalRequest.payload as Record<string, unknown>
    const { error: updateError } = await supabase.from('tenants')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', tenant_id as string)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    await supabase.from('approval_requests')
      .update({ status: 'approved', resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', requestId)

    return NextResponse.json({ success: true })
  }

  if (approvalRequest.request_type === 'checkout_tenant') {
    const { tenant_id, room_id, tenancy_end_date } = approvalRequest.payload as Record<string, string>

    await supabase.from('tenants')
      .update({ status: 'checked_out', tenancy_end_date, updated_at: new Date().toISOString() })
      .eq('id', tenant_id)

    const { count } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room_id)
      .eq('status', 'active')
      .neq('id', tenant_id)

    if ((count ?? 0) === 0) {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', room_id)
    }

    await supabase.from('approval_requests')
      .update({ status: 'approved', resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', requestId)

    return NextResponse.json({ success: true })
  }

  if (approvalRequest.request_type === 'generate_bill') {
    const payload = approvalRequest.payload as Record<string, unknown>
    const { components, ...billData } = payload
    const componentList = components as Record<string, unknown>[]
    const total_amount = componentList.reduce((sum: number, c) => sum + parseFloat(String(c.amount)), 0)

    const { data: bill, error: billErr } = await admin
      .from('bills')
      .insert({ ...billData, total_amount, created_by: approvalRequest.requested_by, approved_by: user.id, status: 'draft' })
      .select()
      .single()

    if (billErr) return NextResponse.json({ error: billErr.message }, { status: 500 })

    const componentRows = componentList.map(c => ({
      bill_id: bill.id,
      component_type: c.component_type,
      description: c.description || null,
      amount: parseFloat(String(c.amount)),
      units_consumed: c.units_consumed ? parseFloat(String(c.units_consumed)) : null,
      rate_per_unit: c.rate_per_unit ? parseFloat(String(c.rate_per_unit)) : null,
      num_tenants: c.num_tenants ? parseInt(String(c.num_tenants)) : null,
      days: c.days ? parseInt(String(c.days)) : null,
    }))

    const { error: compErr } = await admin.from('bill_components').insert(componentRows)
    if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })

    await supabase.from('approval_requests')
      .update({ status: 'approved', resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', requestId)

    return NextResponse.json({ success: true, billId: bill.id })
  }

  if (approvalRequest.request_type === 'mark_bill_paid') {
    const { bill_id } = approvalRequest.payload as { bill_id: string }

    await admin.from('bills').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', bill_id)

    await supabase.from('approval_requests')
      .update({ status: 'approved', resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', requestId)

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown request type' }, { status: 400 })
}
