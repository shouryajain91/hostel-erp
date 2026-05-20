'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Pencil } from 'lucide-react'

type Tenant = {
  id: string
  name: string
  mobile: string
  status: string
  tenancy_start_date: string
  tenancy_end_date: string | null
  rooms: { room_number: string; room_types: { name: string } | null } | null
}

export default function TenantSearch({ tenants }: { tenants: Tenant[]; isOwner: boolean }) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? tenants.filter(t =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.mobile.includes(query) ||
        t.rooms?.room_number.toLowerCase().includes(query.toLowerCase())
      )
    : tenants

  const active = filtered.filter(t => t.status === 'active')
  const checkedOut = filtered.filter(t => t.status === 'checked_out')

  return (
    <div>
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, mobile, or room…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
        />
      </div>

      {active.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Active ({active.length})</h3>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {active.map(t => (
              <div key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <Link href={`/tenants/${t.id}`} className="font-medium text-slate-900 hover:text-blue-600 transition-colors">
                    {t.name}
                  </Link>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Room {t.rooms?.room_number} · {t.rooms?.room_types?.name} · {t.mobile}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-500">Since {new Date(t.tenancy_start_date).toLocaleDateString('en-IN')}</p>
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/tenants/${t.id}/edit`} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                    <Pencil size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {checkedOut.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Checked Out ({checkedOut.length})</h3>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {checkedOut.map(t => (
              <div key={t.id} className="flex items-center gap-4 px-4 py-3 opacity-60">
                <div className="flex-1 min-w-0">
                  <Link href={`/tenants/${t.id}`} className="font-medium text-slate-900 hover:text-blue-600 transition-colors">
                    {t.name}
                  </Link>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Room {t.rooms?.room_number} · {t.mobile}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-500">Left {new Date(t.tenancy_end_date!).toLocaleDateString('en-IN')}</p>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Checked Out</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-center text-slate-400 py-10 text-sm">No tenants match your search.</p>
      )}
    </div>
  )
}
