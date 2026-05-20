'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function BulkUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ inserted?: number; skipped?: number; errors?: string[] } | null>(null)
  const router = useRouter()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/rooms/bulk-upload', { method: 'POST', body: formData })
      const data = await res.json()
      setResult(data)
      if (res.ok) router.refresh()
    } catch {
      setResult({ errors: ['Upload failed. Please try again.'] })
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        <Upload size={15} />
        {loading ? 'Uploading…' : 'Bulk Upload'}
      </button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      {result && (
        <div className={`absolute right-0 top-10 z-10 w-72 rounded-lg border shadow-lg p-3 text-xs ${result.errors && !result.inserted ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          {result.inserted != null && (
            <p className="text-emerald-700 font-medium mb-1">✓ {result.inserted} room(s) uploaded</p>
          )}
          {result.skipped ? <p className="text-amber-600 mb-1">{result.skipped} row(s) skipped</p> : null}
          {result.errors?.map((e, i) => <p key={i} className="text-red-600">{e}</p>)}
          <button onClick={() => setResult(null)} className="mt-2 text-slate-400 hover:text-slate-600">Dismiss</button>
        </div>
      )}
    </div>
  )
}
