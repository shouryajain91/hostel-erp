import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const tenantId = url.searchParams.get('tenant_id')
  const status = url.searchParams.get('status')

  let query = supabase
    .from('bills')
    .select('*, tenants(id, name, mobile, room_id), rooms(room_number)')
    .order('created_at', { ascending: false })

  if (tenantId) query = query.eq('tenant_id', tenantId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { tenant_id, room_id, bill_type, billing_period_start, billing_period_end, due_date, notes, components } = body

  if (!tenant_id || !room_id || !bill_type || !billing_period_start || !billing_period_end || !components?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const total_amount = components.reduce((sum: number, c: { amount: string | number }) => sum + parseFloat(String(c.amount)), 0)

  const billData = {
    tenant_id, room_id, bill_type, billing_period_start, billing_period_end,
    due_date: due_date || null, notes: notes || null, total_amount,
  }

  if (profile.role === 'owner') {
    const { data: bill, error: billErr } = await supabase
      .from('bills')
      .insert({ ...billData, created_by: user.id, approved_by: user.id, status: 'draft' })
      .select()
      .single()

    if (billErr) return NextResponse.json({ error: billErr.message }, { status: 500 })

    const componentRows = components.map((c: Record<string, unknown>) => ({
      bill_id: bill.id,
      component_type: c.component_type,
      description: c.description || null,
      amount: parseFloat(String(c.amount)),
      units_consumed: c.units_consumed ? parseFloat(String(c.units_consumed)) : null,
      rate_per_unit: c.rate_per_unit ? parseFloat(String(c.rate_per_unit)) : null,
      num_tenants: c.num_tenants ? parseInt(String(c.num_tenants)) : null,
      days: c.days ? parseInt(String(c.days)) : null,
    }))

    const { error: compErr } = await supabase.from('bill_components').insert(componentRows)
    if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })

    return NextResponse.json(bill, { status: 201 })
  }

  // Management: create approval request
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      request_type: 'generate_bill',
      payload: { ...billData, components },
      requested_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ approval_request: data }, { status: 201 })
}
