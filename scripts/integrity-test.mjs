// End-to-end integrity test against a running BusHub server and its MongoDB.
// Checks that seats can't be sold twice, tickets can't board twice, and fakes are rejected.
//
//   BASE_URL=http://localhost:3000 MONGODB_URI=mongodb://127.0.0.1:27017 \
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/integrity-test.mjs
//
// It creates its own test companies, buses and bookings. Never point it at the live database.
// Its trips leave late tonight (Dhaka time) and a trip that has left can't be sold, so run it
// before 23:00 in Dhaka.
import { MongoClient, ObjectId } from 'mongodb'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db('bushubbd')

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  -> ${detail}`}`)
  if (!ok) failures++
}

async function call(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  const setCookie = res.headers.get('set-cookie')
  return { status: res.status, data, cookie: setCookie ? setCookie.split(';')[0] : null }
}

const dhakaToday = new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10)
const run = Date.now().toString(36).toUpperCase()

// ---- Setup: admin, two approved companies, and each company's login ----
const admin = (await call('/api/admin/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).cookie
check('admin can log in', !!admin)

async function makeCompany(name) {
  const res = await call('/api/companies', {
    method: 'POST',
    cookie: admin,
    body: { name, ownerName: 'Test Owner', email: `${name.replace(/\W/g, '').toLowerCase()}@test.local`, phone: '01700000000' },
  })
  if (res.status !== 201) throw new Error(`could not create ${name}: ${JSON.stringify(res.data)}`)
  const login = await call('/api/company/login', {
    method: 'POST',
    body: { email: res.data.company.email, password: res.data.password },
  })
  // Boarding passengers needs a scanner login, which the company's manager creates.
  const staff = await call('/api/company/staff', {
    method: 'POST',
    cookie: login.cookie,
    body: { name: `${name} gate`, email: `scan.${name.replace(/\W/g, '').toLowerCase()}@test.local`, role: 'scanner' },
  })
  const scanLogin = await call('/api/company/login', { method: 'POST', body: { email: staff.data?.staff?.email, password: staff.data?.password } })
  return { id: res.data.company._id, name, cookie: login.cookie, email: res.data.company.email, password: res.data.password, scan: scanLogin.cookie }
}
const green = await makeCompany(`Green Line ${run}`)
const hanif = await makeCompany(`Hanif ${run}`)
check('companies created and logged in, each with a scanner login', !!green.cookie && !!hanif.cookie && !!green.scan && !!hanif.scan)

const dupCompany = await call('/api/companies', {
  method: 'POST',
  cookie: admin,
  body: { name: `  green line ${run.toLowerCase()} `, ownerName: 'X', email: `other${run}@test.local`, phone: '01700000001' },
})
check('the same company name cannot be added twice (any spelling case)', dupCompany.status === 409, `status ${dupCompany.status}`)

// ---- Fleet: each bus name is listed once, trips pick it from the list ----
const fleetRes = await call('/api/fleet', {
  method: 'POST',
  cookie: admin,
  body: { name: `GL Scania ${run}`, companyId: green.id, busType: 'AC', totalSeats: 36 },
})
check('admin lists a bus once in the fleet', fleetRes.status === 201, JSON.stringify(fleetRes.data))
const fleetBus = fleetRes.data?.bus

const dupFleet = await call('/api/fleet', {
  method: 'POST',
  cookie: admin,
  body: { name: `gl  scania ${run.toLowerCase()}`, companyId: hanif.id, busType: 'AC', totalSeats: 36 },
})
check('the same bus name cannot be listed twice', dupFleet.status === 409, `status ${dupFleet.status}`)

// Number plates: one bus each, however they are typed.
const plateNo = `DHAKA METRO-BA ${run.replace(/\D/g, '').slice(-2).padStart(2, '1')}-${String(Date.now()).slice(-4)}`
const platedBus = await call('/api/fleet', { method: 'POST', cookie: admin, body: { name: `GL Hino ${run}`, plateNumber: plateNo.toLowerCase(), companyId: green.id, busType: 'Non-AC', totalSeats: 40 } })
check('a bus is listed with its number plate (tidied to capitals)', platedBus.status === 201 && platedBus.data.bus.plateNumber === plateNo, JSON.stringify(platedBus.data))
const samePlate = await call('/api/fleet', { method: 'POST', cookie: admin, body: { name: `GL Other ${run}`, plateNumber: plateNo.replace(/-/g, ' '), companyId: hanif.id, busType: 'AC', totalSeats: 36 } })
check('the same number plate cannot be on two buses, however it is typed', samePlate.status === 409, JSON.stringify(samePlate.data))
check('nonsense is refused as a number plate', (await call('/api/fleet', { method: 'POST', cookie: admin, body: { name: `GL Bad ${run}`, plateNumber: '!!', companyId: green.id, busType: 'AC', totalSeats: 36 } })).status === 400)
const plateSet = await call(`/api/fleet/${fleetBus._id}`, { method: 'PATCH', cookie: admin, body: { plateNumber: `CHATTA METRO-HA ${String(Date.now()).slice(-4)}` } })
check('the admin adds a plate to an existing bus', plateSet.status === 200 && /^CHATTA METRO-HA \d{4}$/.test(plateSet.data.plateNumber))
check('a plate already on another bus cannot be given again', (await call(`/api/fleet/${fleetBus._id}`, { method: 'PATCH', cookie: admin, body: { plateNumber: plateNo } })).status === 409)
check('only the admin changes plates', (await call(`/api/fleet/${fleetBus._id}`, { method: 'PATCH', cookie: green.cookie, body: { plateNumber: 'X 1234' } })).status === 403)

// ---- Commission is set once per company; the admin can change it per company ----
const rateCo = await call('/api/companies', { method: 'POST', cookie: admin, body: { name: `Rate Co ${run}`, ownerName: 'Owner', email: `rateco${run.toLowerCase()}@test.local`, phone: '01700000009', commissionRate: 12 } })
check('the admin sets the commission when adding a company', rateCo.status === 201 && rateCo.data.company.commissionRate === 12, JSON.stringify(rateCo.data))
check('a commission outside 0–50% is refused', (await call('/api/companies', { method: 'POST', cookie: admin, body: { name: `Bad Rate ${run}`, ownerName: 'O', email: `badrate${run.toLowerCase()}@test.local`, phone: '01700000010', commissionRate: 80 } })).status === 400)
const rateBus = (await call('/api/fleet', { method: 'POST', cookie: admin, body: { name: `Rate Bus ${run}`, companyId: rateCo.data.company._id, busType: 'AC', totalSeats: 36, commissionRate: 40 } })).data.bus
check("a new bus takes its company's commission, whatever is sent for the bus", rateBus.commissionRate === 12)
check('commission cannot be changed on a single bus', (await call(`/api/fleet/${rateBus._id}`, { method: 'PATCH', cookie: admin, body: { commissionRate: 30 } })).status === 400)
const rateDay = new Date(Date.now() + 30 * 3600e3).toISOString().slice(0, 10)
const rateTrip = (await call('/api/buses', { method: 'POST', cookie: admin, body: { fleetId: rateBus._id, from: 'Dhaka', to: 'Sylhet', date: rateDay, departureTime: '10:35', price: 1000 } })).data.bus
const rateBuy = async (seat) => (await call('/api/bookings', { method: 'POST', body: { busId: rateTrip._id, seats: [seat], passengerName: 'Rate Test', passengerPhone: '0194' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0') } })).data.booking
const at12 = await rateBuy('1A')
check('tickets use the company commission', rateTrip.commissionRate === 12 && at12.commissionRate === 12 && at12.commissionAmount === 120 && at12.companyPayout === 880, JSON.stringify(at12))
check('only the admin changes a company commission', (await call(`/api/companies/${rateCo.data.company._id}`, { method: 'PATCH', cookie: green.cookie, body: { commissionRate: 1 } })).status === 401)
check('a bad commission is refused when editing', (await call(`/api/companies/${rateCo.data.company._id}`, { method: 'PATCH', cookie: admin, body: { commissionRate: 'abc' } })).status === 400)
const rateEdit = await call(`/api/companies/${rateCo.data.company._id}`, { method: 'PATCH', cookie: admin, body: { commissionRate: 15 } })
const at15 = await rateBuy('2A')
const at12After = await db.collection('bookings').findOne({ _id: new ObjectId(at12._id) })
const rateBusAfter = await db.collection('fleet').findOne({ _id: new ObjectId(rateBus._id) })
const listed = (await call('/api/companies', { cookie: admin })).data.companies.find((c) => c._id === rateCo.data.company._id)
check(
  'changing a company commission: its buses and trips to come use it; tickets already sold keep theirs',
  rateEdit.status === 200 && listed.commissionRate === 15 && rateBusAfter.commissionRate === 15 && at15.commissionRate === 15 && at15.commissionAmount === 150 && at12After.commissionRate === 12 && at12After.commissionAmount === 120,
  JSON.stringify({ at15, listed: listed.commissionRate })
)

const typedTrip = await call('/api/buses', {
  method: 'POST',
  cookie: admin,
  body: { busName: 'Typed Name', companyName: 'Anything', from: 'Dhaka', to: 'Sylhet', date: dhakaToday, departureTime: '23:00', price: 900, totalSeats: 40 },
})
check('a trip cannot be added with a typed bus name', typedTrip.status === 400, `status ${typedTrip.status}`)

const tripRes = await call('/api/buses', {
  method: 'POST',
  cookie: admin,
  body: { fleetId: fleetBus?._id, busName: 'Spoofed', companyName: 'Spoofed', from: 'Dhaka', to: 'Sylhet', date: dhakaToday, departureTime: '23:30', price: 900 },
})
const trip = tripRes.data?.bus
check('trip is created from the fleet bus', tripRes.status === 201, JSON.stringify(tripRes.data))
check(
  'trip copies name, company, type and seats from the fleet (typed values ignored)',
  trip?.busName === fleetBus?.name && trip?.companyId === green.id && trip?.companyName === green.name && trip?.totalSeats === 36,
  JSON.stringify(trip)
)

const dupTrip = await call('/api/buses', {
  method: 'POST',
  cookie: admin,
  body: { fleetId: fleetBus?._id, from: 'Dhaka', to: 'Sylhet', date: dhakaToday, departureTime: '23:30', price: 900 },
})
check('the same bus cannot be listed twice for the same date and time', dupTrip.status === 409, `status ${dupTrip.status}`)

const nonAdminTrip = await call('/api/buses', {
  method: 'POST',
  cookie: green.cookie,
  body: { fleetId: fleetBus?._id, from: 'Dhaka', to: 'Sylhet', date: dhakaToday, departureTime: '10:00', price: 900 },
})
check('a bus company cannot add trips', nonAdminTrip.status === 403, `status ${nonAdminTrip.status}`)

const pastTrip = await call('/api/buses', {
  method: 'POST',
  cookie: admin,
  body: { fleetId: fleetBus?._id, from: 'Dhaka', to: 'Sylhet', date: dhakaToday, departureTime: '00:00', price: 900 },
})
check('a trip cannot be added for a time that has already passed', pastTrip.status === 400, `status ${pastTrip.status}`)
const leftTrip = await db.collection('buses').insertOne({
  fleetId: fleetBus._id, companyId: green.id, companyName: green.name, busName: fleetBus.name, busType: 'AC',
  from: 'Dhaka', to: 'Sylhet', date: dhakaToday, departureTime: '00:00', arrivalTime: '', price: 900,
  totalSeats: 36, bookedSeats: [], blockedSeats: [], commissionRate: 10, status: 'active', createdAt: new Date().toISOString(),
})
const lateBooking = await call('/api/bookings', { method: 'POST', body: { busId: leftTrip.insertedId.toString(), seats: ['1A'], passengerName: 'Late', passengerPhone: '01811111112' } })
check('a trip that has already left cannot be booked', lateBooking.status === 410, `status ${lateBooking.status}`)
const leftSearch = await call(`/api/buses?from=Dhaka&to=Sylhet&date=${dhakaToday}`)
check('a trip that has already left is not in search', !leftSearch.data.buses.some((b) => b._id === leftTrip.insertedId.toString()))

const rename = await call(`/api/buses/${trip._id}`, { method: 'PATCH', cookie: admin, body: { busName: 'Renamed', companyName: 'Other' } })
const afterRename = await db.collection('buses').findOne({ _id: new ObjectId(trip._id) })
check('a trip\'s bus name cannot be edited by hand', rename.status < 500 && afterRename.busName === fleetBus.name, afterRename.busName)

// ---- Booking: one seat, one passenger ----
// A new phone number each time, so the per-number limits (tested on their own below) stay out of the way.
let phoneSeq = 0
const passenger = () => ({ passengerName: 'Test Passenger', passengerPhone: `0181${String(Date.now() % 1e4).padStart(4, '0')}${String(++phoneSeq).padStart(3, '0')}` })
const race = await Promise.all(
  Array.from({ length: 25 }, () => call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['1A'], ...passenger() } }))
)
const winners = race.filter((r) => r.status === 201)
check('25 people grab seat 1A at the same moment: exactly one gets it', winners.length === 1, `${winners.length} succeeded`)
check('everyone else is told the seat is taken', race.filter((r) => r.status === 409).length === 24)

const dupSeats = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['2A', '2A'], ...passenger() } })
check('the same seat twice in one booking is refused', dupSeats.status === 400, `status ${dupSeats.status}`)
const ghostSeat = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['99Z'], ...passenger() } })
check('a seat that does not exist on the bus is refused', ghostSeat.status === 400, `status ${ghostSeat.status}`)
const outOfRange = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['10A'], ...passenger() } })
check('a seat beyond the bus\'s seat count is refused', outOfRange.status === 400, `status ${outOfRange.status}`)

