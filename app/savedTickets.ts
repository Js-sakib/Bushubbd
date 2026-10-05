/**
 * Tickets this phone has opened, kept in the browser so "My tickets" can list them without a
 * search. Only the trip details and the ticket code; nothing leaves the phone.
 */
export interface SavedTicket {
  bookingCode: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  companyName: string
  savedAt: string
}

const KEY = 'bushub.tickets'
const MAX_SAVED = 30

export function readSavedTickets(): SavedTicket[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list.filter((t) => t && typeof t.bookingCode === 'string') : []
  } catch {
    return []
  }
}

export function saveTicket(ticket: Omit<SavedTicket, 'savedAt'>): void {
  try {
    const others = readSavedTickets().filter((t) => t.bookingCode !== ticket.bookingCode)
    const list = [{ ...ticket, savedAt: new Date().toISOString() }, ...others].slice(0, MAX_SAVED)
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Private browsing or storage turned off: the search still works.
  }
}

export function forgetTicket(bookingCode: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(readSavedTickets().filter((t) => t.bookingCode !== bookingCode)))
  } catch {
    // Nothing to do.
  }
}
