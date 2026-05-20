import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('bills')
    .select(`
      *,
      tenants(id, name, mobile, guardian_name, permanent_address, tenancy_start_date),
      rooms(room_number, floor, room_types(name, base_rent)),
      bill_components(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  return NextResponse.json(data)
}
