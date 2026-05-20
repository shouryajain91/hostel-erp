'use client'

import { useState, useEffect, useRef } from 'react'
import { Zap, Plus, Camera, ScanLine, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Reading = {
  id: string
  reading_date: string
  units_reading: number
  units_consumed: number | null
  reading_photo_url: string | null
  ocr_reading: number | null
  ocr_matched: boolean | null
  notes: string | null
  profiles: { name: string } | null
}

export default function ElectricityReadings({
  roomId,
  isOwnerOrManagement,
}: {
  roomId: string
  isOwnerOrManagement: boolean
}) {
  const [readings, setReadings] = useState<Reading[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  // Form state
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 16))
  const [unitsReading, setUnitsReading] = useState('')
  const [unitsConsumed, setUnitsConsumed] = useState('')
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  const fetchReadings = async () => {
    setFetching(true)
    const res = await fetch(`/api/rooms/${roomId}/electricity-readings`)
    const data = await res.json()
    setReadings(data)
    setFetching(false)
  }

  useEffect(() => { fetchReadings() }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null
    setUploadingPhoto(true)
    const supabase = createClient()
    const ext = photoFile.name.split('.').pop()
    const path = `${roomId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('meter-readings').upload(path, photoFile)
    setUploadingPhoto(false)
    if (error) { setError('Photo upload failed: ' + error.message); return null }
    const { data: { publicUrl } } = supabase.storage.from('meter-readings').getPublicUrl(path)
    return publicUrl
  }

  const resetForm = () => {
    setUnitsReading('')
    setUnitsConsumed('')
    setNotes('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setReadingDate(new Date().toISOString().slice(0, 16))
    setError('')
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const photoUrl = await uploadPhoto()
    if (photoFile && !photoUrl) { setLoading(false); return }

    const res = await fetch(`/api/rooms/${roomId}/electricity-readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reading_date: new Date(readingDate).toISOString(),
        units_reading: parseFloat(unitsReading),
        units_consumed: unitsConsumed ? parseFloat(unitsConsumed) : null,
        reading_photo_url: photoUrl,
        notes,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to save reading.')
    } else {
      setReadings(prev => [data, ...prev])
      resetForm()
    }
  }

  const lastReading = readings[0]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-amber-500" />
          <h3 className="font-semibold text-slate-900">Electricity Readings</h3>
          {lastReading && (
            <span className="text-xs text-slate-500">
              Last: {lastReading.units_reading} units ({new Date(lastReading.reading_date).toLocaleDateString('en-IN')})
            </span>
          )}
        </div>
        {isOwnerOrManagement && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} /> Add Reading
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-800 text-sm">New Electricity Reading</p>
            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                value={readingDate}
                onChange={e => setReadingDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Meter Reading (units)</label>
              <input
                type="number"
                value={unitsReading}
                onChange={e => setUnitsReading(e.target.value)}
                required
                step="0.01"
                min="0"
                placeholder="e.g. 1245.50"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Units Consumed <span className="text-slate-400 font-normal">(auto-calculated from previous if blank)</span>
            </label>
            <input
              type="number"
              value={unitsConsumed}
              onChange={e => setUnitsConsumed(e.target.value)}
              step="0.01"
              min="0"
              placeholder="Leave blank to auto-calculate"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          {/* Meter photo upload */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Meter Photo <span className="text-slate-400 font-normal">(optional)</span></label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Camera size={14} /> Upload Photo
              </button>
              <button
                type="button"
                disabled
                title="OCR coming soon"
                className="inline-flex items-center gap-1.5 text-xs border border-dashed border-slate-300 rounded-lg px-3 py-2 text-slate-400 cursor-not-allowed"
              >
                <ScanLine size={14} /> OCR Scan (coming soon)
              </button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
            {photoPreview && (
              <div className="mt-2 relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Meter preview" className="h-24 rounded-lg border border-slate-200 object-cover" />
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  className="absolute -top-1.5 -right-1.5 bg-white rounded-full border border-slate-200 p-0.5 text-slate-500 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Mid-month reading due to tenant change"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading || uploadingPhoto}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              {uploadingPhoto ? 'Uploading photo…' : loading ? 'Saving…' : 'Save Reading'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {fetching ? (
        <p className="text-sm text-slate-400 py-4">Loading readings…</p>
      ) : readings.length === 0 ? (
        <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-xl">
          <Zap size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No electricity readings yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {readings.map((r, i) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-slate-900">{r.units_reading} units</span>
                  {r.units_consumed != null && (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      +{r.units_consumed} consumed
                    </span>
                  )}
                  {i === 0 && (
                    <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">Latest</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(r.reading_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  {r.profiles && ` · ${r.profiles.name}`}
                </p>
                {r.notes && <p className="text-xs text-slate-500 mt-1 italic">{r.notes}</p>}
              </div>
              {r.reading_photo_url && (
                <a href={r.reading_photo_url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.reading_photo_url} alt="Meter" className="h-14 w-14 rounded-lg object-cover border border-slate-200 hover:opacity-80 transition-opacity" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
