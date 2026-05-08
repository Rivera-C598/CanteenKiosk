import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateQrSvg } from '@/lib/qr-utils'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

async function requireAdmin(): Promise<number | null> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  return session.isLoggedIn ? (session.userId ?? null) : null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const student = await prisma.studentAccount.findUnique({
      where: { id: parseInt(id) },
      select: { qrToken: true, fullName: true, studentIdNumber: true, accountType: true, course: true, year: true },
    })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const svg = await generateQrSvg(student.qrToken)
    return NextResponse.json({ svg, student })
  } catch {
    return NextResponse.json({ error: 'Failed to generate QR' }, { status: 500 })
  }
}
