import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Users, CheckSquare, Clock, BedDouble, IndianRupee,
  AlertCircle, TrendingUp, UserCheck,
} from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single()
  const isOwner = profile?.role === 'owner'

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  const todayStr = today.toISOString().split('T')[0]

  // All queries in parallel
  const [
    { count: pendingCount },
    { count: myRequestsCount },
    { count: activeTenantCount },
    { count: staffCount },
    { data: roomsData },
    { data: outstandingBills },
    { data: paidThisMonth },
    { count: overdueCount },
    { count: totalBillsCount },
  ] = await Promise.all([
    supabase.from('approval_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('approval_requests').select('*', { count: 'exact', head: true }).eq('requested_by', user.id).eq('status', 'pending'),
    supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('rooms').select('status, room_types(capacity)'),
    supabase.from('bills').select('total_amount').eq('status', 'sent'),
    supabase.from('bills').select('total_amount').eq('status', 'paid').gte('updated_at', monthStart),
    supabase.from('bills').select('*', { count: 'exact', head: true }).eq('status', 'sent').not('due_date', 'is', null).lt('due_date', todayStr),
    supabase.from('bills').select('*', { count: 'exact', head: true }).neq('status', 'cancelled'),
  ])

  // Compute occupancy
  const allRooms = roomsData ?? []
  const totalRooms = allRooms.length
  const occupiedRooms = allRooms.filter(r => r.status === 'occupied').length
  const availableRooms = allRooms.filter(r => r.status === 'available').length
  const totalCapacity = allRooms.reduce((sum, r) => {
    const cap = ((r.room_types as unknown) as { capacity: number } | null)?.capacity ?? 0
    return sum + cap
  }, 0)
  const vacantSeats = Math.max(0, totalCapacity - (activeTenantCount ?? 0))
  const occupancyPct = totalCapacity > 0 ? Math.round(((activeTenantCount ?? 0) / totalCapacity) * 100) : 0

  // Compute billing
  const outstanding = (outstandingBills ?? []).reduce((s, b) => s + Number(b.total_amount), 0)
  const collectedThisMonth = (paidThisMonth ?? []).reduce((s, b) => s + Number(b.total_amount), 0)

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Welcome, {profile?.name}</h2>
        <p className="text-slate-500 capitalize mt-0.5">{profile?.role} · {today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Alert row */}
      {((isOwner && (pendingCount ?? 0) > 0) || (overdueCount ?? 0) > 0) && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {isOwner && (pendingCount ?? 0) > 0 && (
            <Link href="/approvals"
              className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 hover:bg-orange-100 transition-colors flex-1">
              <CheckSquare size={18} className="text-orange-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-orange-800">
                {pendingCount} approval{(pendingCount ?? 0) > 1 ? 's' : ''} waiting
              </span>
            </Link>
          )}
          {(overdueCount ?? 0) > 0 && (
            <Link href="/billing?status=sent"
              className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 hover:bg-red-100 transition-colors flex-1">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-red-800">
                {overdueCount} overdue bill{(overdueCount ?? 0) > 1 ? 's' : ''}
              </span>
            </Link>
          )}
        </div>
      )}

      {/* Occupancy section */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Occupancy</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Occupancy rate — span 1 on mobile, visual bar */}
          <div className="sm:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-slate-500">Occupancy Rate</p>
                <p className="text-3xl font-bold text-slate-900 mt-0.5">{occupancyPct}%</p>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p><span className="font-semibold text-slate-800">{activeTenantCount ?? 0}</span> tenants</p>
                <p>of <span className="font-semibold text-slate-800">{totalCapacity}</span> beds</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${occupancyPct >= 90 ? 'bg-red-400' : occupancyPct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${occupancyPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-400">
              <span>{occupiedRooms} rooms occupied</span>
              <span>{availableRooms} rooms available</span>
            </div>
          </div>

          {/* Vacant seats */}
          <Link href="/rooms" className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <BedDouble size={20} className="text-blue-500" />
              <span className="text-xs text-slate-400">{totalRooms} rooms total</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{vacantSeats}</p>
            <p className="text-sm text-slate-500 mt-1">Vacant beds</p>
            <Link href="/tenants" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
              View tenants →
            </Link>
          </Link>
        </div>
      </div>

      {/* Billing section */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Billing</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/billing?status=sent"
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <IndianRupee size={20} className="text-amber-500" />
              <span className="text-xs text-slate-400">{(outstandingBills ?? []).length} bills</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">₹{outstanding.toLocaleString('en-IN')}</p>
            <p className="text-sm text-slate-500 mt-1">Outstanding</p>
          </Link>

          <Link href="/billing?status=paid"
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp size={20} className="text-emerald-500" />
              <span className="text-xs text-slate-400">{today.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">₹{collectedThisMonth.toLocaleString('en-IN')}</p>
            <p className="text-sm text-slate-500 mt-1">Collected this month</p>
          </Link>

          <Link href="/billing"
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <UserCheck size={20} className="text-purple-500" />
              <span className="text-xs text-slate-400">all time</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalBillsCount ?? 0}</p>
            <p className="text-sm text-slate-500 mt-1">Total bills raised</p>
          </Link>
        </div>
      </div>

      {/* People section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">People</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/tenants"
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <UserCheck size={20} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{activeTenantCount ?? 0}</p>
            <p className="text-sm text-slate-500 mt-1">Active tenants</p>
          </Link>

          <Link href="/users"
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <Users size={20} className="text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{staffCount ?? 0}</p>
            <p className="text-sm text-slate-500 mt-1">Staff accounts</p>
          </Link>

          {isOwner ? (
            <Link href="/approvals"
              className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${(pendingCount ?? 0) > 0 ? 'border-orange-200 bg-orange-50' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <CheckSquare size={20} className="text-orange-500" />
                {(pendingCount ?? 0) > 0 && (
                  <span className="text-xs font-semibold bg-orange-500 text-white px-2 py-0.5 rounded-full">Action needed</span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-900">{pendingCount ?? 0}</p>
              <p className="text-sm text-slate-500 mt-1">Pending approvals</p>
            </Link>
          ) : (
            <Link href="/approvals"
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <Clock size={20} className="text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{myRequestsCount ?? 0}</p>
              <p className="text-sm text-slate-500 mt-1">My pending requests</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
