import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await req.json()
  const validStatuses = ['draft', 'sent', 'paid', 'cancelled']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data: bill } = await supabase.from('bills').select('status').eq('id', params.id).single()
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

  if (profile.role === 'owner') {
    const { error } = await supabase
      .from('bills')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Management: only paid status requires approval
  if (status === 'paid') {
    const { data, error } = await supabase
      .from('approval_requests')
      .insert({
        request_type: 'mark_bill_paid',
        payload: { bill_id: params.id },
        requested_by: user.id,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ approval_request: data })
  }

  // Management can mark sent
  if (status === 'sent') {
    const { error } = await supabase
      .from('bills')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
}
