import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { amount, note } = await request.json()

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  const adminId = session.userId ?? null

  try {
    const student = await prisma.studentAccount.findUnique({ where: { id: parseInt(id) } })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (student.status !== 'active') {
      return NextResponse.json({ error: 'Account not active' }, { status: 400 })
    }

    const balanceBefore = student.balance
    const balanceAfter = balanceBefore + amount

    const [, transaction] = await prisma.$transaction([
      prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { balance: balanceAfter },
      }),
      prisma.studentTransaction.create({
        data: {
          studentAccountId: parseInt(id),
          type: 'topup',
          amount,
          balanceBefore,
          balanceAfter,
          adminId,
          note: note ?? '',
        },
      }),
    ])

    return NextResponse.json({ balance: balanceAfter, transaction })
  } catch {
    return NextResponse.json({ error: 'Top-up failed' }, { status: 500 })
  }
}
