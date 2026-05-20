'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewUserPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'owner') {
      const res = await fetch('/api/users/create-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create user.')
      } else {
        setSuccess(`User created! They can log in with phone: ${phone} and the password you set.`)
        setName(''); setPhone(''); setPassword('')
      }
    } else {
      const { error: reqError } = await supabase
        .from('approval_requests')
        .insert({
          request_type: 'create_user',
          payload: { name, phone },
          requested_by: user.id,
        })

      if (reqError) {
        setError('Failed to submit request. Please try again.')
      } else {
        setSuccess('Request submitted! The owner will review and approve it.')
        setName(''); setPhone('')
      }
    }

    setLoading(false)
  }

  return (
    <div className="max-w-lg">
      <Link
        href="/users"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft size={16} /> Back to Users
      </Link>

      <h2 className="text-2xl font-bold text-slate-900 mb-1">Add New User</h2>
      <p className="text-slate-500 text-sm mb-6">
        Creates a management staff account. If you are management, the owner must approve your request.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ramesh Kumar"
            required
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="9876543210"
            required
            pattern="[0-9]{10}"
            title="Enter a 10-digit phone number"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Initial Password
            <span className="text-slate-400 font-normal ml-1">(Owner only — for direct creation)</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            minLength={8}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          />
          <p className="text-xs text-slate-400 mt-1">
            If you are management, this field is ignored — the owner sets the password on approval.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
            {success}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Submitting…' : 'Submit'}
          </button>
          <Link
            href="/users"
            className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm flex items-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
