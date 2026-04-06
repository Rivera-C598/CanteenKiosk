import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const account = await prisma.gCashAccount.findFirst({
      where: { isActive: true },
    })
    if (!account) {
      return NextResponse.json({ error: 'No active GCash account' }, { status: 404 })
    }
    return NextResponse.json(account)
  } catch (error) {
    console.error('GCash active error:', error)
    return NextResponse.json({ error: 'Failed to fetch GCash account' }, { status: 500 })
  }
}
