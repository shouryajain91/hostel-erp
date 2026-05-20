import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, description, capacity, amenities, base_rent } = await request.json()

  if (!name || !capacity || base_rent === undefined || base_rent === null) {
    return NextResponse.json({ error: 'name, capacity, and base_rent are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('room_types')
    .insert({ name: name.trim(), description: description?.trim() || null, capacity, amenities: amenities || [], base_rent })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A room type with this name already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
