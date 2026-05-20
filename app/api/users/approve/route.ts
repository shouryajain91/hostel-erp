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

  return NextResponse.json({ error: 'Unknown request type' }, { status: 400 })
}
