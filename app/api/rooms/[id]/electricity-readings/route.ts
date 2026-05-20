import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('electricity_readings')
    .select('*, profiles(name)')
    .eq('room_id', params.id)
    .order('reading_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['owner', 'management'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json()
  const { reading_date, units_reading, units_consumed, reading_photo_url, notes } = body

  if (units_reading == null || isNaN(Number(units_reading))) {
    return NextResponse.json({ error: 'Meter reading is required.' }, { status: 400 })
  }

  // Auto-calculate units_consumed if not provided: diff from last reading
  let consumed = units_consumed != null ? Number(units_consumed) : null
  if (consumed == null) {
    const { data: last } = await supabase
      .from('electricity_readings')
      .select('units_reading')
      .eq('room_id', params.id)
      .order('reading_date', { ascending: false })
      .limit(1)
      .single()
    if (last) consumed = Number(units_reading) - Number(last.units_reading)
  }

  const { data, error } = await supabase.from('electricity_readings').insert({
    room_id: params.id,
    reading_date: reading_date ?? new Date().toISOString(),
    units_reading: Number(units_reading),
    units_consumed: consumed,
    reading_photo_url: reading_photo_url ?? null,
    notes: notes?.trim() || null,
    recorded_by: user.id,
  }).select('*, profiles(name)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
