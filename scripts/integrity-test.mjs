// End-to-end integrity test against a running BusHub server and its MongoDB.
// Checks that seats can't be sold twice, tickets can't board twice, and fakes are rejected.
//
//   BASE_URL=http://localhost:3000 MONGODB_URI=mongodb://127.0.0.1:27017 \
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/integrity-test.mjs
//
// It creates its own test companies, buses and bookings. Never point it at the live database.
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
  return { id: res.data.company._id, name, cookie: login.cookie }
}
const green = await makeCompany(`Green Line ${run}`)
const hanif = await makeCompany(`Hanif ${run}`)
check('companies created and logged in', !!green.cookie && !!hanif.cookie)

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

const rename = await call(`/api/buses/${trip._id}`, { method: 'PATCH', cookie: admin, body: { busName: 'Renamed', companyName: 'Other' } })
const afterRename = await db.collection('buses').findOne({ _id: new ObjectId(trip._id) })
check('a trip\'s bus name cannot be edited by hand', rename.status < 500 && afterRename.busName === fleetBus.name, afterRename.busName)

// ---- Booking: one seat, one passenger ----
const passenger = { passengerName: 'Test Passenger', passengerPhone: '01811111111' }
const race = await Promise.all(
  Array.from({ length: 25 }, () => call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['1A'], ...passenger } }))
)
const winners = race.filter((r) => r.status === 201)
check('25 people grab seat 1A at the same moment: exactly one gets it', winners.length === 1, `${winners.length} succeeded`)
check('everyone else is told the seat is taken', race.filter((r) => r.status === 409).length === 24)

const dupSeats = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['2A', '2A'], ...passenger } })
check('the same seat twice in one booking is refused', dupSeats.status === 400, `status ${dupSeats.status}`)
const ghostSeat = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['99Z'], ...passenger } })
check('a seat that does not exist on the bus is refused', ghostSeat.status === 400, `status ${ghostSeat.status}`)
const outOfRange = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['10A'], ...passenger } })
check('a seat beyond the bus\'s seat count is refused', outOfRange.status === 400, `status ${outOfRange.status}`)

const booking = winners[0].data.booking
const unpaidScan = await call('/api/scan', { method: 'POST', cookie: green.cookie, body: { text: booking.bookingCode } })
check('an unpaid ticket does not board', unpaidScan.data?.result === 'unpaid', unpaidScan.data?.result)

const paid = await call(`/api/bookings/${booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid', paymentMethod: 'bkash' } })
check('paying confirms the ticket', paid.data?.booking?.status === 'confirmed', JSON.stringify(paid.data))

const unpay = await call(`/api/bookings/${booking._id}`, { method: 'PATCH', body: { paymentStatus: 'pending' } })
const stillPaid = await db.collection('bookings').findOne({ _id: new ObjectId(booking._id) })
check('a paid ticket cannot be switched back to unpaid', unpay.status >= 400 && stillPaid.paymentStatus === 'paid', `status ${unpay.status}`)

// ---- Scanning: one ticket, one boarding ----
const scans = await Promise.all(
  Array.from({ length: 12 }, () => call('/api/scan', { method: 'POST', cookie: green.cookie, body: { text: `http://x/verify/${booking.bookingCode}` } }))
)
const valid = scans.filter((s) => s.data?.result === 'valid')
check('12 phones scan the same ticket at once: it boards exactly once', valid.length === 1, `${valid.length} valid`)
check('the other 11 scans say "already used"', scans.filter((s) => s.data?.result === 'already_used').length === 11)

const screenshot = await call('/api/scan', { method: 'POST', cookie: green.cookie, body: { text: booking.bookingCode.toLowerCase() } })
check('a copied screenshot scanned later says "already used"', screenshot.data?.result === 'already_used', screenshot.data?.result)
check('scanner shows the real passenger and seat from BusHub, not what is printed',
  screenshot.data?.ticket?.passengerName === 'Test Passenger' && screenshot.data?.ticket?.seats?.join() === '1A')

const otherOp = await call('/api/scan', { method: 'POST', cookie: hanif.cookie, body: { text: booking.bookingCode } })
check('another company\'s scanner rejects the ticket', otherOp.data?.result === 'other_operator', otherOp.data?.result)
check('and does not see the passenger\'s details', otherOp.data?.ticket === null)

const fake = await call('/api/scan', { method: 'POST', cookie: green.cookie, body: { text: `BH-${dhakaToday.replace(/-/g, '')}-ZZZZZ` } })
check('a made-up ticket code is "not found"', fake.data?.result === 'not_found', fake.data?.result)
const junk = await call('/api/scan', { method: 'POST', cookie: green.cookie, body: { text: 'https://evil.example/ticket' } })
check('a random QR code is "not found"', junk.data?.result === 'not_found', junk.data?.result)
const anon = await call('/api/scan', { method: 'POST', body: { text: booking.bookingCode } })
check('nobody can scan without logging in', anon.status === 401, `status ${anon.status}`)
const publicCheckin = await call(`/api/verify/${booking.bookingCode}`, { method: 'PATCH' })
check('the public ticket page cannot check a ticket in', publicCheckin.status === 405 || publicCheckin.status === 404, `status ${publicCheckin.status}`)

