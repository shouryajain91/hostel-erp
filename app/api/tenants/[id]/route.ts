import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('tenants')
    .select('*, rooms(room_number, floor, room_types(name, base_rent))')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data: existing } = await supabase.from('tenants').select('id, name').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  if (profile.role === 'owner') {
    const { data, error } = await supabase
      .from('tenants')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Management: create approval request
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      request_type: 'update_tenant',
      payload: { tenant_id: params.id, ...body },
      requested_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ approval_request: data }, { status: 201 })
}
