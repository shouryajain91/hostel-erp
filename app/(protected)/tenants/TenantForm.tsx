'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type RoomOption = { id: string; room_number: string; floor: number; room_types: { name: string; capacity: number } | null; activeCount: number }

type InitialData = {
  name?: string; date_of_birth?: string; gender?: string; mobile?: string
  guardian_name?: string; guardian_mobile?: string; permanent_address?: string
  room_id?: string; booking_date?: string; tenancy_start_date?: string
  tenancy_end_date?: string; security_deposit?: string | number
  kyc_doc1_name?: string; kyc_doc1_url?: string
  kyc_doc2_name?: string; kyc_doc2_url?: string
}

export default function TenantForm({
  rooms, isOwner, tenantId, initialData, backHref,
}: {
  rooms: RoomOption[]
  isOwner: boolean
  tenantId?: string
  initialData?: InitialData
  backHref: string
}) {
  const router = useRouter()
  const d = initialData ?? {}

  const [name, setName] = useState(d.name ?? '')
  const [dob, setDob] = useState(d.date_of_birth ?? '')
  const [gender, setGender] = useState(d.gender ?? '')
  const [mobile, setMobile] = useState(d.mobile ?? '')
  const [guardianName, setGuardianName] = useState(d.guardian_name ?? '')
  const [guardianMobile, setGuardianMobile] = useState(d.guardian_mobile ?? '')
  const [address, setAddress] = useState(d.permanent_address ?? '')
  const [roomId, setRoomId] = useState(d.room_id ?? '')
  const [bookingDate, setBookingDate] = useState(d.booking_date ?? '')
  const [startDate, setStartDate] = useState(d.tenancy_start_date ?? '')
  const [endDate, setEndDate] = useState(d.tenancy_end_date ?? '')
  const [securityDeposit, setSecurityDeposit] = useState(String(d.security_deposit ?? ''))
  const [kyc1Name, setKyc1Name] = useState(d.kyc_doc1_name ?? '')
  const [kyc1Url, setKyc1Url] = useState(d.kyc_doc1_url ?? '')
  const [kyc1Preview, setKyc1Preview] = useState(d.kyc_doc1_url ?? '')
  const [kyc2Name, setKyc2Name] = useState(d.kyc_doc2_name ?? '')
  const [kyc2Url, setKyc2Url] = useState(d.kyc_doc2_url ?? '')
  const [kyc2Preview, setKyc2Preview] = useState(d.kyc_doc2_url ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingKyc1, setUploadingKyc1] = useState(false)
  const [uploadingKyc2, setUploadingKyc2] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const kyc1Ref = useRef<HTMLInputElement>(null)
  const kyc2Ref = useRef<HTMLInputElement>(null)

  const uploadKyc = async (file: File, slot: 1 | 2) => {
    const setter = slot === 1 ? setUploadingKyc1 : setUploadingKyc2
    setter(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('kyc-documents').upload(path, file)
    setter(false)
    if (error) { setError('KYC upload failed: ' + error.message); return null }
    const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(path)
    return publicUrl
  }

  const handleKycChange = async (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    if (slot === 1) { setKyc1Preview(preview) } else { setKyc2Preview(preview) }
    const url = await uploadKyc(file, slot)
    if (url) {
      if (slot === 1) setKyc1Url(url); else setKyc2Url(url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!kyc1Url) { setError('KYC Document 1 image is required.'); return }
    if (!kyc2Url) { setError('KYC Document 2 image is required.'); return }

    setLoading(true)

    const payload = {
      name, date_of_birth: dob, gender, mobile, guardian_name: guardianName,
      guardian_mobile: guardianMobile, permanent_address: address,
      room_id: roomId, booking_date: bookingDate, tenancy_start_date: startDate,
      tenancy_end_date: endDate || null, security_deposit: securityDeposit,
      kyc_doc1_name: kyc1Name, kyc_doc1_url: kyc1Url,
      kyc_doc2_name: kyc2Name, kyc_doc2_url: kyc2Url,
    }

    const url = tenantId ? `/api/tenants/${tenantId}` : '/api/tenants'
    const method = tenantId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to submit.')
    } else if (data.approval_request) {
      setSubmitted(true)
    } else {
      router.push('/tenants')
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg">
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Submitted for Approval</h3>
          <p className="text-slate-500 text-sm mb-6">Your request has been sent to the owner for review.</p>
          <Link href="/tenants" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Back to Tenants
          </Link>
        </div>
      </div>
    )
  }

  const inputCls = "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-sm"
  const labelCls = "block text-sm font-medium text-slate-700 mb-1.5"

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 max-w-2xl">

      {/* Personal Details */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Personal Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputCls} placeholder="e.g. Rahul Sharma" />
          </div>
          <div>
            <label className={labelCls}>Date of Birth</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Gender</label>
            <select value={gender} onChange={e => setGender(e.target.value)} required className={inputCls}>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Mobile Number</label>
            <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} required className={inputCls} placeholder="10-digit mobile" />
          </div>
          <div>
            <label className={labelCls}>Father / Guardian Name</label>
            <input type="text" value={guardianName} onChange={e => setGuardianName(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Guardian Mobile</label>
            <input type="tel" value={guardianMobile} onChange={e => setGuardianMobile(e.target.value)} required className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Permanent Address</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} required rows={2} className={`${inputCls} resize-none`} placeholder="Full permanent address" />
          </div>
        </div>
      </div>

      {/* Room & Dates */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Room & Tenancy</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Room</label>
            <select value={roomId} onChange={e => setRoomId(e.target.value)} required className={inputCls}>
              <option value="">Select a room…</option>
              {rooms.map(r => {
                const cap = r.room_types?.capacity ?? 1
                const available = cap - r.activeCount
                return (
                  <option key={r.id} value={r.id} disabled={available <= 0}>
                    Room {r.room_number} — {r.room_types?.name} · Floor {r.floor}
                    {available <= 0 ? ' (Full)' : ` (${available} space${available > 1 ? 's' : ''} left)`}
                  </option>
                )
              })}
            </select>
          </div>
          <div>
            <label className={labelCls}>Booking Date</label>
            <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tenancy Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Security Deposit (₹)</label>
            <input type="number" value={securityDeposit} onChange={e => setSecurityDeposit(e.target.value)} required min={0} step="0.01" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tenancy End Date <span className="text-slate-400 font-normal">(if notified)</span></label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* KYC Documents */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">KYC Documents</h3>
        <div className="grid grid-cols-2 gap-6">
          {([1, 2] as const).map(slot => {
            const docName = slot === 1 ? kyc1Name : kyc2Name
            const setDocName = slot === 1 ? setKyc1Name : setKyc2Name
            const preview = slot === 1 ? kyc1Preview : kyc2Preview
            const uploading = slot === 1 ? uploadingKyc1 : uploadingKyc2
            const ref = slot === 1 ? kyc1Ref : kyc2Ref

            return (
              <div key={slot}>
                <label className={labelCls}>KYC Document {slot}</label>
                <input
                  type="text"
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  required
                  placeholder="e.g. Aadhaar Card"
                  className={`${inputCls} mb-2`}
                />
                <div
                  className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => ref.current?.click()}
                >
                  {preview ? (
                    <div className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt={`KYC ${slot}`} className="h-24 mx-auto rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); if (slot === 1) { setKyc1Url(''); setKyc1Preview('') } else { setKyc2Url(''); setKyc2Preview('') } }}
                        className="absolute -top-1.5 -right-1.5 bg-white rounded-full border border-slate-200 p-0.5 text-slate-500 hover:text-red-500"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : uploading ? (
                    <p className="text-xs text-slate-500">Uploading…</p>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <Upload size={20} />
                      <p className="text-xs">Click to upload photo/scan</p>
                    </div>
                  )}
                </div>
                <input
                  ref={ref}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => handleKycChange(e, slot)}
                />
              </div>
            )
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={loading || uploadingKyc1 || uploadingKyc2}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Submitting…' : isOwner ? (tenantId ? 'Save Changes' : 'Add Tenant') : 'Submit for Approval'}
        </button>
        <Link href={backHref} className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm flex items-center">
          Cancel
        </Link>
      </div>
    </form>
  )
}
