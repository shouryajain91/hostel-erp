import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenancy_end_date } = await req.json()
  if (!tenancy_end_date) return NextResponse.json({ error: 'Tenancy end date is required.' }, { status: 400 })

  const { data: tenant } = await supabase.from('tenants').select('id, name, room_id').eq('id', params.id).single()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  if (profile.role === 'owner') {
    await supabase.from('tenants')
      .update({ status: 'checked_out', tenancy_end_date, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    // Check if any active tenants remain in the room
    const { count } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', tenant.room_id)
      .eq('status', 'active')
      .neq('id', params.id)

    if ((count ?? 0) === 0) {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', tenant.room_id)
    }

    return NextResponse.json({ success: true })
  }

  // Management: create approval request
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      request_type: 'checkout_tenant',
      payload: { tenant_id: params.id, tenant_name: tenant.name, room_id: tenant.room_id, tenancy_end_date },
      requested_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ approval_request: data }, { status: 201 })
}
