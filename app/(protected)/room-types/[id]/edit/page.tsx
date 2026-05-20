'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, X, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const PRESET_AMENITIES = ['AC', 'WiFi', 'Attached Bathroom', 'Geyser', 'TV', 'Balcony', 'Refrigerator', 'Washing Machine']

export default function EditRoomTypePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [capacity, setCapacity] = useState('')
  const [baseRent, setBaseRent] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])
  const [customAmenity, setCustomAmenity] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const client = createClient()
    client.from('room_types').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { router.push('/room-types'); return }
      setName(data.name)
      setDescription(data.description || '')
      setCapacity(String(data.capacity))
      setBaseRent(String(data.base_rent))
      setAmenities(data.amenities || [])
      setFetching(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const togglePreset = (a: string) => {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  const addCustom = () => {
    const val = customAmenity.trim()
    if (val && !amenities.includes(val)) setAmenities(prev => [...prev, val])
    setCustomAmenity('')
  }

  const removeAmenity = (a: string) => setAmenities(prev => prev.filter(x => x !== a))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch(`/api/room-types/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        capacity: parseInt(capacity),
        base_rent: parseFloat(baseRent),
        amenities,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to update room type.')
    } else {
      router.push('/room-types')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return  // eslint-disable-line no-restricted-globals
    setDeleting(true)
    const res = await fetch(`/api/room-types/${id}`, { method: 'DELETE' })
    const data = await res.json()
    setDeleting(false)
    if (!res.ok) {
      setError(data.error || 'Failed to delete room type.')
    } else {
      router.push('/room-types')
    }
  }

  if (fetching) {
    return <div className="text-slate-400 text-sm p-6">Loading…</div>
  }

  return (
    <div className="max-w-lg">
      <Link href="/room-types" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={16} /> Back to Room Types
      </Link>

      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-slate-900">Edit Room Type</h2>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          <Trash2 size={15} />
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      <p className="text-slate-500 text-sm mb-6">Update this room type&apos;s details, amenities, and pricing.</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Description <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Capacity (tenants)</label>
            <input
              type="number"
              value={capacity}
              onChange={e => setCapacity(e.target.value)}
              min={1}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Base Rent (₹/month)</label>
            <input
              type="number"
              value={baseRent}
              onChange={e => setBaseRent(e.target.value)}
              min={0}
              step="0.01"
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Amenities</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_AMENITIES.map(a => (
              <button
                key={a}
                type="button"
                onClick={() => togglePreset(a)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  amenities.includes(a)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customAmenity}
              onChange={e => setCustomAmenity(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              placeholder="Add custom amenity…"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
            <button
              type="button"
              onClick={addCustom}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>

          {amenities.filter(a => !PRESET_AMENITIES.includes(a)).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {amenities.filter(a => !PRESET_AMENITIES.includes(a)).map(a => (
                <span key={a} className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full">
                  {a}
                  <button type="button" onClick={() => removeAmenity(a)} className="hover:text-red-500">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
          <Link href="/room-types" className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm flex items-center">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
