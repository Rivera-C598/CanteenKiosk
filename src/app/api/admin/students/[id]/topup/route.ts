import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { amount, note } = await request.json()

  if (amount === undefined || amount === null || amount === 0) {
    return NextResponse.json({ error: 'Amount cannot be zero' }, { status: 400 })
  }
  if (!note || !String(note).trim()) {
    return NextResponse.json({ error: 'Reference note is required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  const adminId = session.isLoggedIn ? (session.userId ?? null) : null
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const student = await prisma.studentAccount.findUnique({ where: { id: parseInt(id) } })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (student.status !== 'active') {
      return NextResponse.json({ error: 'Account not active' }, { status: 400 })
    }

    const balanceBefore = student.balance
    const balanceAfter = balanceBefore + amount

    if (balanceAfter < 0) {
      return NextResponse.json({
        error: `Cannot reduce below ₱0. Current balance: ₱${balanceBefore.toFixed(2)}`,
      }, { status: 400 })
    }

    const type = amount > 0 ? 'topup' : 'adjustment'

    const [, transaction] = await prisma.$transaction([
      prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { balance: balanceAfter },
      }),
      prisma.studentTransaction.create({
        data: {
          studentAccountId: parseInt(id),
          type,
          amount: Math.abs(amount),
          balanceBefore,
          balanceAfter,
          adminId,
          note: note ?? '',
        },
      }),
    ])

    return NextResponse.json({ balance: balanceAfter, transaction })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
