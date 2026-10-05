import { sendEmail } from './email'
import { whatsappNumber } from './phone'
import { getBaseUrl } from './tickets'
import { sendWhatsAppMessage, sendWhatsAppTemplate } from './whatsapp'

/**
 * Sends tickets to their owner: by email to the address booked with, and by WhatsApp to the
 * number booked with. Nothing here ever shows a ticket to whoever asked; it only goes to the
 * passenger's own inbox or phone.
 */
export interface DeliverableTicket {
  bookingCode: string
  passengerName: string
  passengerPhone?: string
  passengerEmail?: string
  busName: string
  companyName: string
  from: string
  to: string
  date: string
  departureTime: string
  seats: string[]
  totalPrice: number
  boardingPoint?: string
}

export const ticketLink = (code: string) => `${getBaseUrl()}/confirmation?bookingId=${encodeURIComponent(code)}`

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

function ticketBlock(t: DeliverableTicket): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#5e5e5e;font-size:13px">${label}</td><td style="padding:6px 0;text-align:right;font-weight:700;font-size:14px;color:#111111">${esc(value)}</td></tr>`
  return `
  <div style="background:#ffffff;border:1px solid #ece7e2;border-radius:18px;padding:20px;margin:0 0 16px">
    <div style="font-size:20px;font-weight:800;color:#111111">${esc(t.from)} → ${esc(t.to)}</div>
    <div style="font-size:13px;color:#5e5e5e;margin-top:2px">${esc(t.companyName)} · ${esc(t.busName)}</div>
    <table style="width:100%;border-collapse:collapse;margin-top:12px">
      ${row('Date', t.date)}
      ${row('Departs', t.departureTime)}
      ${row(t.seats.length === 1 ? 'Seat' : 'Seats', t.seats.join(', '))}
      ${t.boardingPoint ? row('Board at', t.boardingPoint) : ''}
      ${row('Paid', `৳${t.totalPrice}`)}
      ${row('Ticket number', t.bookingCode)}
    </table>
    <a href="${ticketLink(t.bookingCode)}" style="display:block;margin-top:16px;padding:14px;border-radius:999px;background:#f2661d;color:#1a0d03;text-align:center;font-weight:800;font-size:15px;text-decoration:none">Open &amp; download ticket</a>
  </div>`
}

function ticketEmail(tickets: DeliverableTicket[], intro: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1fb;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px">
    <div style="font-size:24px;font-weight:800;color:#111111;margin-bottom:4px">bus<span style="color:#b87408">hub</span></div>
    <p style="font-size:15px;color:#2b2b2b;line-height:1.5">${esc(intro)}</p>
    ${tickets.map(ticketBlock).join('')}
    <p style="font-size:12.5px;color:#5e5e5e;line-height:1.5">Show the QR code on your ticket at the bus door. One ticket boards once, so don't share it.<br>টিকেটের QR কোড বাসে ওঠার সময় দেখান। কারও সাথে শেয়ার করবেন না।</p>
    <p style="font-size:12px;color:#8a8a8a">BusHub · bushubbd.com</p>
  </div></body></html>`
  const text = `${intro}\n\n${tickets
    .map((t) => `${t.from} → ${t.to}\n${t.date} ${t.departureTime} · Seats ${t.seats.join(', ')}\nTicket ${t.bookingCode}\n${ticketLink(t.bookingCode)}`)
    .join('\n\n')}\n\nShow the QR code at the bus door. One ticket boards once, so don't share it.`
  return { html, text }
}

function whatsappText(tickets: DeliverableTicket[], intro: string): string {
  return `${intro}\n\n${tickets
    .map((t) => `🚌 ${t.from} → ${t.to}\n${t.date} ${t.departureTime} · Seats ${t.seats.join(', ')}\nTicket ${t.bookingCode}\nOpen & download: ${ticketLink(t.bookingCode)}`)
    .join('\n\n')}\n\nShow the QR code at the bus door. One ticket boards once, so don't share it.`
}

/** Emails the tickets to one address. */
export async function emailTickets(to: string, tickets: DeliverableTicket[], intro: string): Promise<boolean> {
  if (!to || tickets.length === 0) return false
  const { html, text } = ticketEmail(tickets, intro)
  const subject = tickets.length === 1 ? `Your BusHub ticket: ${tickets[0].from} → ${tickets[0].to}, ${tickets[0].date}` : `Your ${tickets.length} BusHub tickets`
  return sendEmail(to, subject, html, text)
}

/** Sends the tickets to one WhatsApp number, with the approved template when there is one. */
export async function whatsappTickets(phone: string, tickets: DeliverableTicket[], intro: string): Promise<boolean> {
  const to = whatsappNumber(phone) ?? phone
  if (!to || tickets.length === 0) return false
  const template = process.env.WHATSAPP_TICKET_TEMPLATE
  if (template) {
    const sent = await Promise.all(
      tickets.map((t) =>
        sendWhatsAppTemplate(to, template, [t.passengerName, `${t.from} → ${t.to}`, `${t.date} ${t.departureTime}`, t.seats.join(', '), ticketLink(t.bookingCode)])
      )
    )
    return sent.some(Boolean)
  }
  return sendWhatsAppMessage(to, whatsappText(tickets, intro))
}

/** Right after payment: the ticket goes to the passenger's email (if given) and WhatsApp. */
export async function deliverNewTicket(t: DeliverableTicket): Promise<{ email: boolean; whatsapp: boolean }> {
  const intro = `Hi ${t.passengerName}, your BusHub ticket is confirmed. Keep this message: you can open and download your ticket from it any time.`
  const [email, whatsapp] = await Promise.all([
    t.passengerEmail ? emailTickets(t.passengerEmail, [t], intro) : Promise.resolve(false),
    t.passengerPhone ? whatsappTickets(t.passengerPhone, [t], intro) : Promise.resolve(false),
  ])
  return { email, whatsapp }
}
