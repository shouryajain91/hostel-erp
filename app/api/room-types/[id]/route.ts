import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireOwner(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return profile?.role === 'owner'
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireOwner(supabase, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, description, capacity, amenities, base_rent } = await request.json()

  const { data, error } = await supabase
    .from('room_types')
    .update({
      name: name?.trim(),
      description: description?.trim() || null,
      capacity,
      amenities,
      base_rent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A room type with this name already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Room type not found' }, { status: 404 })

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireOwner(supabase, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('room_types')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
