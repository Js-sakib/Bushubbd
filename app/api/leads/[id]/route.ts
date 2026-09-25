import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getAdminFromCookies } from '@/lib/auth'
import { LEAD_STATUSES, leadStatusLabel } from '@/lib/leads'
import { cleanName } from '@/lib/names'

export const dynamic = 'force-dynamic'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Updates a lead: its status, next follow-up, contact details, or a new note. Status changes
 * and notes are added to the lead's log, and count as the last time they were contacted.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 })
    }
    const body = await req.json().catch(() => ({}))
    const { db } = await connectToDatabase()
    const lead = await db.collection('leads').findOne({ _id: new ObjectId(params.id) })
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const set: Record<string, unknown> = { updatedAt: now }
    const log: { text: string; at: string }[] = []

    if (body.status !== undefined) {
      if (!LEAD_STATUSES.some((s) => s.key === body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      if (body.status !== lead.status) {
        set.status = body.status
        log.push({ text: `Status: ${leadStatusLabel(lead.status)} → ${leadStatusLabel(body.status)}`, at: now })
        if (body.status !== 'new') set.lastContactedAt = now
      }
    }
    if (body.followUpDate !== undefined) {
      if (body.followUpDate !== '' && !DATE.test(String(body.followUpDate))) {
        return NextResponse.json({ error: 'Check the follow-up date' }, { status: 400 })
      }
      set.followUpDate = body.followUpDate
    }
    for (const key of ['contactName', 'area'] as const) {
      if (body[key] !== undefined) set[key] = cleanName(body[key])
    }
    for (const key of ['phone', 'altPhone'] as const) {
      if (body[key] !== undefined) set[key] = String(body[key]).trim()
    }
    const note = String(body.note || '').trim()
    if (note) {
      if (note.length > 1000) {
        return NextResponse.json({ error: 'That note is too long' }, { status: 400 })
      }
      log.push({ text: note, at: now })
      set.lastContactedAt = now
    }

    const update: Record<string, unknown> = { $set: set }
    if (log.length) update.$push = { notes: { $each: log } }
    await db.collection('leads').updateOne({ _id: lead._id }, update)
    const updated = await db.collection('leads').findOne({ _id: lead._id })
    return NextResponse.json({ lead: updated })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update the lead' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!getAdminFromCookies()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 })
    }
    const { db } = await connectToDatabase()
    await db.collection('leads').deleteOne({ _id: new ObjectId(params.id) })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete the lead' }, { status: 500 })
  }
}
