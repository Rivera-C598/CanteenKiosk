import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sessionOptions, SessionData } from '@/lib/session'

const VALID_STATUSES = ['pending_verification', 'awaiting_payment', 'preparing', 'ready', 'completed', 'cancelled']
const VALID_PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded']
const VALID_REFUND_STATUSES = ['', 'pending', 'completed']

interface EditItem {
  menuItemId: number
  name: string
  quantity: number
  unitPrice: number
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const orderId = parseInt(id)
    const body = await request.json()
    const { status, paymentStatus, items, totalAmount, cancelReason, refundStatus } = body

    // ── Edit items ──────────────────────────────────────────────
    if (items !== undefined) {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { menuItem: true } } },
      })
      if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

      const beforeSnapshot = {
        items: current.items.map(i => ({ name: i.menuItem.name, quantity: i.quantity, unitPrice: i.unitPrice })),
        total: current.totalAmount,
      }
      const afterSnapshot = {
        items: (items as EditItem[]).map(i => ({ menuItemId: i.menuItemId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
        total: totalAmount,
      }

      await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId } })
        await tx.orderItem.createMany({
          data: (items as EditItem[]).map(i => ({
            orderId,
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            subtotal: i.unitPrice * i.quantity,
          })),
        })
        await tx.order.update({ where: { id: orderId }, data: { totalAmount } })
        await tx.orderLog.create({
          data: {
            orderId,
            action: 'edited',
            snapshot: JSON.stringify({ before: beforeSnapshot, after: afterSnapshot }),
          },
        })
      })

      const updated = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { menuItem: true } }, gcashAccount: true },
      })
      return NextResponse.json(updated)
    }

    // ── Cancel ──────────────────────────────────────────────────
    if (status === 'cancelled') {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { menuItem: true } } },
      })
      if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

      const shouldFlagRefund =
        current.paymentMethod === 'gcash' && current.paymentStatus === 'paid'

      const order = await prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'cancelled',
            cancelReason: cancelReason ?? '',
            ...(shouldFlagRefund ? { refundStatus: 'pending' } : {}),
          },
          include: { items: { include: { menuItem: true } }, gcashAccount: true },
        })
        await tx.orderLog.create({
          data: {
            orderId,
            action: 'cancelled',
            snapshot: JSON.stringify({
              items: current.items.map(i => ({ name: i.menuItem.name, quantity: i.quantity })),
              total: current.totalAmount,
              cancelReason: cancelReason ?? '',
            }),
          },
        })
        return updated
      })
      return NextResponse.json(order)
    }

    // ── Standard status / payment / refund update ────────────────
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      return NextResponse.json({ error: 'Invalid paymentStatus' }, { status: 400 })
    }
    if (refundStatus !== undefined && !VALID_REFUND_STATUSES.includes(refundStatus)) {
      return NextResponse.json({ error: 'Invalid refundStatus' }, { status: 400 })
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(refundStatus !== undefined ? { refundStatus } : {}),
      },
      include: {
        items: { include: { menuItem: true } },
        gcashAccount: true,
      },
    })
    return NextResponse.json(order)
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    console.error('Update order error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
    if (!session.isLoggedIn || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const orderId = parseInt(id)

    await prisma.$transaction(async (tx) => {
      const orderItems = await tx.orderItem.findMany({ where: { orderId } })
      const orderItemIds = orderItems.map(i => i.id)
      await tx.orderItemAddon.deleteMany({ where: { orderItemId: { in: orderItemIds } } })
      await tx.orderItem.deleteMany({ where: { orderId } })
      await tx.orderLog.deleteMany({ where: { orderId } })
      await tx.order.delete({ where: { id: orderId } })
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    console.error('Delete order error:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
