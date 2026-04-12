import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const accounts = await prisma.gCashAccount.findMany({
      orderBy: { id: 'asc' },
    })
    return NextResponse.json(accounts)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch GCash accounts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { accountName, accountNumber, qrCodeImage = '', monthlyLimit = 100000 } = body
    if (!accountName || !accountNumber) {
      return NextResponse.json({ error: 'accountName and accountNumber are required' }, { status: 400 })
    }
    const account = await prisma.gCashAccount.create({
      data: { accountName, accountNumber, qrCodeImage, monthlyLimit, isActive: false },
    })
    return NextResponse.json(account, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create GCash account' }, { status: 500 })
  }
}