const booking = winners[0].data.booking
const unpaidScan = await call('/api/scan', { method: 'POST', cookie: green.scan, body: { text: booking.bookingCode } })
check('an unpaid ticket does not board', unpaidScan.data?.result === 'unpaid', unpaidScan.data?.result)

const paid = await call(`/api/bookings/${booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid', paymentMethod: 'bkash' } })
check('paying confirms the ticket', paid.data?.booking?.status === 'confirmed', JSON.stringify(paid.data))

const unpay = await call(`/api/bookings/${booking._id}`, { method: 'PATCH', body: { paymentStatus: 'pending' } })
const stillPaid = await db.collection('bookings').findOne({ _id: new ObjectId(booking._id) })
check('a paid ticket cannot be switched back to unpaid', unpay.status >= 400 && stillPaid.paymentStatus === 'paid', `status ${unpay.status}`)

// ---- Scanning: one ticket, one boarding ----
const scans = await Promise.all(
  Array.from({ length: 12 }, () => call('/api/scan', { method: 'POST', cookie: green.scan, body: { text: `http://x/verify/${booking.bookingCode}` } }))
)
const valid = scans.filter((s) => s.data?.result === 'valid')
check('12 phones scan the same ticket at once: it boards exactly once', valid.length === 1, `${valid.length} valid`)
check('the other 11 scans say "already used"', scans.filter((s) => s.data?.result === 'already_used').length === 11)

const screenshot = await call('/api/scan', { method: 'POST', cookie: green.scan, body: { text: booking.bookingCode.toLowerCase() } })
check('a copied screenshot scanned later says "already used"', screenshot.data?.result === 'already_used', screenshot.data?.result)
check('scanner shows the real passenger and seat from BusHub, not what is printed',
  screenshot.data?.ticket?.passengerName === 'Test Passenger' && screenshot.data?.ticket?.seats?.join() === '1A')

const otherOp = await call('/api/scan', { method: 'POST', cookie: hanif.scan, body: { text: booking.bookingCode } })
check('another company\'s scanner rejects the ticket', otherOp.data?.result === 'other_operator', otherOp.data?.result)
check('and does not see the passenger\'s details', otherOp.data?.ticket === null)

const fake = await call('/api/scan', { method: 'POST', cookie: green.scan, body: { text: `BH-${dhakaToday.replace(/-/g, '')}-ZZZZZ` } })
check('a made-up ticket code is "not found"', fake.data?.result === 'not_found', fake.data?.result)
const junk = await call('/api/scan', { method: 'POST', cookie: green.scan, body: { text: 'https://evil.example/ticket' } })
check('a random QR code is "not found"', junk.data?.result === 'not_found', junk.data?.result)
const anon = await call('/api/scan', { method: 'POST', body: { text: booking.bookingCode } })
check('nobody can scan without logging in', anon.status === 401, `status ${anon.status}`)
const publicCheckin = await call(`/api/verify/${booking.bookingCode}`, { method: 'PATCH' })
check('the public ticket page cannot check a ticket in', publicCheckin.status === 405 || publicCheckin.status === 404, `status ${publicCheckin.status}`)

