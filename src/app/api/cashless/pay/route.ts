import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPin } from '@/lib/pin-utils'

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 30

export async function POST(request: NextRequest) {
  const { qrToken, pin, orderId } = await request.json()
  if (!qrToken || !pin || !orderId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const student = await prisma.studentAccount.findUnique({ where: { qrToken } })
  if (!student) return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 })
  if (student.status === 'frozen') return NextResponse.json({ error: 'Account frozen' }, { status: 403 })
  if (student.status === 'pending') return NextResponse.json({ error: 'Account not activated' }, { status: 403 })
  if (student.status === 'deleted') return NextResponse.json({ error: 'Account no longer exists' }, { status: 403 })

  if (student.pinLockedUntil && new Date() < student.pinLockedUntil) {
    const secondsLeft = Math.ceil((student.pinLockedUntil.getTime() - Date.now()) / 1000)
    return NextResponse.json({ error: `PIN locked. Try again in ${secondsLeft}s` }, { status: 429 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.paymentStatus === 'paid') return NextResponse.json({ error: 'Order already paid' }, { status: 400 })

  const pinValid = await verifyPin(pin, student.pinHash)

  if (!pinValid) {
    const newAttempts = student.pinAttempts + 1
    const locked = newAttempts >= MAX_ATTEMPTS
    await prisma.studentAccount.update({
      where: { id: student.id },
      data: {
        pinAttempts: locked ? MAX_ATTEMPTS : newAttempts,
        pinLockedUntil: locked ? new Date(Date.now() + LOCKOUT_SECONDS * 1000) : null,
      },
    })
    if (locked) {
      return NextResponse.json({ error: `Too many attempts. Locked for ${LOCKOUT_SECONDS}s` }, { status: 429 })
    }
    return NextResponse.json({ error: `Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt(s) left` }, { status: 401 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const freshStudent = await tx.studentAccount.findUnique({ where: { id: student.id } })
      if (!freshStudent || freshStudent.balance < order.totalAmount) {
        throw new Error('INSUFFICIENT')
      }

      const balanceBefore = freshStudent.balance
      const balanceAfter = balanceBefore - order.totalAmount

      await tx.studentAccount.update({
        where: { id: student.id },
        data: { balance: balanceAfter, pinAttempts: 0, pinLockedUntil: null },
      })
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'paid', status: 'confirmed', studentAccountId: student.id },
      })
      await tx.studentTransaction.create({
        data: {
          studentAccountId: student.id,
          type: 'payment',
          amount: order.totalAmount,
          balanceBefore,
          balanceAfter,
          orderId,
        },
      })
    })
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'INSUFFICIENT') {
      return NextResponse.json({ error: `Insufficient balance. Balance: ₱${student.balance.toFixed(2)}` }, { status: 400 })
    }
    return NextResponse.json({ error: 'Payment failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
