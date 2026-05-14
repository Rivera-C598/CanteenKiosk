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
      if (current.paymentStatus === 'paid') {
        return NextResponse.json({ error: 'Cannot edit a paid order' }, { status: 400 })
      }

      const beforeSnapshot = {
        items: current.items.map(i => ({ name: i.menuItem.name, quantity: i.quantity, unitPrice: i.unitPrice })),
        total: current.totalAmount,
      }
      const afterSnapshot = {
        items: (items as EditItem[]).map(i => ({ menuItemId: i.menuItemId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
        total: totalAmount,
      }

      await prisma.$transaction(async (tx) => {
        // Compute stock deltas between old and new quantities
        const oldQtyMap = new Map(current.items.map(i => [i.menuItem.id, i.quantity]))
        const newQtyMap = new Map((items as EditItem[]).map(i => [i.menuItemId, i.quantity]))
        const allIds = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()])

        for (const itemId of allIds) {
          const oldQty = oldQtyMap.get(itemId) ?? 0
          const newQty = newQtyMap.get(itemId) ?? 0
          const delta = newQty - oldQty
          if (delta > 0) {
            const menuItem = await tx.menuItem.findUnique({ where: { id: itemId } })
            if (!menuItem || menuItem.stock < delta) {
              const name = menuItem?.name ?? 'Item'
              const avail = (menuItem?.stock ?? 0) + oldQty
              throw new Error(`STOCK_INSUFFICIENT:${name}:${avail}`)
            }
            await tx.menuItem.update({ where: { id: itemId }, data: { stock: { decrement: delta } } })
          } else if (delta < 0) {
            await tx.menuItem.update({ where: { id: itemId }, data: { stock: { increment: -delta } } })
          }
        }

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
      if (current.status === 'cancelled') return NextResponse.json(current)

      const isCashlessPaid = current.paymentMethod === 'cashless' && current.paymentStatus === 'paid'
      const isGCashPaid = current.paymentMethod === 'gcash' && current.paymentStatus === 'paid'

      const order = await prisma.$transaction(async (tx) => {
        // Auto-refund cashless balance
        if (isCashlessPaid && current.studentAccountId) {
          const student = await tx.studentAccount.findUnique({ where: { id: current.studentAccountId } })
          if (student) {
            const balanceBefore = student.balance
            const balanceAfter = balanceBefore + current.totalAmount
            await tx.studentAccount.update({
              where: { id: student.id },
              data: { balance: balanceAfter },
            })
            await tx.studentTransaction.create({
              data: {
                studentAccountId: student.id,
                type: 'refund',
                amount: current.totalAmount,
                balanceBefore,
                balanceAfter,
                orderId,
                note: `Order ${current.orderNumber} cancelled`,
              },
            })
          }
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'cancelled',
            cancelReason: cancelReason ?? '',
            ...(isCashlessPaid ? { refundStatus: 'completed', paymentStatus: 'refunded' } : {}),
            ...(isGCashPaid ? { refundStatus: 'pending' } : {}),
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
              refund: isCashlessPaid ? 'auto' : isGCashPaid ? 'manual_pending' : 'none',
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

    // Credit GCash monthlyReceived when confirming GCash payment
    const current = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    const isGCashConfirm = current?.paymentMethod === 'gcash'
      && paymentStatus === 'paid'
      && current?.paymentStatus !== 'paid'
      && current?.gcashAccountId

    // Note: status 'cancelled' is handled by the early-return block above (with refund logic).
    // isCancelling here only fires for edge cases where the early block was not triggered.
    const isCancelling = status === 'cancelled' && current?.status !== 'cancelled'

    const order = await prisma.$transaction(async (tx) => {
      if (isGCashConfirm && current?.gcashAccountId) {
        await tx.gCashAccount.update({
          where: { id: current.gcashAccountId },
          data: { monthlyReceived: { increment: current.totalAmount } },
        })
      }

      // Restore stock when order is cancelled at any stage
      if (isCancelling && current?.items) {
        for (const item of current.items) {
          await tx.menuItem.update({
            where: { id: item.menuItemId },
            data: { stock: { increment: item.quantity } },
          })
        }
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          ...(status ? { status } : {}),
          ...(paymentStatus ? { paymentStatus } : {}),
          ...(refundStatus !== undefined ? { refundStatus } : {}),
        },
        include: { items: { include: { menuItem: true } }, gcashAccount: true },
      })
    })
    return NextResponse.json(order)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('STOCK_INSUFFICIENT:')) {
      const parts = error.message.split(':')
      const name = parts[1]
      const avail = parts[2]
      return NextResponse.json({ error: `Only ${avail} ${name} available` }, { status: 409 })
    }
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
