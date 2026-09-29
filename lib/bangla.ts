/** Bangla digits, dates and times for the ticket. Formatted by hand so server and browser agree. */

const DIGITS = '০১২৩৪৫৬৭৮৯'
const DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার']
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']

export function bnDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => DIGITS[Number(d)])
}

/** "2026-09-29" → "মঙ্গলবার, ২৯ সেপ্টেম্বর ২০২৬" */
export function bnDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  if (!date || Number.isNaN(d.getTime())) return date
  return `${DAYS[d.getUTCDay()]}, ${bnDigits(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${bnDigits(d.getUTCFullYear())}`
}

/** Minutes after midnight → "সকাল ৮:৩০", with the part of day people say in Bangladesh. */
export function bnClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const part = h < 4 ? 'রাত' : h < 6 ? 'ভোর' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকেল' : h < 20 ? 'সন্ধ্যা' : 'রাত'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${part} ${bnDigits(h12)}:${bnDigits(String(m % 60).padStart(2, '0'))}`
}

/** 150 → "২ ঘণ্টা ৩০ মিনিট" */
export function bnDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h ? `${bnDigits(h)} ঘণ্টা` : '', m ? `${bnDigits(m)} মিনিট` : ''].filter(Boolean).join(' ')
}