// ---- Refunds ----
const b2 = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['3A', '3B'], ...passenger } })
await call(`/api/bookings/${b2.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid', paymentMethod: 'nagad' } })
const companyRefund = await call(`/api/bookings/${b2.data.booking._id}/refund`, { method: 'PATCH', cookie: green.cookie })
check('a bus company cannot refund (admin only)', companyRefund.status === 403, `status ${companyRefund.status}`)
const refunds = await Promise.all(Array.from({ length: 5 }, () => call(`/api/bookings/${b2.data.booking._id}/refund`, { method: 'PATCH', cookie: admin })))
check('refunding the same ticket 5 times at once only refunds once', refunds.filter((r) => r.status === 200).length === 1,
  refunds.map((r) => r.status).join(','))
const refundedScan = await call('/api/scan', { method: 'POST', cookie: green.cookie, body: { text: b2.data.booking.bookingCode } })
check('a refunded ticket does not board', refundedScan.data?.result === 'refunded', refundedScan.data?.result)
const boardedRefund = await call(`/api/bookings/${booking._id}/refund`, { method: 'PATCH', cookie: admin })
check('a ticket that already boarded cannot be refunded (its seat is in use)', boardedRefund.status === 409, `status ${boardedRefund.status}`)

// ---- Expired holds ----
const hold = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['4A'], ...passenger } })
await db.collection('bookings').updateOne({ _id: new ObjectId(hold.data.booking._id) }, { $set: { holdExpiresAt: new Date(Date.now() - 1000).toISOString() } })
const latePay = await call(`/api/bookings/${hold.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid', paymentMethod: 'bkash' } })
check('paying after the 10-minute hold ran out is refused', latePay.status === 410, `status ${latePay.status}`)
const rebook = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['4A'], ...passenger } })
check('the released seat can be bought by someone else', rebook.status === 201, `status ${rebook.status}`)
const oldPayAgain = await call(`/api/bookings/${hold.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
check('the expired hold still cannot be paid once the seat is resold', oldPayAgain.status === 410, `status ${oldPayAgain.status}`)

// Expired holds released by many requests at once must not free a seat someone just bought.
for (let round = 0; round < 5; round++) {
  const seat = `${5 + round}C`
  const h = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: [seat], ...passenger } })
  await db.collection('bookings').updateOne({ _id: new ObjectId(h.data.booking._id) }, { $set: { holdExpiresAt: new Date(Date.now() - 1000).toISOString() } })
  await Promise.all([
    ...Array.from({ length: 6 }, () => call(`/api/buses/${trip._id}`)),
    ...Array.from({ length: 6 }, () => call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: [seat], ...passenger } })),
    ...Array.from({ length: 6 }, () => call(`/api/buses/${trip._id}`)),
  ])
}

// ---- Admin seat blocking can't take a sold seat ----
const blockSold = await call(`/api/buses/${trip._id}/seats`, { method: 'PATCH', cookie: admin, body: { seats: ['1A'], action: 'block' } })
check('admin cannot mark a BusHub-sold seat as counter-sold', blockSold.status === 409, `status ${blockSold.status}`)
await call(`/api/buses/${trip._id}/seats`, { method: 'PATCH', cookie: admin, body: { seats: ['9D'], action: 'block' } })
const counterSeat = await call('/api/bookings', { method: 'POST', body: { busId: trip._id, seats: ['9D'], ...passenger } })
check('a counter-sold seat cannot be bought online', counterSeat.status === 409, `status ${counterSeat.status}`)

// ---- Older trips (from before the bus list) can be linked so their tickets match ----
const legacy = await db.collection('buses').insertOne({
  companyId: 'admin', companyName: 'green line typed', busName: 'GL typed by hand', busType: 'AC',
  from: 'Dhaka', to: 'Khulna', date: dhakaToday, departureTime: '22:15', arrivalTime: '', price: 800,
  totalSeats: 36, bookedSeats: [], blockedSeats: [], commissionRate: 10, status: 'active', createdAt: new Date().toISOString(),
})
const legacyId = legacy.insertedId.toString()
const lb = await call('/api/bookings', { method: 'POST', body: { busId: legacyId, seats: ['2B'], ...passenger } })
await call(`/api/bookings/${lb.data.booking._id}`, { method: 'PATCH', body: { paymentStatus: 'paid' } })
const beforeLink = await call('/api/scan', { method: 'POST', cookie: green.cookie, body: { text: lb.data.booking.bookingCode } })
check('an unlinked old trip is refused by the company scanner', beforeLink.data?.result === 'other_operator', beforeLink.data?.result)
const link = await call(`/api/buses/${legacyId}`, { method: 'PATCH', cookie: admin, body: { fleetId: fleetBus._id } })
check('admin links the old trip to a bus from the list', link.status === 200, JSON.stringify(link.data))
const linkedTicket = await db.collection('bookings').findOne({ _id: new ObjectId(lb.data.booking._id) })
check('its existing tickets now carry the listed bus and company name',
  linkedTicket.busName === fleetBus.name && linkedTicket.companyName === green.name, `${linkedTicket.busName} / ${linkedTicket.companyName}`)
const afterLink = await call('/api/scan', { method: 'POST', cookie: green.cookie, body: { text: lb.data.booking.bookingCode } })
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
