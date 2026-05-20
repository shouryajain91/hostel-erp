export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) redirect('/login')

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={profile.role} userName={profile.name} />
      <main className="flex-1 overflow-auto p-4 pt-[4.5rem] lg:p-8 lg:pt-8">{children}</main>
    </div>
  )
}
