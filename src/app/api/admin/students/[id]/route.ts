import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPin, deriveTempPin } from '@/lib/pin-utils'
import { generateQrToken } from '@/lib/qr-utils'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

async function getAdminId(): Promise<number | null> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  return session.userId ?? null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const student = await prisma.studentAccount.findUnique({
      where: { id: parseInt(id) },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        activatedBy: { select: { username: true } },
      },
    })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(student)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const adminId = await getAdminId()

  try {
    const student = await prisma.studentAccount.findUnique({ where: { id: parseInt(id) } })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Activate pending account
    if (body.action === 'activate') {
      const updated = await prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { status: 'active', activatedAt: new Date(), activatedById: adminId },
      })
      return NextResponse.json(updated)
    }

    // Freeze / unfreeze
    if (body.action === 'freeze' || body.action === 'unfreeze') {
      const updated = await prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { status: body.action === 'freeze' ? 'frozen' : 'active' },
      })
      return NextResponse.json(updated)
    }

    // Reset PIN to temp
    if (body.action === 'reset-pin') {
      const tempPin = deriveTempPin(student.studentIdNumber)
      const pinHash = await hashPin(tempPin)
      const updated = await prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { pinHash, isTemporaryPin: true, pinAttempts: 0, pinLockedUntil: null },
      })
      return NextResponse.json(updated)
    }

    // Regenerate QR token
    if (body.action === 'regen-qr') {
      const qrToken = generateQrToken()
      const updated = await prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { qrToken },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }
}
