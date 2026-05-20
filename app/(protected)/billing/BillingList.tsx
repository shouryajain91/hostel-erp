'use client'

import { useState } from 'react'
import Link from 'next/link'

type BillRow = {
  id: string; bill_type: string; billing_period_start: string; billing_period_end: string
  due_date: string | null; status: string; total_amount: number; created_at: string
  tenants: { id: string; name: string; mobile: string } | null
  rooms: { room_number: string } | null
}

const BILL_TYPE_LABELS: Record<string, string> = {
  initial: 'Initial', monthly_partial: 'Monthly (Partial)', monthly_regular: 'Monthly', full_final: 'Full & Final',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600', sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600',
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function BillingList({ bills, isOwner }: { bills: BillRow[]; isOwner: boolean }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const filtered = bills.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !q || b.tenants?.name.toLowerCase().includes(q) || b.rooms?.room_number.toLowerCase().includes(q)
    const matchStatus = !filterStatus || b.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search tenant or room…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {filtered.map(bill => (
          <Link key={bill.id} href={`/billing/${bill.id}`} className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="font-semibold text-slate-900">{bill.tenants?.name ?? '—'}</p>
                <p className="text-xs text-slate-500">Room {bill.rooms?.room_number ?? '—'} · {BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ml-2 ${STATUS_COLORS[bill.status] ?? ''}`}>
                {bill.status}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-slate-400">
                {new Date(bill.billing_period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(bill.billing_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="font-bold text-slate-900">₹{Number(bill.total_amount).toLocaleString('en-IN')}</span>
            </div>
          </Link>
        ))}
        {!filtered.length && (
          <p className="text-center text-slate-400 py-10 text-sm">No bills match your filters</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Tenant / Room</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Period</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Amount</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(bill => (
              <tr key={bill.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{bill.tenants?.name ?? '—'}</p>
                  <p className="text-xs text-slate-500">Room {bill.rooms?.room_number ?? '—'}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {new Date(bill.billing_period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' – '}
                  {new Date(bill.billing_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  ₹{Number(bill.total_amount).toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[bill.status] ?? ''}`}>
                    {bill.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/billing/${bill.id}`} className="text-blue-600 hover:underline text-xs font-medium">View</Link>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400">No bills match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
