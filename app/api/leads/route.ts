import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase, isDuplicateKeyError } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { LEAD_SOURCES, LEAD_STATUSES, Lead, STARTER_LEADS } from '@/lib/leads'
import { cleanName, nameKey } from '@/lib/names'
import { phoneDigits } from '@/lib/phone'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Bus companies the BusHub team is talking to about joining. Admin only. */
export async function GET() {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { db } = await connectToDatabase()
    const leads = await db.collection('leads').find({}).sort({ updatedAt: -1 }).limit(1000).toArray()
    return NextResponse.json({ leads }, { headers: NO_STORE })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 })
  }
}

function newLead(fields: Partial<Lead> & { companyName: string }, firstNote: string, now: string): Lead {
  return {
    companyName: fields.companyName,
    nameKey: nameKey(fields.companyName),
    contactName: fields.contactName || '',
    phone: fields.phone || '',
    altPhone: fields.altPhone || '',
    area: fields.area || '',
    source: fields.source || 'Other',
    status: fields.status || 'new',
    followUpDate: fields.followUpDate || '',
    notes: firstNote ? [{ text: firstNote, at: now }] : [],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Adds one lead, or with { starter: true } the list of companies found online. A company can
 * be a lead only once; the starter list skips any that are already there.
 */
export async function POST(req: NextRequest) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    const { db } = await connectToDatabase()
    const now = new Date().toISOString()

    if (body.starter === true) {
      let added = 0
      for (const s of STARTER_LEADS) {
        const lead = newLead({ ...s, source: 'Website' }, s.note, now)
        const result = await db
          .collection('leads')
          .updateOne({ nameKey: lead.nameKey }, { $setOnInsert: lead }, { upsert: true })
        if (result.upsertedCount) added++
      }
      return NextResponse.json({ added }, { status: 201 })
    }

    const companyName = cleanName(body.companyName)
    const phone = String(body.phone || '').trim()
    if (companyName.length < 2 || companyName.length > 80) {
      return NextResponse.json({ error: 'Enter the bus company name' }, { status: 400 })
    }
    if (phoneDigits(phone).length < 5) {
      return NextResponse.json({ error: 'Enter a phone number' }, { status: 400 })
    }
    if (body.followUpDate && !DATE.test(String(body.followUpDate))) {
      return NextResponse.json({ error: 'Check the follow-up date' }, { status: 400 })
    }

    // The same number under another name usually means the same company typed twice.
    const digits = phoneDigits(phone)
    const all = await db.collection('leads').find({}, { projection: { companyName: 1, phone: 1, altPhone: 1 } }).toArray()
    const samePhone = all.find((l) => [l.phone, l.altPhone].some((p) => p && phoneDigits(p) === digits))
    if (samePhone) {
      return NextResponse.json({ error: `That number is already saved for ${samePhone.companyName}` }, { status: 409 })
    }

    const lead = newLead(
      {
        companyName,
        contactName: cleanName(body.contactName),
        phone,
        altPhone: String(body.altPhone || '').trim(),
        area: cleanName(body.area),
        source: LEAD_SOURCES.includes(body.source) ? body.source : 'Other',
        status: LEAD_STATUSES.some((s) => s.key === body.status) ? body.status : 'new',
        followUpDate: body.followUpDate || '',
      },
      String(body.note || '').trim(),
      now
    )
    try {
      const result = await db.collection('leads').insertOne({ ...lead } as any)
      return NextResponse.json({ lead: { ...lead, _id: result.insertedId } }, { status: 201 })
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err
      const existing = await db.collection('leads').findOne({ nameKey: lead.nameKey })
      return NextResponse.json({ error: `"${existing?.companyName || companyName}" is already on your leads list` }, { status: 409 })
    }
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save the lead' }, { status: 500 })
  }
}
