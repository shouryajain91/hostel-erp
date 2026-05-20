import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

  if (!rows.length) return NextResponse.json({ error: 'Spreadsheet is empty.' }, { status: 400 })

  // Fetch room types to resolve by name
  const { data: roomTypes } = await supabase.from('room_types').select('id, name')
  const typeMap = new Map((roomTypes ?? []).map(rt => [rt.name.toLowerCase(), rt.id]))

  const records: object[] = []
  const errors: string[] = []

  rows.forEach((row, i) => {
    const rowNum = i + 2
    const room_number = String(row['Room Number'] ?? row['room_number'] ?? '').trim()
    const typeName = String(row['Room Type'] ?? row['room_type'] ?? '').trim()
    const floor = Number(row['Floor'] ?? row['floor'] ?? 1)
    const status = String(row['Status'] ?? row['status'] ?? 'available').toLowerCase()
    const notes = String(row['Notes'] ?? row['notes'] ?? '').trim() || null

    if (!room_number) { errors.push(`Row ${rowNum}: Room Number is required`); return }
    if (!typeName) { errors.push(`Row ${rowNum}: Room Type is required`); return }

    const room_type_id = typeMap.get(typeName.toLowerCase())
    if (!room_type_id) { errors.push(`Row ${rowNum}: Room type "${typeName}" not found`); return }

    const validStatuses = ['available', 'occupied', 'maintenance']
    if (!validStatuses.includes(status)) { errors.push(`Row ${rowNum}: Invalid status "${status}"`); return }

    records.push({ room_number, room_type_id, floor: isNaN(floor) ? 1 : floor, status, notes })
  })

  if (errors.length > 0 && records.length === 0) {
    return NextResponse.json({ error: 'All rows failed validation.', details: errors }, { status: 400 })
  }

  const { data, error } = await supabase.from('rooms').upsert(records as never[], {
    onConflict: 'room_number',
    ignoreDuplicates: false,
  }).select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    inserted: data?.length ?? 0,
    skipped: errors.length,
    errors: errors.length ? errors : undefined,
  })
}
