import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { phoneToEmail } from '@/lib/utils'
import { NextResponse } from 'next/server'

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

  const { name, phone, password } = await request.json()

  if (!name || !phone || !password) {
    return NextResponse.json({ error: 'name, phone, and password are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: newUser, error } = await admin.auth.admin.createUser({
    email: phoneToEmail(phone),
    password,
    email_confirm: true,
    user_metadata: { name, phone, role: 'management' },
  })

  if (error) {
    if (error.message.includes('already')) {
      return NextResponse.json({ error: 'A user with this phone number already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, userId: newUser.user?.id })
}
