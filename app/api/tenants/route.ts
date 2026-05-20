import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('tenants')
    .select('*, rooms(room_number, room_types(name))')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, name').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    name, date_of_birth, gender, mobile, guardian_name, guardian_mobile,
    permanent_address, room_id, booking_date, tenancy_start_date,
    tenancy_end_date, security_deposit, kyc_doc1_name, kyc_doc1_url,
    kyc_doc2_name, kyc_doc2_url,
  } = body

  // Validate required fields
  const required = { name, date_of_birth, gender, mobile, guardian_name, guardian_mobile, permanent_address, room_id, booking_date, tenancy_start_date, security_deposit, kyc_doc1_name, kyc_doc1_url, kyc_doc2_name, kyc_doc2_url }
  for (const [field, val] of Object.entries(required)) {
    if (!val && val !== 0) return NextResponse.json({ error: `${field} is required.` }, { status: 400 })
  }

  // Check room capacity
  const { data: room } = await supabase
    .from('rooms')
    .select('id, room_types(capacity)')
    .eq('id', room_id)
    .single()
  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 400 })

  const { count: activeCount } = await supabase
    .from('tenants')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', room_id)
    .eq('status', 'active')

  const capacity = ((room.room_types as unknown) as { capacity: number })?.capacity ?? 1
  if ((activeCount ?? 0) >= capacity) {
    return NextResponse.json({ error: `Room is at full capacity (${capacity} tenant${capacity > 1 ? 's' : ''}).` }, { status: 409 })
  }

  const tenantData = {
    name: name.trim(), date_of_birth, gender, mobile: mobile.trim(),
    guardian_name: guardian_name.trim(), guardian_mobile: guardian_mobile.trim(),
    permanent_address: permanent_address.trim(), room_id, booking_date,
    tenancy_start_date, tenancy_end_date: tenancy_end_date || null,
    security_deposit: parseFloat(security_deposit),
    kyc_doc1_name: kyc_doc1_name.trim(), kyc_doc1_url,
    kyc_doc2_name: kyc_doc2_name.trim(), kyc_doc2_url,
  }

  if (profile.role === 'owner') {
    const { data, error } = await supabase
      .from('tenants')
      .insert({ ...tenantData, created_by: user.id, approved_by: user.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update room status to occupied if at capacity
    const newCount = (activeCount ?? 0) + 1
    if (newCount >= capacity) {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', room_id)
    } else {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', room_id)
    }

    return NextResponse.json(data, { status: 201 })
  }

  // Management: create approval request
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      request_type: 'add_tenant',
      payload: tenantData,
      requested_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ approval_request: data }, { status: 201 })
}
