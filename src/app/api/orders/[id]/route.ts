import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, paymentStatus } = body

    const order = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        updatedAt: new Date(),
      },
      include: {
        items: { include: { menuItem: true } },
        gcashAccount: true,
      },
    })
    return NextResponse.json(order)
  } catch (error) {
    console.error('Update order error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
