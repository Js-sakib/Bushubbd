/** Where a bus company stands in the talks about joining BusHub. */
export const LEAD_STATUSES = [
  { key: 'new', label: 'To call' },
  { key: 'called', label: 'Called' },
  { key: 'interested', label: 'Interested' },
  { key: 'trial', label: 'On trial' },
  { key: 'joined', label: 'Joined' },
  { key: 'not_interested', label: 'Not interested' },
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]['key']

export const LEAD_SOURCES = ['Counter visit', 'Phone call', 'Facebook', 'Website', 'Referral', 'Other'] as const

export function leadStatusLabel(status: string): string {
  return LEAD_STATUSES.find((s) => s.key === status)?.label ?? status
}

export interface LeadNote {
  text: string
  at: string
}

export interface Lead {
  _id?: string
  companyName: string
  /** Lowercased, single-spaced name; one lead per company. */
  nameKey: string
  contactName: string
  phone: string
  altPhone: string
  area: string
  source: string
  status: LeadStatus
  /** YYYY-MM-DD, Dhaka date of the next call or visit; empty when none is planned. */
  followUpDate: string
  /** Newest last. Status changes are logged here too, so the history reads as a call log. */
  notes: LeadNote[]
  lastContactedAt?: string
  createdAt: string
  updatedAt: string
}

/**
 * Public contact numbers found on each company's own website or Facebook page in September
 * 2026. Numbers change, so each one says where it came from and should be checked on the call.
 */
export const STARTER_LEADS: { companyName: string; phone: string; altPhone?: string; note: string }[] = [
  { companyName: 'Green Line Paribahan', phone: '09613-316557', note: 'Call center, from greenlinebd.com/contact-us.' },
  { companyName: 'Shohagh Paribahan', phone: '09606-444777', altPhone: '01711-612433', note: 'Call center, from shohagh.com/contact-us.' },
  { companyName: 'London Express', phone: '01711-000333', altPhone: '09613-444222', note: 'Call center, from lonexbd.com/contact-us.' },
  { companyName: 'Ena Transport', phone: '01944-800200', altPhone: '01932-800200', note: 'Hotline, from Ena Transport\'s Facebook page.' },
  { companyName: 'Hanif Enterprise', phone: '01713-402632', note: 'AC service number, from Hanif Enterprise\'s Facebook page.' },
  { companyName: 'Shyamoli Paribahan', phone: '09644-664466', note: 'From shyamolitickets.com.' },
  { companyName: 'Saintmartin Hyundai', phone: '01762-691339', note: 'Hotline, from the Saintmartin Paribahan Facebook group.' },
  { companyName: 'SR Travels', phone: '01711-394801', note: 'Kallyanpur counter, from SR Travels\' Facebook page. Ask for the owner or manager.' },
  { companyName: 'National Travels', phone: '01713-228286', note: 'From National Travels\' Facebook posts. The same number was posted for Desh Travels; ask if they are one group.' },
]
