import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['pending_verification', 'awaiting_payment', 'preparing', 'ready', 'completed', 'cancelled']
const VALID_PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded']

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, paymentStatus } = body

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      return NextResponse.json({ error: 'Invalid paymentStatus' }, { status: 400 })
    }

    const order = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
      },
      include: {
        items: { include: { menuItem: true } },
        gcashAccount: true,
      },
    })
    return NextResponse.json(order)
  } catch (error: unknown) {
    if (
      typeof error === 'object' && error !== null &&
      (error as { code?: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    console.error('Update order error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
