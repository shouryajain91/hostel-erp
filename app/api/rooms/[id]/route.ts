import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('rooms')
    .select('*, room_types(id, name, capacity, base_rent, amenities)')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const body = await req.json()
  const { room_number, room_type_id, floor, status, notes } = body

  if (!room_number?.trim()) return NextResponse.json({ error: 'Room number is required.' }, { status: 400 })
  if (!room_type_id) return NextResponse.json({ error: 'Room type is required.' }, { status: 400 })

  const { data, error } = await supabase.from('rooms').update({
    room_number: room_number.trim(),
    room_type_id,
    floor: floor ?? 1,
    status,
    notes: notes?.trim() || null,
  }).eq('id', params.id).select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Room number "${room_number}" already exists.` }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const { error } = await supabase.from('rooms').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
