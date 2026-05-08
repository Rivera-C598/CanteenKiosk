import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPin } from '@/lib/pin-utils'

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 30

export async function POST(request: NextRequest) {
  const { studentIdNumber, pin, orderId } = await request.json()
  if (!studentIdNumber || !pin || !orderId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const student = await prisma.studentAccount.findUnique({ where: { studentIdNumber } })
  if (!student) return NextResponse.json({ error: 'Student ID not found' }, { status: 404 })
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

  if (student.balance < order.totalAmount) {
    return NextResponse.json({ error: `Insufficient balance. Balance: ₱${student.balance.toFixed(2)}` }, { status: 400 })
  }

  const balanceBefore = student.balance
  const balanceAfter = balanceBefore - order.totalAmount

  await prisma.$transaction(async (tx) => {
    const freshStudent = await tx.studentAccount.findUnique({ where: { id: student.id } })
    if (!freshStudent || freshStudent.balance < order.totalAmount) throw new Error('INSUFFICIENT')

    await tx.studentAccount.update({
      where: { id: student.id },
      data: { balance: freshStudent.balance - order.totalAmount, pinAttempts: 0, pinLockedUntil: null },
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
        note: 'cashier manual entry',
      },
    })
  })

  return NextResponse.json({ ok: true, studentName: student.fullName })
}
