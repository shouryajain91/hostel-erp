import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, MessageCircle } from 'lucide-react'
import BillActions from './BillActions'

const BILL_TYPE_LABELS: Record<string, string> = {
  initial: 'Initial Payment',
  monthly_partial: 'Monthly – Partial Month',
  monthly_regular: 'Monthly – Regular',
  full_final: 'Full & Final Settlement',
}

const COMPONENT_LABELS: Record<string, string> = {
  security_deposit: 'Security Deposit',
  one_time_fee: 'One-time Fee',
  rent: 'Rent',
  electricity: 'Electricity',
  miscellaneous: 'Miscellaneous',
  security_refund: 'Security Refund',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

type BillComponent = {
  id: string; component_type: string; description: string | null
  amount: number; units_consumed: number | null; rate_per_unit: number | null
  num_tenants: number | null; days: number | null
}

export default async function BillDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: { user } }, { data: bill }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('bills').select(`
      *,
      tenants(id, name, mobile, guardian_name, permanent_address, tenancy_start_date),
      rooms(room_number, floor, room_types(name, base_rent)),
      bill_components(*)
    `).eq('id', params.id).single(),
  ])

  if (!bill) notFound()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isOwner = profile?.role === 'owner'

  const tenant = bill.tenants as unknown as { id: string; name: string; mobile: string; permanent_address: string; tenancy_start_date: string }
  const room = bill.rooms as unknown as { room_number: string; floor: number; room_types: { name: string; base_rent: number } | null }
  const components = (bill.bill_components as unknown as BillComponent[]) ?? []

  const periodStr = `${new Date(bill.billing_period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} – ${new Date(bill.billing_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`

  // Build WhatsApp message
  const lines = [
    `*Bill – ${BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}*`,
    `Tenant: ${tenant?.name ?? '—'}`,
    `Room: ${room?.room_number ?? '—'}`,
    `Period: ${periodStr}`,
    ``,
    ...components.map(c => {
      let line = `${COMPONENT_LABELS[c.component_type] ?? c.component_type}: ₹${Number(c.amount).toLocaleString('en-IN')}`
      if (c.description) line += ` (${c.description})`
      return line
    }),
    ``,
    `*Total: ₹${Number(bill.total_amount).toLocaleString('en-IN')}*`,
    bill.due_date ? `Due: ${new Date(bill.due_date).toLocaleDateString('en-IN')}` : '',
  ].filter(Boolean).join('\n')

  const waUrl = `https://wa.me/?text=${encodeURIComponent(lines)}`

  return (
    <div className="max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <Link href="/billing" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Back to Billing
        </Link>
        <div className="flex gap-2 flex-wrap">
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors">
            <MessageCircle size={15} /> WhatsApp
          </a>
          <Link href={`/billing/${params.id}/print`} target="_blank"
            className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors">
            <Printer size={15} /> Print / PDF
          </Link>
        </div>
      </div>

      {/* Bill Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}</p>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">₹{Number(bill.total_amount).toLocaleString('en-IN')}</h2>
          </div>
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium capitalize ${STATUS_COLORS[bill.status] ?? ''}`}>
            {bill.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Tenant</p>
            <p className="font-medium text-slate-900">{tenant?.name ?? '—'}</p>
            <p className="text-slate-500">{tenant?.mobile}</p>
          </div>
          <div>
            <p className="text-slate-500">Room</p>
            <p className="font-medium text-slate-900">Room {room?.room_number ?? '—'}, Floor {room?.floor}</p>
            <p className="text-slate-500">{room?.room_types?.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Billing Period</p>
            <p className="font-medium text-slate-900">{periodStr}</p>
          </div>
          {bill.due_date && (
            <div>
              <p className="text-slate-500">Due Date</p>
              <p className="font-medium text-slate-900">{new Date(bill.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          )}
          {bill.notes && (
            <div className="col-span-2">
              <p className="text-slate-500">Notes</p>
              <p className="text-slate-700">{bill.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Components */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <h3 className="font-semibold text-slate-900 mb-4">Bill Components</h3>
        <div className="space-y-3">
          {components.map((c, i) => (
            <div key={c.id ?? i} className="flex items-start justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <p className="font-medium text-slate-800">{COMPONENT_LABELS[c.component_type] ?? c.component_type}</p>
                {c.description && <p className="text-sm text-slate-500">{c.description}</p>}
                {c.component_type === 'electricity' && c.units_consumed && (
                  <p className="text-xs text-slate-400">
                    {c.units_consumed} units × ₹{c.rate_per_unit}/unit
                    {c.num_tenants && c.num_tenants > 1 ? ` ÷ ${c.num_tenants} tenants` : ''}
                  </p>
                )}
                {c.component_type === 'rent' && c.days && (
                  <p className="text-xs text-slate-400">{c.days} days</p>
                )}
              </div>
              <p className="font-semibold text-slate-900 tabular-nums">₹{Number(c.amount).toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t-2 border-slate-200 flex justify-between">
          <span className="font-bold text-slate-900">Total</span>
          <span className="font-bold text-xl text-slate-900">₹{Number(bill.total_amount).toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Actions */}
      <BillActions billId={params.id} currentStatus={bill.status} isOwner={isOwner} />
    </div>
  )
}
