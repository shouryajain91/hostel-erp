import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import BillingList from './BillingList'

type BillRow = {
  id: string; bill_type: string; billing_period_start: string; billing_period_end: string
  due_date: string | null; status: string; total_amount: number; created_at: string
  tenants: { id: string; name: string; mobile: string } | null
  rooms: { room_number: string } | null
}

export default async function BillingPage() {
  const supabase = createClient()
  const [{ data: { user } }, { data: bills }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('bills')
      .select('id, bill_type, billing_period_start, billing_period_end, due_date, status, total_amount, created_at, tenants(id, name, mobile), rooms(room_number)')
      .order('created_at', { ascending: false }),
  ])

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isOwner = profile?.role === 'owner'

  let pendingApprovals: { id: string; created_at: string; payload: Record<string, unknown> }[] = []
  if (!isOwner) {
    const { data } = await supabase
      .from('approval_requests')
      .select('id, created_at, payload')
      .eq('requested_by', user!.id)
      .in('request_type', ['generate_bill', 'mark_bill_paid'])
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    pendingApprovals = (data ?? []) as typeof pendingApprovals
  }

  const totalUnpaid = (bills ?? []).filter(b => b.status !== 'paid' && b.status !== 'cancelled').reduce((s, b) => s + Number(b.total_amount), 0)

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Billing</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {(bills ?? []).length} bills · ₹{totalUnpaid.toLocaleString('en-IN')} outstanding
          </p>
        </div>
        <Link
          href="/billing/new"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors self-start sm:self-auto"
        >
          <Plus size={16} />
          {isOwner ? 'Create Bill' : 'Request Bill'}
        </Link>
      </div>

      {!isOwner && pendingApprovals.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">Your Pending Submissions ({pendingApprovals.length})</p>
          <div className="space-y-1">
            {pendingApprovals.map(a => (
              <div key={a.id} className="text-xs text-amber-700 flex justify-between">
                <span>{String((a.payload as Record<string, unknown>).bill_type ?? 'Bill request')}</span>
                <span>{new Date(a.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2">Awaiting owner approval</p>
        </div>
      )}

      {!(bills ?? []).length ? (
        <div className="text-center py-20 text-slate-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No bills yet</p>
          <p className="text-sm mt-1">Create the first bill to get started</p>
        </div>
      ) : (
        <BillingList bills={bills as unknown as BillRow[]} isOwner={isOwner} />
      )}
    </div>
  )
}
