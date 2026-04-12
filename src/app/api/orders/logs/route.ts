import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orderId = parseInt(searchParams.get('orderId') ?? '')
  if (isNaN(orderId)) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }
  try {
    const logs = await prisma.orderLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(logs)
  } catch (error) {
    console.error('Order logs error:', error)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
