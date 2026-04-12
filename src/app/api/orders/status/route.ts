import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CANCEL_REASON_LABELS: Record<string, string> = {
  customer_request: 'Cancelled by customer request',
  out_of_stock: 'Item was out of stock',
  duplicate: 'Duplicate order',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orderNumber = searchParams.get('order')?.toUpperCase().trim()

  if (!orderNumber) {
    return NextResponse.json({ error: 'Order number required' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { menuItem: true } } },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    cancelReason: order.cancelReason ? (CANCEL_REASON_LABELS[order.cancelReason] ?? '') : '',
    refundStatus: order.refundStatus,
    items: order.items.map(i => ({ name: i.menuItem.name, quantity: i.quantity })),
    createdAt: order.createdAt,
  })
}
