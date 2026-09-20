import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectToDatabase } from '@/lib/db'
import { Company } from '@/lib/models'

export async function POST(req: NextRequest) {
  try {
    const { name, ownerName, email, phone, password } = await req.json()

    if (!name || !ownerName || !email || !phone || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const existing = await db.collection('companies').findOne({ email })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const company: Company = {
      name,
      ownerName,
      email,
      phone,
      passwordHash,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    await db.collection('companies').insertOne(company as any)
    return NextResponse.json({
      success: true,
      message: 'Registration submitted. An admin will review and approve your account.',
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
