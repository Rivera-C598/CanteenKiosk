import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { items, paymentMethod, totalAmount } = body

    // Generate order number: e.g. A-042
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayOrderCount = await prisma.order.count({
      where: { createdAt: { gte: todayStart } }
    })
    const orderNumber = `A-${String(todayOrderCount + 1).padStart(3, '0')}`

    // Get active GCash account if payment is gcash
    let gcashAccountId: number | undefined
    if (paymentMethod === 'gcash') {
      const gcashAccount = await prisma.gCashAccount.findFirst({
        where: { isActive: true }
      })
      gcashAccountId = gcashAccount?.id
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        paymentMethod,
        paymentStatus: 'unpaid',
        status: paymentMethod === 'cash' ? 'awaiting_payment' : 'pending_verification',
        totalAmount,
        gcashAccountId,
        items: {
          create: items.map((item: { id: number; quantity: number; price: number }) => ({
            menuItemId: item.id,
            quantity: item.quantity,
            unitPrice: item.price,
            subtotal: item.price * item.quantity,
          }))
        }
      },
      include: {
        items: { include: { menuItem: true } },
        gcashAccount: true,
      }
    })

    return NextResponse.json(order)
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
