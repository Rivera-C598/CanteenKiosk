import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPin, deriveTempPin } from '@/lib/pin-utils'
import { generateQrToken } from '@/lib/qr-utils'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

async function requireAdmin(): Promise<number | null> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  return session.isLoggedIn ? (session.userId ?? null) : null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search') ?? ''

  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const students = await prisma.studentAccount.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search ? {
          OR: [
            { fullName: { contains: search } },
            { studentIdNumber: { contains: search } },
          ]
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, studentIdNumber: true, accountType: true,
        fullName: true, course: true, year: true, photoUrl: true,
        balance: true, status: true, createdAt: true, activatedAt: true,
        isTemporaryPin: true,
      },
    })
    return NextResponse.json(students)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { studentIdNumber, fullName, course, year, photoUrl, accountType } = await request.json()

    if (!studentIdNumber || !fullName || !course || !year) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await prisma.studentAccount.findUnique({ where: { studentIdNumber } })
    if (existing) {
      return NextResponse.json({ error: 'Student ID already registered' }, { status: 409 })
    }

    const tempPin = deriveTempPin(studentIdNumber)
    const pinHash = await hashPin(tempPin)
    const qrToken = generateQrToken()
    const type = accountType ?? (studentIdNumber.length === 7 ? 'student' : 'faculty')

    const student = await prisma.studentAccount.create({
      data: {
        studentIdNumber,
        fullName,
        course,
        year,
        photoUrl: photoUrl ?? '',
        accountType: type,
        pinHash,
        qrToken,
        status: 'active',
        isTemporaryPin: true,
        activatedAt: new Date(),
      },
    })

    return NextResponse.json({ id: student.id, studentIdNumber: student.studentIdNumber })
  } catch {
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 })
  }
}
