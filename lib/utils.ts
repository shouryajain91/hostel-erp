import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Phone numbers are stored in Supabase Auth as {phone}@hostel.erp
// so we never need an SMS gateway
export function phoneToEmail(phone: string) {
  return `${phone.trim()}@hostel.erp`
}

export function emailToPhone(email: string) {
  return email.replace('@hostel.erp', '')
}
