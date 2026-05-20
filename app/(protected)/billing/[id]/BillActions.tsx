'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TRANSITIONS: Record<string, { label: string; next: string; color: string }[]> = {
  draft: [
    { label: 'Mark as Sent', next: 'sent', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { label: 'Cancel Bill', next: 'cancelled', color: 'border border-red-300 text-red-600 hover:bg-red-50' },
  ],
  sent: [
    { label: 'Mark as Paid', next: 'paid', color: 'bg-green-600 hover:bg-green-700 text-white' },
    { label: 'Cancel Bill', next: 'cancelled', color: 'border border-red-300 text-red-600 hover:bg-red-50' },
  ],
  paid: [],
  cancelled: [],
}

export default function BillActions({ billId, currentStatus, isOwner }: {
  billId: string; currentStatus: string; isOwner: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState('')
  const [msg, setMsg] = useState('')

  const transitions = TRANSITIONS[currentStatus] ?? []
  if (!transitions.length) return null

  const update = async (next: string) => {
    setLoading(next)
    setMsg('')
    const res = await fetch(`/api/billing/${billId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    const data = await res.json()
    setLoading('')

    if (!res.ok) { setMsg(data.error ?? 'Something went wrong'); return }

    if (data.approval_request) {
      setMsg('Submitted for owner approval')
      return
    }

    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-700 mb-3">Actions</p>
      <div className="flex gap-3 flex-wrap">
        {transitions.map(({ label, next, color }) => (
          <button
            key={next}
            onClick={() => update(next)}
            disabled={!!loading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${color}`}
          >
            {loading === next ? 'Updating…' : label}
            {!isOwner && next === 'paid' ? ' (requires approval)' : ''}
          </button>
        ))}
      </div>
      {msg && <p className="text-sm text-amber-700 mt-3">{msg}</p>}
    </div>
  )
}