// ---- Refunds ----
const b2 = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['3A', '3B'], ...passenger() } })
await call(`/api/bookings/${b2.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid', paymentMethod: 'nagad' } })
const companyRefund = await call(`/api/bookings/${b2.data.booking._id}/refund`, { method: 'PATCH', cookie: green.cookie })
check('a bus company cannot refund (admin only)', companyRefund.status === 403, `status ${companyRefund.status}`)
const refunds = await Promise.all(Array.from({ length: 5 }, () => call(`/api/bookings/${b2.data.booking._id}/refund`, { method: 'PATCH', cookie: admin })))
check('refunding the same ticket 5 times at once only refunds once', refunds.filter((r) => r.status === 200).length === 1,
  refunds.map((r) => r.status).join(','))
const refundedScan = await call('/api/scan', { method: 'POST', cookie: green.scan, body: { text: b2.data.booking.bookingCode } })
check('a refunded ticket does not board', refundedScan.data?.result === 'refunded', refundedScan.data?.result)
const boardedRefund = await call(`/api/bookings/${booking._id}/refund`, { method: 'PATCH', cookie: admin })
check('a ticket that already boarded cannot be refunded (its seat is in use)', boardedRefund.status === 409, `status ${boardedRefund.status}`)

// ---- Expired holds ----
const hold = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['4A'], ...passenger() } })
await db.collection('bookings').updateOne({ _id: new ObjectId(hold.data.booking._id) }, { $set: { holdExpiresAt: new Date(Date.now() - 1000).toISOString() } })
const latePay = await call(`/api/bookings/${hold.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid', paymentMethod: 'bkash' } })
check('paying after the 10-minute hold ran out is refused', latePay.status === 410, `status ${latePay.status}`)
const rebook = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['4A'], ...passenger() } })
check('the released seat can be bought by someone else', rebook.status === 201, `status ${rebook.status}`)
const oldPayAgain = await call(`/api/bookings/${hold.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
check('the expired hold still cannot be paid once the seat is resold', oldPayAgain.status === 410, `status ${oldPayAgain.status}`)

// Expired holds released by many requests at once must not free a seat someone just bought.
for (let round = 0; round < 5; round++) {
  const seat = `${5 + round}C`
  const h = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: [seat], ...passenger() } })
  await db.collection('bookings').updateOne({ _id: new ObjectId(h.data.booking._id) }, { $set: { holdExpiresAt: new Date(Date.now() - 1000).toISOString() } })
  await Promise.all([
    ...Array.from({ length: 6 }, () => call(`/api/buses/${trip._id}`)),
    ...Array.from({ length: 6 }, () => call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: [seat], ...passenger() } })),
    ...Array.from({ length: 6 }, () => call(`/api/buses/${trip._id}`)),
  ])
}

// ---- Admin seat blocking can't take a sold seat ----
const blockSold = await call(`/api/buses/${trip._id}/seats`, { method: 'PATCH', cookie: admin, body: { seats: ['1A'], action: 'block' } })
check('admin cannot mark a BusHub-sold seat as counter-sold', blockSold.status === 409, `status ${blockSold.status}`)
await call(`/api/buses/${trip._id}/seats`, { method: 'PATCH', cookie: admin, body: { seats: ['9D'], action: 'block' } })
const counterSeat = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['9D'], ...passenger() } })
check('a counter-sold seat cannot be bought online', counterSeat.status === 409, `status ${counterSeat.status}`)

// ---- Older trips (from before the bus list) can be linked so their tickets match ----
const legacy = await db.collection('buses').insertOne({
  companyId: 'admin', companyName: 'green line typed', busName: 'GL typed by hand', busType: 'AC',
  from: 'Dhaka', to: 'Khulna', date: dhakaToday, departureTime: '23:50', arrivalTime: '', price: 800,
  totalSeats: 36, bookedSeats: [], blockedSeats: [], commissionRate: 10, status: 'active', createdAt: new Date().toISOString(),
})
const legacyId = legacy.insertedId.toString()
const lb = await call('/api/bookings', { method: 'POST', body: { busId: legacyId, seats: ['2B'], ...passenger() } })
await call(`/api/bookings/${lb.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
const beforeLink = await call('/api/scan', { method: 'POST', cookie: green.scan, body: { text: lb.data.booking.bookingCode } })
check('an unlinked old trip is refused by the company scanner', beforeLink.data?.result === 'other_operator', beforeLink.data?.result)
const link = await call(`/api/buses/${legacyId}`, { method: 'PATCH', cookie: admin, body: { fleetId: fleetBus._id } })
check('admin links the old trip to a bus from the list', link.status === 200, JSON.stringify(link.data))
const linkedTicket = await db.collection('bookings').findOne({ _id: new ObjectId(lb.data.booking._id) })
check('its existing tickets now carry the listed bus and company name',
  linkedTicket.busName === fleetBus.name && linkedTicket.companyName === green.name, `${linkedTicket.busName} / ${linkedTicket.companyName}`)
const afterLink = await call('/api/scan', { method: 'POST', cookie: green.scan, body: { text: lb.data.booking.bookingCode } })
check('and the company can scan them', afterLink.data?.result === 'valid', afterLink.data?.result)
const relink = await call(`/api/buses/${legacyId}`, { method: 'PATCH', cookie: admin, body: { fleetId: fleetBus._id } })
check('a linked trip cannot be moved to another bus', relink.status === 409, `status ${relink.status}`)

// ---- A schedule change reaches the tickets already sold ----
await call(`/api/buses/${trip._id}`, { method: 'PATCH', cookie: admin, body: { departureTime: '23:45' } })
const moved = await db.collection('bookings').findOne({ _id: new ObjectId(booking._id) })
check('changing a trip\'s time updates its tickets', moved.departureTime === '23:45', moved.departureTime)

const delTrip = await call(`/api/buses/${trip._id}`, { method: 'DELETE', cookie: admin })
check('a trip with live tickets cannot be deleted', delTrip.status === 409, `status ${delTrip.status}`)
const delFleet = await call(`/api/fleet/${fleetBus._id}`, { method: 'DELETE', cookie: admin })
check('a listed bus with trips cannot be removed', delFleet.status === 409, `status ${delFleet.status}`)

// ---- Ticket codes: long and hard to guess; tickets with the old short codes still scan ----
const newest = await db.collection('bookings').findOne({ busId: trip._id }, { sort: { createdAt: -1 } })
check('new ticket codes have 10 random characters, no 0/O or 1/I', /^BH-\d{8}-[A-HJ-NP-Z2-9]{10}$/.test(newest.bookingCode), newest.bookingCode)
const oldStyle = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['8A'], ...passenger() } })
await call(`/api/bookings/${oldStyle.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
const shortCode = `BH-${dhakaToday.replace(/-/g, '')}-${run.slice(-5).padStart(5, 'Q')}`
await db.collection('bookings').updateOne({ _id: new ObjectId(oldStyle.data.booking._id) }, { $set: { bookingCode: shortCode } })
const oldScan = await call('/api/scan', { method: 'POST', cookie: green.scan, body: { text: `https://www.bushubbd.com/verify/${shortCode}` } })
check('a ticket with an old 5-character code still scans as valid', oldScan.data?.result === 'valid', oldScan.data?.result)

// ---- One phone number can't buy up a bus or keep seats locked without paying ----
const tomorrow = new Date(Date.now() + 30 * 3600e3).toISOString().slice(0, 10)
const limitTrip = (await call('/api/buses', { method: 'POST', cookie: admin, body: { fleetId: fleetBus._id, from: 'Dhaka', to: 'Sylhet', date: tomorrow, departureTime: '08:15', price: 900 } })).data.bus
const book = (seats, phone) => call('/api/bookings', { method: 'POST', body: { busId: limitTrip._id, seats, passengerName: 'Limit Test', passengerPhone: phone } })
const num = `0171${String(Date.now() % 1e7).padStart(7, '0')}`
const first = await book(['1A', '1B', '1C', '1D'], num)
check('one number books 4 seats', first.status === 201, JSON.stringify(first.data))
const over = await book(['2A', '2B', '2C'], `+880 ${num.slice(1, 5)}-${num.slice(5)}`)
check('the same number typed as +880 can\'t go past 6 seats on one bus', over.status === 429 && /at most 6 seats/.test(over.data.error), JSON.stringify(over.data))
const fits = await book(['2A', '2B'], `88${num}`)
check('it can still take the 2 seats left of its 6', fits.status === 201, JSON.stringify(fits.data))
const thirdHold = await book(['5A'], num)
check('a third unpaid booking from one number is refused', thirdHold.status === 429 && /unpaid/.test(thirdHold.data.error), JSON.stringify(thirdHold.data))
await call(`/api/bookings/${first.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
await call(`/api/bookings/${fits.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
const seventh = await book(['7A'], num)
check('after paying, the number still can\'t buy a 7th seat on that bus', seventh.status === 429 && /at most 6 seats/.test(seventh.data.error), JSON.stringify(seventh.data))
const racer = `0172${String(Date.now() % 1e7).padStart(7, '0')}`
const rush = await Promise.all(['A', 'B', 'C', 'D'].flatMap((col) => [book([`8${col}`, `9${col}`], racer)]))
const won = rush.filter((r) => r.status === 201)
check('4 bookings from one number at the same moment: at most 2 unpaid go through', won.length >= 1 && won.length <= 2, `${won.length} went through: ${rush.map((r) => `${r.status} ${r.data?.error || ''}`).join(' | ')}`)
check('any leftover seats from refused bookings are back on sale', await (async () => {
  const t = await db.collection('buses').findOne({ _id: new ObjectId(limitTrip._id) })
  const held = (await db.collection('bookings').find({ busId: limitTrip._id, status: { $in: ['pending', 'confirmed'] } }).toArray()).flatMap((b) => b.seats)
  return t.bookedSeats.length === held.length && t.bookedSeats.every((x) => held.includes(x))
})())

// ---- Nobody can try code after code until a real ticket turns up ----
for (let i = 0; i < 20; i++) {
  await call('/api/scan', { method: 'POST', cookie: hanif.scan, body: { text: `BH-${dhakaToday.replace(/-/g, '')}-ZZ${String(i).padStart(3, '0')}` } })
}
const blocked = await call('/api/scan', { method: 'POST', cookie: hanif.scan, body: { text: `BH-${dhakaToday.replace(/-/g, '')}-ZZZZY` } })
check('after 20 wrong codes the scanner login has to wait', blocked.status === 429, `status ${blocked.status}`)
const verifyAs = (ip, code) => fetch(`${BASE}/api/verify/${code}`, { headers: { 'x-forwarded-for': ip } })
const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`
for (let i = 0; i < 60; i++) await verifyAs(ip, `BH-20260101-QQ${String(i).padStart(3, '0')}`)
check('after 60 wrong codes the public ticket check makes that connection wait', (await verifyAs(ip, 'BH-20260101-QQQQQ')).status === 429)
check('other connections can still check tickets', (await verifyAs('198.51.100.7', 'BH-20260101-QQQQQ')).status === 404)

// ---- Company logins: management, counter and scanner ----
const managerScan = await call('/api/scan', { method: 'POST', cookie: green.cookie, body: { text: booking.bookingCode } })
check('the manager login cannot scan (scanner logins do)', managerScan.status === 403, `status ${managerScan.status}`)
const greenScans = await call('/api/scan', { cookie: green.cookie })
const greenScanners = greenScans.data?.byScanner || []
const greenOwn = (await call('/api/scan', { cookie: green.scan })).data
check(
  "the manager sees each scanner's counts, and they add up to the company's",
  greenScanners.length > 0 &&
    greenScanners.reduce((n, r) => n + r.week.passengers, 0) === greenScans.data.week.passengers &&
    greenScanners.reduce((n, r) => n + r.week.rejected, 0) === greenScans.data.week.rejected,
  JSON.stringify(greenScanners)
)
const hanifScanners = (await call('/api/scan', { cookie: hanif.cookie })).data?.byScanner || []
check(
  "a scanner sees only its own counts, and no company sees another's scanners",
  greenOwn && !('byScanner' in greenOwn) && !hanifScanners.some((h) => greenScanners.some((g) => g.name === h.name)),
  JSON.stringify(hanifScanners)
)
const mkStaff = (owner, label, role) =>
  call('/api/company/staff', { method: 'POST', cookie: owner.cookie, body: { name: `${label} ${run}`, email: `${label.replace(/\W/g, '').toLowerCase()}.${run.toLowerCase()}@test.local`, role } })
const c1 = await mkStaff(green, 'Dampara counter', 'counter')
const c2 = await mkStaff(green, 'GEC counter', 'counter')
const hc = await mkStaff(hanif, 'Hanif counter', 'counter')
check('the manager adds counter logins (password shown once)', c1.status === 201 && !!c1.data.password && !c1.data.staff.passwordHash, JSON.stringify(c1.data))
const dupEmail = await call('/api/company/staff', { method: 'POST', cookie: green.cookie, body: { name: 'Copy', email: green.email.toUpperCase(), role: 'counter' } })
check('a staff login cannot reuse a company email', dupEmail.status === 409, `status ${dupEmail.status}`)
const staffBySomeoneElse = await call('/api/company/staff', { method: 'POST', cookie: green.scan, body: { name: 'Sneaky', email: `sneaky${run}@test.local`, role: 'counter' } })
check('only the manager can add staff logins', staffBySomeoneElse.status === 403, `status ${staffBySomeoneElse.status}`)
const loginAs = async (s) => (await call('/api/company/login', { method: 'POST', body: { email: s.data.staff.email, password: s.data.password } })).cookie
const counter1 = await loginAs(c1)
const counter2 = await loginAs(c2)
const hanifCounter = await loginAs(hc)
const counterScan = await call('/api/scan', { method: 'POST', cookie: counter1, body: { text: booking.bookingCode } })
check('a counter login cannot scan', counterScan.status === 403, `status ${counterScan.status}`)
const counterBookings = await call('/api/bookings?as=company', { cookie: counter1 })
check('a counter login cannot list passengers', counterBookings.status === 403, `status ${counterBookings.status}`)

const tomorrowRoles = new Date(Date.now() + 30 * 3600e3).toISOString().slice(0, 10)
const counterTrip = await call('/api/company/trips', { method: 'POST', cookie: counter1, body: { fleetId: fleetBus._id, from: 'Dhaka', to: 'Sylhet', date: tomorrowRoles, departureTime: '06:40', price: 700, boardingPoint: 'Dampara counter' } })
check('a counter adds a trip for its own bus', counterTrip.status === 201, JSON.stringify(counterTrip.data))
const foreignTrip = await call('/api/company/trips', { method: 'POST', cookie: hanifCounter, body: { fleetId: fleetBus._id, from: 'Dhaka', to: 'Sylhet', date: tomorrowRoles, departureTime: '06:50', price: 700 } })
check('a counter cannot add a trip for another company\'s bus', foreignTrip.status === 403, `status ${foreignTrip.status}`)
const ct = counterTrip.data.bus._id
const sell = (cookie, seats, action = 'sell') => call(`/api/company/trips/${ct}/seats`, { method: 'PATCH', cookie, body: { seats, action } })
const s1 = await sell(counter1, ['4D'])
check('a counter sells seat 4D', s1.status === 200 && s1.data.bus.blockedSeats.includes('4D'), JSON.stringify(s1.data))
const s2 = await sell(counter2, ['4D'])
check('another counter cannot sell 4D again', s2.status === 409, `status ${s2.status}`)
const onlineOn4D = await call('/api/bookings', { method: 'POST', body: { busId: ct, seats: ['4D'], passengerName: 'Online', passengerPhone: '01911111111' } })
check('nobody can buy 4D online after the counter sold it', onlineOn4D.status === 409, `status ${onlineOn4D.status}`)
const onlineSeat = await call('/api/bookings', { method: 'POST', body: { busId: ct, seats: ['2B'], passengerName: 'Online', passengerPhone: '01911111112' } })
await call(`/api/bookings/${onlineSeat.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
const counterOnOnline = await sell(counter1, ['2B'])
check('a counter cannot sell a seat sold on BusHub', counterOnOnline.status === 409, `status ${counterOnOnline.status}`)
const seatRace = await Promise.all([sell(counter1, ['6A']), sell(counter2, ['6A']), call('/api/bookings', { method: 'POST', body: { busId: ct, seats: ['6A'], passengerName: 'Racer', passengerPhone: '01911111113' } })])
check('two counters and a customer grab 6A at once: exactly one gets it', seatRace.filter((r) => r.status === 200 || r.status === 201).length === 1, seatRace.map((r) => r.status).join(','))
const foreignSell = await call(`/api/company/trips/${ct}/seats`, { method: 'PATCH', cookie: hanifCounter, body: { seats: ['7A'], action: 'sell' } })
check('another company\'s counter cannot touch this trip', foreignSell.status === 403, `status ${foreignSell.status}`)
const undoOther = await sell(counter2, ['4D'], 'unsell')
check('a counter cannot undo another counter\'s sale', undoOther.status === 403, `status ${undoOther.status}`)
const managerView = await call('/api/company/trips', { cookie: green.cookie })
check('the company sees its buses with their number plates', managerView.data.fleet.some((f) => f._id === fleetBus._id && /^CHATTA METRO-HA/.test(f.plateNumber)) && managerView.data.fleet.some((f) => f.plateNumber === plateNo))
const seenTrip = managerView.data.trips.find((t) => t._id === ct)
check('the manager sees who sold 4D and the BusHub seat', seenTrip?.counterSeats.some((c) => c.seat === '4D' && c.soldBy === `Dampara counter ${run}`) && seenTrip.onlineSeats.includes('2B'), JSON.stringify(seenTrip))
const managerUndo = await sell(green.cookie, ['4D'], 'unsell')
check('the manager can undo any counter sale', managerUndo.status === 200 && !managerUndo.data.bus.blockedSeats.includes('4D'))
const ownUndo = await sell(counter1, ['7C'])
const ownUndo2 = await sell(counter1, ['7C'], 'unsell')
check('a counter can undo its own sale', ownUndo.status === 200 && ownUndo2.status === 200)
await call(`/api/company/staff/${c2.data.staff._id}`, { method: 'PATCH', cookie: green.cookie, body: { status: 'disabled' } })
const afterOff = await call('/api/company/trips', { cookie: counter2 })
const loginOff = await call('/api/company/login', { method: 'POST', body: { email: c2.data.staff.email, password: c2.data.password } })
check('a switched-off login stops working at once and cannot sign in', afterOff.status === 401 && loginOff.status === 403, `${afterOff.status} ${loginOff.status}`)

// ---- Sales sheet: older trips on request ----
const dayShift = (n) => new Date(Date.parse(`${dhakaToday}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10)
const oldTripDoc = (date) => ({
  fleetId: fleetBus._id, companyId: green.id, companyName: green.name, busName: fleetBus.name, busType: 'AC',
  from: 'Dhaka', to: 'Sylhet', date, departureTime: '08:00', arrivalTime: '', price: 900,
  totalSeats: 36, bookedSeats: [], blockedSeats: [], commissionRate: 10, status: 'active', createdAt: new Date().toISOString(),
})
const oldTrip = (await db.collection('buses').insertOne(oldTripDoc(dayShift(60)))).insertedId.toString()
const ancientTrip = (await db.collection('buses').insertOne(oldTripDoc(dayShift(500)))).insertedId.toString()
const hasTrip = (res, id) => (res.data?.trips || []).some((t) => t._id === id)
check('the manager\'s trips stop at 30 days unless an older date is asked for', !hasTrip(await call('/api/company/trips', { cookie: green.cookie }), oldTrip))
const since90 = await call(`/api/company/trips?since=${dayShift(90)}`, { cookie: green.cookie })
check('picking an older From date brings older trips', hasTrip(since90, oldTrip) && !hasTrip(since90, ancientTrip))
check('no further back than 400 days', !hasTrip(await call(`/api/company/trips?since=${dayShift(900)}`, { cookie: green.cookie }), ancientTrip))
const counterOld = await call(`/api/company/trips?since=${dayShift(90)}`, { cookie: counter1 })
check('a counter login still gets only trips to come', counterOld.status === 200 && !hasTrip(counterOld, oldTrip))
check('admin money reaches older trips when asked', hasTrip(await call(`/api/admin/trip-money?since=${dayShift(90)}`, { cookie: admin }), oldTrip) && !hasTrip(await call('/api/admin/trip-money', { cookie: admin }), oldTrip))
check('a bad date is ignored', !hasTrip(await call('/api/company/trips?since=x', { cookie: green.cookie }), oldTrip))

// ---- Admin bookings by date, with the customer's details ----
const oldBooking = await db.collection('bookings').insertOne({
  bookingCode: `BH-OLD-${run}`, busId: oldTrip, busName: fleetBus.name, companyName: green.name, from: 'Dhaka', to: 'Sylhet', date: dayShift(60), departureTime: '08:00',
  seats: ['1A'], totalPrice: 900, commissionRate: 10, commissionAmount: 90, companyPayout: 810, passengerName: 'Old Buyer', passengerPhone: '01700000001',
  passengerEmail: 'old@buyer.test', paymentStatus: 'paid', paymentMethod: 'bkash', status: 'confirmed', qrCode: 'x', source: 'web',
  createdAt: new Date(Date.parse(`${dayShift(70)}T10:00:00+06:00`)).toISOString(), checkedIn: false,
})
const hasBooking = (res) => (res.data?.bookings || []).find((b) => b.bookingCode === `BH-OLD-${run}`)
check('only the admin can list bookings with customer details', (await call(`/api/admin/bookings?from=${dayShift(61)}`, { cookie: green.cookie })).status === 401)
const byTravel = hasBooking(await call(`/api/admin/bookings?from=${dayShift(61)}&to=${dayShift(59)}`, { cookie: admin }))
check('bookings by travel date, older than the latest 200, with email and payment', byTravel?.passengerEmail === 'old@buyer.test' && byTravel.paymentMethod === 'bkash' && !('qrCode' in byTravel))
check('bookings by the day bought', !hasBooking(await call(`/api/admin/bookings?from=${dayShift(61)}&to=${dayShift(59)}&by=booked`, { cookie: admin })) && Boolean(hasBooking(await call(`/api/admin/bookings?from=${dayShift(70)}&to=${dayShift(70)}&by=booked`, { cookie: admin }))))
check('a bad booking date is refused', (await call('/api/admin/bookings?from=yesterday', { cookie: admin })).status === 400)
await db.collection('bookings').deleteOne({ _id: oldBooking.insertedId })

// ---- Trip costs: bus staff and the manager enter them; the money adds up ----
const addCost = (cookie, tripId, type, amount, note = '') => call('/api/company/costs', { method: 'POST', cookie, body: { tripId, type, amount, note } })
const fuel = await addCost(green.scan, ct, 'fuel', 3500, 'Meghna pump')
check('bus staff (scanner) add a fuel cost to their trip', fuel.status === 201 && fuel.data.cost.amount === 3500 && fuel.data.cost.addedBy === `Green Line ${run} gate`, JSON.stringify(fuel.data))
const road = await addCost(green.cookie, ct, 'road', 800)
check('the manager adds a road cost', road.status === 201)
check('a counter login cannot add costs', (await addCost(counter1, ct, 'toll', 100)).status === 403)
check("another company's bus staff cannot add costs to this trip", (await addCost(hanif.scan, ct, 'toll', 100)).status === 404)
const badCosts = await Promise.all([addCost(green.scan, ct, 'fuel', -5), addCost(green.scan, ct, 'fuel', 12.5), addCost(green.scan, ct, 'fuel', 'abc'), addCost(green.scan, ct, 'fuel', 600000), addCost(green.scan, ct, 'party', 100)])
check('wrong amounts and cost types are refused', badCosts.every((r) => r.status === 400), badCosts.map((r) => r.status).join(','))
const laterDate = new Date(Date.now() + 6 * 3600e3 + 5 * 86400e3).toISOString().slice(0, 10)
const laterTrip = await call('/api/company/trips', { method: 'POST', cookie: green.cookie, body: { fleetId: fleetBus._id, from: 'Dhaka', to: 'Sylhet', date: laterDate, departureTime: '09:10', price: 700 } })
check('bus staff can only add costs for yesterday, today and tomorrow', (await addCost(green.scan, laterTrip.data.bus._id, 'fuel', 100)).status === 403)
check('the manager can add costs to any of the company trips', (await addCost(green.cookie, laterTrip.data.bus._id, 'toll', 250)).status === 201)
const staffCosts = (await call('/api/company/costs', { cookie: green.scan })).data
const hanifCosts = (await call('/api/company/costs', { cookie: hanif.scan })).data
check(
  'bus staff see their own trips and costs, never another company',
  staffCosts.trips.some((t) => t._id === ct) && staffCosts.costs.some((c) => c._id === fuel.data.cost._id) && !hanifCosts.trips.some((t) => t._id === ct) && !hanifCosts.costs.some((c) => c.busId === ct)
)
const typo = await addCost(green.scan, ct, 'toll', 9999)
check('bus staff can take back their own cost straight away', (await call(`/api/company/costs/${typo.data.cost._id}`, { method: 'DELETE', cookie: green.scan })).status === 200)
check("bus staff cannot remove the manager's cost", (await call(`/api/company/costs/${road.data.cost._id}`, { method: 'DELETE', cookie: green.scan })).status === 403)
const oldCost = await addCost(green.scan, ct, 'toll', 120)
await db.collection('tripCosts').updateOne({ _id: new ObjectId(oldCost.data.cost._id) }, { $set: { createdAt: new Date(Date.now() - 2 * 3600e3).toISOString() } })
check('after an hour only the manager can remove a cost', (await call(`/api/company/costs/${oldCost.data.cost._id}`, { method: 'DELETE', cookie: green.scan })).status === 403)
check("another company's manager cannot remove it", (await call(`/api/company/costs/${oldCost.data.cost._id}`, { method: 'DELETE', cookie: hanif.cookie })).status === 404)
check('the manager can remove any cost', (await call(`/api/company/costs/${oldCost.data.cost._id}`, { method: 'DELETE', cookie: green.cookie })).status === 200)
const withCosts = (await call('/api/company/trips', { cookie: green.cookie })).data.trips.find((t) => t._id === ct)
check(
  'the manager sees the costs and what each BusHub passenger paid',
  withCosts.costs.map((c) => c.amount).sort().join(',') === '3500,800' && withCosts.onlineTickets.every((t) => t.total > 0 && t.payout > 0 && t.payout <= t.total),
  JSON.stringify(withCosts.costs)
)
check('only the admin can see every company\'s trip money', (await call('/api/admin/trip-money', { cookie: green.cookie })).status === 401)
const adminMoney = (await call('/api/admin/trip-money', { cookie: admin })).data.trips.find((t) => t._id === ct)
const tripDoc = await db.collection('buses').findOne({ _id: new ObjectId(ct) })
const paidHere = await db.collection('bookings').find({ busId: ct, status: 'confirmed', paymentStatus: 'paid' }).toArray()
const paidTotal = paidHere.reduce((n, b) => n + b.totalPrice, 0)
const paidPayout = paidHere.reduce((n, b) => n + b.companyPayout, 0)
check(
  'admin trip money adds up (counter at full price, BusHub total = commission + payout) and shows no company costs',
  adminMoney.counter.total === (tripDoc.blockedSeats || []).length * 700 &&
    adminMoney.online.total === paidTotal &&
    adminMoney.online.payout === paidPayout &&
    adminMoney.online.commission === paidTotal - paidPayout &&
    adminMoney.pay.owed === paidPayout &&
    !('costs' in adminMoney) && !('money' in adminMoney),
  JSON.stringify(adminMoney)
)
const companyBookings = (await call('/api/bookings?as=company', { cookie: green.cookie })).data.bookings
const managerTrips = (await call('/api/company/trips', { cookie: green.cookie })).data.trips
check(
  "the company sees its tickets but never the passenger's name, phone or email",
  companyBookings.length > 0 &&
    companyBookings.every((b) => !('passengerName' in b) && !('passengerPhone' in b) && !('passengerEmail' in b) && b.bookingCode) &&
    managerTrips.every((t) => (t.onlineTickets || []).every((x) => !('passengerName' in x) && x.code))
)

// ---- Paying the bus companies: invoices, payment, the company's signature ----
const payPhone = () => '0193' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0')
const payDay = new Date(Date.now() + 30 * 3600e3).toISOString().slice(0, 10)
const payTripRes = await call('/api/company/trips', { method: 'POST', cookie: green.cookie, body: { fleetId: fleetBus._id, from: 'Dhaka', to: 'Rajshahi', date: payDay, departureTime: '07:05', price: 900 } })
const payTrip = payTripRes.data.bus._id
const payBooking = async (seats) => {
  const b = await call('/api/bookings', { method: 'POST', body: { busId: payTrip, seats, passengerName: 'Payout Test', passengerPhone: payPhone() } })
  await call(`/api/bookings/${b.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
  return b.data.booking
}
const pb1 = await payBooking(['1A', '1B'])
const pb2 = await payBooking(['2A'])
const payTrip2 = (await call('/api/company/trips', { method: 'POST', cookie: green.cookie, body: { fleetId: fleetBus._id, from: 'Dhaka', to: 'Rajshahi', date: payDay, departureTime: '15:25', price: 900 } })).data.bus._id
const b3 = await call('/api/bookings', { method: 'POST', body: { busId: payTrip2, seats: ['3A'], passengerName: 'Payout Test', passengerPhone: payPhone() } })
await call(`/api/bookings/${b3.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
const pb3 = b3.data.booking
const owedBefore = (await call('/api/company/payouts', { cookie: green.cookie })).data
check('tickets on a trip that has not left are owed later, not now', owedBefore.later.tickets >= 2 && owedBefore.later.payout > 0, JSON.stringify(owedBefore.later))
// The bus leaves: move the trip (and its tickets) to yesterday.
const yesterday = new Date(Date.now() + 6 * 3600e3 - 86400e3).toISOString().slice(0, 10)
await db.collection('buses').updateOne({ _id: new ObjectId(payTrip) }, { $set: { date: yesterday } })
await db.collection('bookings').updateMany({ busId: payTrip }, { $set: { date: yesterday } })
check('only the manager sees payments', (await call('/api/company/payouts', { cookie: counter1 })).status === 403 && (await call('/api/company/payouts', { cookie: green.scan })).status === 403)
check('only the admin can make invoices', (await call('/api/admin/payouts', { method: 'POST', cookie: green.cookie, body: { companyId: green.id } })).status === 401)
const paidRows = await db.collection('bookings').find({ busId: payTrip, status: 'confirmed', paymentStatus: 'paid' }).toArray()
const inv1 = await call('/api/admin/payouts', { method: 'POST', cookie: admin, body: { companyId: green.id } })
const inv1Full = (await call(`/api/payouts/${inv1.data.invoice._id}`, { cookie: green.cookie })).data.invoice
const onTrip = inv1Full.lines.filter((l) => l.bookingId === pb1._id || l.bookingId === pb2._id)
check(
  'the invoice lists every ticket with date, route, seats, price, commission and what the company gets',
  inv1.status === 201 && onTrip.length === 2 &&
    onTrip.every((l) => l.date === yesterday && l.from === 'Dhaka' && l.to === 'Rajshahi' && l.seats.length > 0 && l.ticketPrice > 0 && l.payout + l.commission === l.ticketPrice),
  JSON.stringify(inv1.data)
)
check(
  'invoice totals come from the tickets in the database',
  inv1Full.totals.payout === inv1Full.lines.reduce((n, l) => n + l.payout, 0) &&
    paidRows.every((b) => inv1Full.lines.some((l) => l.bookingId === b._id.toString() && l.payout === b.companyPayout && l.ticketPrice === b.totalPrice)) &&
    inv1Full.check.contentOk === true
)
check('nothing is invoiced twice', (await call('/api/admin/payouts', { method: 'POST', cookie: admin, body: { companyId: green.id } })).status === 409)
check("another company cannot open this invoice", (await call(`/api/payouts/${inv1.data.invoice._id}`, { cookie: hanif.cookie })).status === 404 && (await call(`/api/payouts/${inv1.data.invoice._id}`, { cookie: counter1 })).status === 401)
const inv1Id = inv1.data.invoice._id
const sign = (cookie, password, id = inv1Id) => call(`/api/company/payouts/${id}`, { method: 'PATCH', cookie, body: { action: 'confirm', signedBy: 'Test Manager', password } })
check('the company cannot sign before BusHub records the payment', (await sign(green.cookie, green.password)).status === 409)
check('the company cannot mark its own invoice paid', (await call(`/api/admin/payouts/${inv1Id}`, { method: 'PATCH', cookie: green.cookie, body: { action: 'paid', method: 'bkash', reference: 'ABC12345' } })).status === 401)
check('a payment needs a proper reference', (await call(`/api/admin/payouts/${inv1Id}`, { method: 'PATCH', cookie: admin, body: { action: 'paid', method: 'bkash', reference: '<x>' } })).status === 400)
const paidRes = await call(`/api/admin/payouts/${inv1Id}`, { method: 'PATCH', cookie: admin, body: { action: 'paid', method: 'bkash', reference: '9JK4M2PQ7X', note: 'test' } })
check('the admin records the payment', paidRes.status === 200 && paidRes.data.invoice.status === 'paid' && paidRes.data.invoice.payment.amount === inv1Full.totals.payout)
check('a paid invoice cannot be cancelled', (await call(`/api/admin/payouts/${inv1Id}`, { method: 'PATCH', cookie: admin, body: { action: 'cancel' } })).status === 409)
check('a wrong password does not sign', (await sign(green.cookie, 'wrong-password')).status === 401)
check("another company's manager cannot sign it", (await sign(hanif.cookie, hanif.password)).status === 404)
const signed = await sign(green.cookie, green.password)
const afterSign = (await call(`/api/payouts/${inv1Id}`, { cookie: green.cookie })).data.invoice
check('the manager signs with the company password; the signature checks out', signed.status === 200 && afterSign.status === 'confirmed' && afterSign.check.signatureOk === true && afterSign.check.contentOk === true, JSON.stringify(signed.data))
check('a signed invoice cannot be paid again', (await call(`/api/admin/payouts/${inv1Id}`, { method: 'PATCH', cookie: admin, body: { action: 'paid', method: 'bank', reference: 'OTHER123' } })).status === 409)
await db.collection('payouts').updateOne({ _id: new ObjectId(inv1Id) }, { $set: { 'payment.reference': 'CHANGED99' } })
const tamperedRef = (await call(`/api/payouts/${inv1Id}?as=admin`, { cookie: admin })).data.invoice
await db.collection('payouts').updateOne({ _id: new ObjectId(inv1Id) }, { $set: { 'payment.reference': '9JK4M2PQ7X' }, $inc: { 'lines.0.payout': 500, 'totals.payout': 500 } })
const tamperedLine = (await call(`/api/payouts/${inv1Id}?as=admin`, { cookie: admin })).data.invoice
await db.collection('payouts').updateOne({ _id: new ObjectId(inv1Id) }, { $inc: { 'lines.0.payout': -500, 'totals.payout': -500 } })
const restored = (await call(`/api/payouts/${inv1Id}?as=admin`, { cookie: admin })).data.invoice
check(
  'any change after signing shows: a new reference breaks the signature, a changed amount breaks the record',
  tamperedRef.check.signatureOk === false && tamperedLine.check.contentOk === false && restored.check.contentOk && restored.check.signatureOk,
  JSON.stringify([tamperedRef.check, tamperedLine.check, restored.check])
)
// Two invoices made at the same moment never share a ticket.
await db.collection('buses').updateOne({ _id: new ObjectId(payTrip2) }, { $set: { date: yesterday } })
await db.collection('bookings').updateMany({ busId: payTrip2 }, { $set: { date: yesterday } })
const raceInv = await Promise.all([1, 2, 3].map(() => call('/api/admin/payouts', { method: 'POST', cookie: admin, body: { companyId: green.id } })))
const inInvoices = await db.collection('payouts').countDocuments({ 'lines.bookingId': pb3._id, status: { $ne: 'cancelled' } })
check('three invoices made at once: the new ticket lands in exactly one', raceInv.filter((r) => r.status === 201).length === 1 && inInvoices === 1, raceInv.map((r) => r.status).join(','))
const inv2Id = raceInv.find((r) => r.status === 201).data.invoice._id
const cancel = await call(`/api/admin/payouts/${inv2Id}`, { method: 'PATCH', cookie: admin, body: { action: 'cancel' } })
const freed = await db.collection('bookings').findOne({ _id: new ObjectId(pb3._id) })
check('cancelling an unpaid invoice puts its tickets back as owed', cancel.status === 200 && !freed.payoutId)
const inv3 = await call('/api/admin/payouts', { method: 'POST', cookie: admin, body: { companyId: green.id } })
await call(`/api/admin/payouts/${inv3.data.invoice._id}`, { method: 'PATCH', cookie: admin, body: { action: 'paid', method: 'nagad', reference: 'NGD778899' } })
for (let i = 0; i < 5; i++) await sign(green.cookie, `wrong-${i}`, inv3.data.invoice._id)
check('after 5 wrong passwords, signing waits even with the right one', (await sign(green.cookie, green.password, inv3.data.invoice._id)).status === 429)
const dispute = await call(`/api/company/payouts/${inv3.data.invoice._id}`, { method: 'PATCH', cookie: green.cookie, body: { action: 'dispute', note: 'Nothing arrived on Nagad yet' } })
check('the manager can report a problem with a payment', dispute.status === 200 && dispute.data.invoice.status === 'disputed')
const companyInvoice = (await call(`/api/payouts/${inv1Id}`, { cookie: green.cookie })).data.invoice
const adminInvoice = (await call(`/api/payouts/${inv1Id}?as=admin`, { cookie: admin })).data.invoice
check('on the invoice the company sees ticket codes, not passenger names', companyInvoice.lines.every((l) => l.passengerName === '' && l.code) && adminInvoice.lines.some((l) => l.passengerName))

// Paying one trip at a time; cash needs no reference.
const tripPayDay = new Date(Date.now() + 30 * 3600e3).toISOString().slice(0, 10)
const mkPayTrip = async (time) => (await call('/api/company/trips', { method: 'POST', cookie: green.cookie, body: { fleetId: fleetBus._id, from: 'Dhaka', to: 'Khulna', date: tripPayDay, departureTime: time, price: 800 } })).data.bus._id
const tripA = await mkPayTrip('05:35')
const tripB = await mkPayTrip('13:45')
for (const [trip, seat] of [[tripA, '1A'], [tripA, '1B'], [tripB, '2A']]) {
  const b = await call('/api/bookings', { method: 'POST', body: { busId: trip, seats: [seat], passengerName: 'Trip Pay', passengerPhone: payPhone() } })
  await call(`/api/bookings/${b.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
}
check('a trip that has not left cannot be paid yet', (await call('/api/admin/payouts', { method: 'POST', cookie: admin, body: { companyId: green.id, tripId: tripA } })).status === 409)
for (const t of [tripA, tripB]) {
  await db.collection('buses').updateOne({ _id: new ObjectId(t) }, { $set: { date: yesterday } })
  await db.collection('bookings').updateMany({ busId: t }, { $set: { date: yesterday } })
}
const tripInvoice = await call('/api/admin/payouts', { method: 'POST', cookie: admin, body: { companyId: green.id, tripId: tripA } })
const tripInvoiceFull = (await call(`/api/payouts/${tripInvoice.data?.invoice?._id}?as=admin`, { cookie: admin })).data?.invoice
const tripBDoc = await db.collection('bookings').findOne({ busId: tripB })
check(
  'Pay this trip: the invoice holds only that trip, other trips stay owed',
  tripInvoice.status === 201 && tripInvoiceFull.lines.length === 2 && tripInvoiceFull.lines.every((l) => l.departureTime === '05:35') && !tripBDoc.payoutId,
  JSON.stringify(tripInvoice.data)
)
check("another company's trip cannot be paid to this company", (await call('/api/admin/payouts', { method: 'POST', cookie: admin, body: { companyId: hanif.id, tripId: tripB } })).status === 409)
const tripPayState = (await call('/api/admin/trip-money', { cookie: admin })).data.trips
const stateA = tripPayState.find((t) => t._id === tripA)
const stateB = tripPayState.find((t) => t._id === tripB)
check('the admin sees which trips are invoiced and which are still owed', stateA.pay.invoiced > 0 && stateA.pay.owed === 0 && stateA.pay.invoiceId === tripInvoice.data.invoice._id && stateB.pay.owed > 0)
const tripInvoiceId = tripInvoice.data.invoice._id
check('a bKash payment still needs its TrxID', (await call(`/api/admin/payouts/${tripInvoiceId}`, { method: 'PATCH', cookie: admin, body: { action: 'paid', method: 'bkash', reference: '' } })).status === 400)
const cashPaid = await call(`/api/admin/payouts/${tripInvoiceId}`, { method: 'PATCH', cookie: admin, body: { action: 'paid', method: 'cash', reference: '' } })
check('a cash payment needs no transaction ID', cashPaid.status === 200 && cashPaid.data.invoice.payment.method === 'cash' && cashPaid.data.invoice.payment.reference === '', JSON.stringify(cashPaid.data))
const cashSigned = await sign(green.cookie, green.password, tripInvoiceId)
const cashCheck = (await call(`/api/payouts/${tripInvoiceId}`, { cookie: green.cookie })).data.invoice
check('the company signs a cash payment and the signature checks out', cashSigned.status === 200 && cashCheck.status === 'confirmed' && cashCheck.check.signatureOk === true)
const stateAfter = (await call('/api/admin/trip-money', { cookie: admin })).data.trips.find((t) => t._id === tripA)
check('a paid trip shows as paid', stateAfter.pay.paid > 0 && stateAfter.pay.owed === 0 && stateAfter.pay.invoiced === 0)

// ---- The admin can delete a booking; the record is archived ----
const removeTrip = await mkPayTrip('19:25')
const toDelete = await call('/api/bookings', { method: 'POST', body: { busId: removeTrip, seats: ['5C'], passengerName: 'Delete Me', passengerPhone: payPhone() } })
await call(`/api/bookings/${toDelete.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
check('a company cannot delete bookings', (await call(`/api/bookings/${toDelete.data.booking._id}`, { method: 'DELETE', cookie: green.cookie })).status === 403)
const deleted = await call(`/api/bookings/${toDelete.data.booking._id}`, { method: 'DELETE', cookie: admin })
const afterDelete = await db.collection('buses').findOne({ _id: new ObjectId(removeTrip) })
const archived = await db.collection('deletedBookings').findOne({ _id: new ObjectId(toDelete.data.booking._id) })
check(
  'the admin deletes a booking: it is gone, its seat is free again, and a copy is archived',
  deleted.status === 200 && !(await db.collection('bookings').findOne({ _id: new ObjectId(toDelete.data.booking._id) })) && !(afterDelete.bookedSeats || []).includes('5C') && archived?.passengerName === 'Delete Me'
)
const inInvoice = tripInvoiceFull.lines[0].bookingId
check('a ticket in a payout invoice cannot be deleted', (await call(`/api/bookings/${inInvoice}`, { method: 'DELETE', cookie: admin })).status === 409)

// ---- Correcting a payment; refunds after an invoice; where to pay the company ----
const admPatch = (id, body) => call(`/api/admin/payouts/${id}`, { method: 'PATCH', cookie: admin, body })
const edited = await admPatch(tripInvoiceId, { action: 'edit', method: 'bkash', reference: 'BK12345678', note: 'was not cash' })
const afterEdit = (await call(`/api/payouts/${tripInvoiceId}?as=admin`, { cookie: admin })).data.invoice
check(
  'correcting a signed payment sends it back to the company to sign again, with the old details in the history',
  edited.status === 200 && afterEdit.status === 'paid' && !afterEdit.confirmation && afterEdit.payment.reference === 'BK12345678' && afterEdit.history.some((h) => /Payment changed from Cash/.test(h.event) && /sign again/.test(h.event)),
  JSON.stringify(edited.data)
)
const resigned = await sign(green.cookie, green.password, tripInvoiceId)
const afterResign = (await call(`/api/payouts/${tripInvoiceId}`, { cookie: green.cookie })).data.invoice
check('the company signs the corrected payment and it checks out', resigned.status === 200 && afterResign.check.signatureOk === true)
check('a signed payment cannot just be removed', (await admPatch(tripInvoiceId, { action: 'unpay' })).status === 409)
check('a correction still needs a proper reference', (await admPatch(tripInvoiceId, { action: 'edit', method: 'nagad', reference: '' })).status === 400)
const invB = await call('/api/admin/payouts', { method: 'POST', cookie: admin, body: { companyId: green.id, tripId: tripB } })
await admPatch(invB.data.invoice._id, { action: 'paid', method: 'nagad', reference: 'NG7654321' })
const unpaid = await admPatch(invB.data.invoice._id, { action: 'unpay' })
check('a payment recorded by mistake can be removed before the company signs', unpaid.status === 200 && unpaid.data.invoice.status === 'unpaid' && !unpaid.data.invoice.payment)
const bTicket = await db.collection('bookings').findOne({ busId: tripB, status: 'confirmed' })
const refundUnpaidInv = await call(`/api/bookings/${bTicket._id}/refund`, { method: 'PATCH', cookie: admin })
const invBAfter = await db.collection('payouts').findOne({ _id: new ObjectId(invB.data.invoice._id) })
check(
  'refunding a ticket in an unpaid invoice cancels that invoice so a new one can be made',
  refundUnpaidInv.status === 200 && /cancelled/.test(refundUnpaidInv.data.note) && invBAfter.status === 'cancelled',
  JSON.stringify(refundUnpaidInv.data)
)
const aTicket = await db.collection('bookings').findOne({ busId: tripA, status: 'confirmed' })
const refundPaidInv = await call(`/api/bookings/${aTicket._id}/refund`, { method: 'PATCH', cookie: admin })
const deduction = await db.collection('payoutRefunds').findOne({ bookingId: aTicket._id.toString() })
check(
  'refunding a ticket BusHub already paid for: the company owes its payout back',
  refundPaidInv.status === 200 && /next payment/.test(refundPaidInv.data.note) && deduction?.amount === aTicket.companyPayout && deduction.companyId === green.id,
  JSON.stringify(refundPaidInv.data)
)
check('the same ticket is not taken back twice', (await call(`/api/bookings/${aTicket._id}/refund`, { method: 'PATCH', cookie: admin })).status === 409 && (await db.collection('payoutRefunds').countDocuments({ bookingId: aTicket._id.toString() })) === 1)
const greenPay = (await call('/api/company/payouts', { cookie: green.cookie })).data
const adminPay = (await call('/api/admin/payouts', { cookie: admin })).data.companies.find((c) => c._id === green.id)
check('the company and the admin both see the refund to take back', greenPay.refunds.some((r) => r.code === aTicket.bookingCode) && adminPay.refunds >= deduction.amount)
const tripC = await mkPayTrip('16:55')
for (const seat of ['3A', '3B']) {
  const b = await call('/api/bookings', { method: 'POST', body: { busId: tripC, seats: [seat], passengerName: 'Next Pay', passengerPhone: payPhone() } })
  await call(`/api/bookings/${b.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
}
await db.collection('buses').updateOne({ _id: new ObjectId(tripC) }, { $set: { date: yesterday } })
await db.collection('bookings').updateMany({ busId: tripC }, { $set: { date: yesterday } })
const invC = await call('/api/admin/payouts', { method: 'POST', cookie: admin, body: { companyId: green.id, tripId: tripC } })
const invCFull = (await call(`/api/payouts/${invC.data.invoice._id}?as=admin`, { cookie: admin })).data.invoice
const linesPayout = invCFull.lines.reduce((n, l) => n + l.payout, 0)
check(
  'the next payment takes the refund off: payout = tickets − refunds, and the record checks out',
  invC.status === 201 && invCFull.deductions.some((d) => d.code === aTicket.bookingCode) && invCFull.totals.refunds >= deduction.amount && invCFull.totals.payout === linesPayout - invCFull.totals.refunds && invCFull.check.contentOk === true,
  JSON.stringify(invCFull.totals)
)
await admPatch(invC.data.invoice._id, { action: 'cancel' })
check('cancelling that invoice puts the refund back to take later', !(await db.collection('payoutRefunds').findOne({ bookingId: aTicket._id.toString() })).payoutId)

// ---- The company reviews and approves an invoice before BusHub pays ----
const approveTrip = await mkPayTrip('20:40')
for (const seat of ['4A', '4B']) {
  const b = await call('/api/bookings', { method: 'POST', body: { busId: approveTrip, seats: [seat], passengerName: 'Approve Me', passengerPhone: payPhone() } })
  await call(`/api/bookings/${b.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
}
await db.collection('buses').updateOne({ _id: new ObjectId(approveTrip) }, { $set: { date: yesterday } })
await db.collection('bookings').updateMany({ busId: approveTrip }, { $set: { date: yesterday } })
const invD = await call('/api/admin/payouts', { method: 'POST', cookie: admin, body: { companyId: green.id, tripId: approveTrip } })
const invDId = invD.data.invoice._id
const coPatch = (cookie, body) => call(`/api/company/payouts/${invDId}`, { method: 'PATCH', cookie, body })
check('only the manager approves invoices', (await coPatch(counter1, { action: 'approve' })).status === 403 && (await coPatch(hanif.cookie, { action: 'approve' })).status === 404)
const approved = await coPatch(green.cookie, { action: 'approve' })
check('the company approves the invoice before payment', approved.status === 200 && approved.data.invoice.status === 'unpaid' && approved.data.invoice.approval?.by)
check('an invoice is approved once', (await coPatch(green.cookie, { action: 'approve' })).status === 409)
const invDFull = (await call(`/api/payouts/${invDId}?as=admin`, { cookie: admin })).data.invoice
check('the admin sees the approval, and it does not change the signed record', invDFull.approval?.by && invDFull.history.some((h) => /approved by the company/.test(h.event)) && invDFull.check.contentOk === true)
const paidD = await call(`/api/admin/payouts/${invDId}`, { method: 'PATCH', cookie: admin, body: { action: 'paid', method: 'bkash', reference: 'BKAPPROVE1' } })
const doneD = await sign(green.cookie, green.password, invDId)
check('after approval: BusHub pays, the company taps Done', paidD.status === 200 && doneD.status === 200 && doneD.data.invoice.status === 'confirmed')
const approveTrip2 = await mkPayTrip('21:55')
{
  const b = await call('/api/bookings', { method: 'POST', body: { busId: approveTrip2, seats: ['6A'], passengerName: 'Question Me', passengerPhone: payPhone() } })
  await call(`/api/bookings/${b.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
}
await db.collection('buses').updateOne({ _id: new ObjectId(approveTrip2) }, { $set: { date: yesterday } })
await db.collection('bookings').updateMany({ busId: approveTrip2 }, { $set: { date: yesterday } })
const invE = await call('/api/admin/payouts', { method: 'POST', cookie: admin, body: { companyId: green.id, tripId: approveTrip2 } })
const disputedE = await call(`/api/company/payouts/${invE.data.invoice._id}`, { method: 'PATCH', cookie: green.cookie, body: { action: 'dispute', note: 'A ticket is missing from this list' } })
const cancelE = await call(`/api/admin/payouts/${invE.data.invoice._id}`, { method: 'PATCH', cookie: admin, body: { action: 'cancel' } })
check('the company can question an invoice before payment, and the admin can then cancel it', disputedE.status === 200 && disputedE.data.invoice.status === 'disputed' && cancelE.status === 200)


// ---- Reviews and finding a lost ticket ----
const reviewPhone = `+880 1${String(Date.now()).slice(-9)}`
let reviewBooking = null
for (const seat of ['9D', '9C', '8D', '8C', '7D']) {
  const r = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: [seat], passengerName: 'Nusrat Jahan', passengerPhone: reviewPhone, passengerEmail: `nusrat.${run}@example.com` } })
  if (r.status === 201) { reviewBooking = r.data.booking; break }
}
check('a booking for the review tests is made', !!reviewBooking)
const unpaidReview = await call('/api/reviews', { method: 'POST', body: { bookingCode: reviewBooking.bookingCode, rating: 5, name: 'Nusrat' } })
check('an unpaid ticket cannot be reviewed', unpaidReview.status === 403, `status ${unpaidReview.status}`)
await call(`/api/bookings/${reviewBooking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid', paymentMethod: 'bkash' } })
const fakeReview = await call('/api/reviews', { method: 'POST', body: { bookingCode: 'BH-20990101-NOPE1', rating: 5, name: 'Fake' } })
check('a made-up ticket code cannot post a review', fakeReview.status === 403 || fakeReview.status === 404, `status ${fakeReview.status}`)
const badStars = await call('/api/reviews', { method: 'POST', body: { bookingCode: reviewBooking.bookingCode, rating: 9, name: 'Nusrat' } })
check('a rating outside 1 to 5 is refused', badStars.status === 400)
const linkReview = await call('/api/reviews', { method: 'POST', body: { bookingCode: reviewBooking.bookingCode, rating: 5, name: 'Nusrat', text: 'cheap tickets at www.spam.example' } })
check('a review with a link is refused', linkReview.status === 400)
const postReview = await call('/api/reviews', { method: 'POST', body: { bookingCode: reviewBooking.bookingCode, rating: 4, text: 'Easy booking, good seat.', name: 'Nusrat' } })
const editReview = await call('/api/reviews', { method: 'POST', body: { bookingCode: reviewBooking.bookingCode, rating: 5, text: 'Easy booking, great seat.', name: 'Nusrat J.' } })
check('a paid ticket can post a review and change it', postReview.status === 200 && editReview.status === 200)
check('one ticket has one review', (await db.collection('reviews').countDocuments({ bookingCode: reviewBooking.bookingCode })) === 1)
const publicReviews = await call('/api/reviews')
const mine = publicReviews.data?.reviews?.find((r) => r.text === 'Easy booking, great seat.')
check('the review shows on the home page list, without the ticket code', !!mine && mine.rating === 5 && !('bookingCode' in mine) && publicReviews.data.summary.count >= 1, JSON.stringify(mine))
const reviewId = (await db.collection('reviews').findOne({ bookingCode: reviewBooking.bookingCode }))._id.toString()
const outsiderHide = await call(`/api/admin/reviews/${reviewId}`, { method: 'PATCH', body: { hidden: true } })
check('only the admin can hide a review', outsiderHide.status === 401)
await call(`/api/admin/reviews/${reviewId}`, { method: 'PATCH', cookie: admin, body: { hidden: true } })
const afterHide = await call('/api/reviews')
check('a hidden review leaves the home page', !afterHide.data.reviews.some((r) => r.id === reviewId))
await call('/api/reviews', { method: 'POST', body: { bookingCode: reviewBooking.bookingCode, rating: 5, text: 'Changed again', name: 'Nusrat' } })
check('editing a hidden review does not bring it back', (await db.collection('reviews').findOne({ _id: new ObjectId(reviewId) })).hidden === true)

// Counters from an earlier run in the last ten minutes would block these requests.
await db.collection('rate_limits').deleteMany({ _id: /^ticketreq-/ })
const askFor = (contact, name, note = '') => call('/api/tickets/requests', { method: 'POST', body: { contact, name, note } })
const toBangla = (v) => v.replace(/[0-9]/g, (d) => String.fromCharCode(0x09e6 + Number(d)))
const ask1 = await askFor(toBangla(`0${reviewPhone.slice(-10)}`), 'Mst Nusrat Jahan', 'Cox trip')
const askStranger = await askFor('01999999991', 'Nobody Here')
check('a lost-ticket request gets the same answer whether or not tickets exist, and shows no ticket',
  ask1.status === 200 && askStranger.status === 200 && JSON.stringify(ask1.data) === JSON.stringify(askStranger.data) && !JSON.stringify(ask1.data).includes('BH-'),
  JSON.stringify([ask1.data, askStranger.data]))
check('a request needs a real number, email or ticket number, and a name', (await askFor('hello', 'Nusrat')).status === 400 && (await askFor('01999999992', '')).status === 400)
const askAgain = await askFor(`0${reviewPhone.slice(-10)}`, 'Nusrat')
const askSpam = await askFor(`+880 ${reviewPhone.slice(-10)}`, 'Nusrat')
check('one number can send only 2 requests in 10 minutes', askAgain.status === 200 && askSpam.status === 429, `${askAgain.status} ${askSpam.status}`)
check('only the admin can see requests', (await call('/api/admin/ticket-requests')).status === 401)
const adminReqs = await call('/api/admin/ticket-requests', { cookie: admin })
const myReq = adminReqs.data?.requests?.find((r) => r.note === 'Cox trip')
const strangerReq = adminReqs.data?.requests?.find((r) => r.name === 'Nobody Here')
check('the admin sees the request with the matching ticket and that the name fits',
  !!myReq && myReq.status === 'new' && myReq.matches.some((m) => m.bookingCode === reviewBooking.bookingCode && m.nameMatch === true && m.passengerPhone === reviewPhone),
  JSON.stringify(myReq))
check('a request for a number with no tickets shows no match', !!strangerReq && strangerReq.matches.length === 0)
check('new requests are counted for the admin badge', adminReqs.data.newCount >= 2)
const markSent = await call(`/api/admin/ticket-requests/${myReq._id}`, { method: 'PATCH', cookie: admin, body: { status: 'sent', bookingCode: reviewBooking.bookingCode, via: 'whatsapp' } })
const outsiderMark = await call(`/api/admin/ticket-requests/${strangerReq._id}`, { method: 'PATCH', body: { status: 'rejected' } })
const afterMark = (await call('/api/admin/ticket-requests', { cookie: admin })).data.requests.find((r) => r._id === myReq._id)
check('the admin can mark a request sent; nobody else can change it', markSent.status === 200 && afterMark.status === 'sent' && afterMark.sentBookingCode === reviewBooking.bookingCode && outsiderMark.status === 401)
check('the old searches that showed or sent tickets from a number are gone',
  (await call('/api/tickets/lookup', { method: 'POST', body: { contact: `0${reviewPhone.slice(-10)}`, name: 'Nusrat' } })).status === 404 &&
  (await call('/api/tickets/resend', { method: 'POST', body: { contact: `0${reviewPhone.slice(-10)}` } })).status === 404)

const sub = await call('/api/subscribe', { method: 'POST', body: { email: `Offers.${run}@Example.com` } })
const subAgain = await call('/api/subscribe', { method: 'POST', body: { email: `offers.${run}@example.com` } })
const badSub = await call('/api/subscribe', { method: 'POST', body: { email: 'not-an-email' } })
check('an email can sign up for offers once, and a bad one is refused',
  sub.status === 200 && subAgain.status === 200 && badSub.status === 400 &&
  (await db.collection('subscribers').countDocuments({ email: `offers.${run.toLowerCase()}@example.com` })) === 1)


// ---- Ticket codes are unique ----
const codes = await db.collection('bookings').aggregate([{ $group: { _id: '$bookingCode', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]).toArray()
check('no two tickets share a code', codes.length === 0, JSON.stringify(codes))
const indexes = await db.collection('bookings').indexes()
check('the database itself refuses a duplicate ticket code', indexes.some((i) => i.unique && i.key.bookingCode === 1))

// ---- The seat map and the tickets agree exactly ----
const bus = await db.collection('buses').findOne({ _id: new ObjectId(trip._id) })
const live = await db.collection('bookings').find({ busId: trip._id, status: { $in: ['pending', 'confirmed'] } }).toArray()
const liveSeats = live.flatMap((b) => b.seats)
const seatOwners = liveSeats.reduce((m, s) => m.set(s, (m.get(s) || 0) + 1), new Map())
const doubleSold = [...seatOwners].filter(([, n]) => n > 1)
check('no seat is on two live tickets', doubleSold.length === 0, JSON.stringify(doubleSold))
const missing = liveSeats.filter((s) => !bus.bookedSeats.includes(s))
check('every sold seat shows as taken on the seat map', missing.length === 0, missing.join(','))
const orphan = bus.bookedSeats.filter((s) => !liveSeats.includes(s))
check('no seat shows as taken without a ticket behind it', orphan.length === 0, orphan.join(','))
check('no seat is both counter-sold and sold on BusHub', !bus.blockedSeats.some((s) => bus.bookedSeats.includes(s)))
const tickets = await db.collection('bookings').find({ busId: trip._id }).toArray()
check('every ticket carries the fleet bus name and company name',
  tickets.every((t) => t.busName === fleetBus.name && t.companyName === green.name))

await client.close()
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
