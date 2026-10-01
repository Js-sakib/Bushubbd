import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getCompanyUser } from '@/lib/staff'
import { UNDO_MINUTES } from '@/lib/tripCosts'

export const dynamic = 'force-dynamic'

/**
 * Take a cost back. The manager can remove any of the company's; a bus staff login only its own,
 * within an hour of entering it (to fix a typo), so the record stays honest.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { db } = await connectToDatabase()
    const user = await getCompanyUser(db)
    if (!user || (user.role !== 'scanner' && user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!ObjectId.isValid(params.id)) return NextResponse.json({ error: 'Cost not found' }, { status: 404 })
    const cost = await db.collection('tripCosts').findOne({ _id: new ObjectId(params.id), companyId: user.companyId })
    if (!cost) return NextResponse.json({ error: 'Cost not found' }, { status: 404 })
    if (user.role === 'scanner') {
      const tooLate = Date.now() - new Date(cost.createdAt).getTime() > UNDO_MINUTES * 60000
      if (cost.staffId !== user.staffId || tooLate) {
        return NextResponse.json({ error: 'Only your manager can remove this cost now' }, { status: 403 })
      }
    }
    await db.collection('tripCosts').deleteOne({ _id: cost._id })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to remove the cost' }, { status: 500 })
  }
}
