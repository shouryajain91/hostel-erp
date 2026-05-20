import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, CheckSquare, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const isOwner = profile?.role === 'owner'

  const { count: pendingCount } = await supabase
    .from('approval_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: usersCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const { count: myRequestsCount } = await supabase
    .from('approval_requests')
    .select('*', { count: 'exact', head: true })
    .eq('requested_by', user.id)
    .eq('status', 'pending')

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-slate-900 mb-1">
        Welcome, {profile?.name}
      </h2>
      <p className="text-slate-500 mb-8 capitalize">{profile?.role} account</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {isOwner && (
          <StatCard
            icon={<CheckSquare className="text-orange-500" size={24} />}
            label="Pending Approvals"
            value={pendingCount ?? 0}
            href="/approvals"
            highlight={Boolean(pendingCount && pendingCount > 0)}
          />
        )}
        <StatCard
          icon={<Users className="text-blue-500" size={24} />}
          label="Active Users"
          value={usersCount ?? 0}
          href="/users"
        />
        {!isOwner && (
          <StatCard
            icon={<Clock className="text-purple-500" size={24} />}
            label="My Pending Requests"
            value={myRequestsCount ?? 0}
            href="/approvals"
          />
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  href,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: number
  href: string
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={`bg-white rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow block ${
        highlight ? 'border-orange-300 bg-orange-50' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        {icon}
        {highlight && (
          <span className="text-xs font-semibold bg-orange-500 text-white px-2 py-0.5 rounded-full">
            Action needed
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </Link>
  )
}
