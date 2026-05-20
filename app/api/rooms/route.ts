import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('rooms')
    .select('*, room_types(id, name, capacity, base_rent)')
    .order('room_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const body = await req.json()
  const { room_number, room_type_id, floor, status, notes } = body

  if (!room_number?.trim()) return NextResponse.json({ error: 'Room number is required.' }, { status: 400 })
  if (!room_type_id) return NextResponse.json({ error: 'Room type is required.' }, { status: 400 })

  const { data, error } = await supabase.from('rooms').insert({
    room_number: room_number.trim(),
    room_type_id,
    floor: floor ?? 1,
    status: status ?? 'available',
    notes: notes?.trim() || null,
  }).select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Room number "${room_number}" already exists.` }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
