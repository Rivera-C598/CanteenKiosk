import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { pin } = await request.json()
  const kitchenPin = process.env.KITCHEN_PIN

  if (!kitchenPin) {
    return NextResponse.json({ error: 'Kitchen PIN not configured' }, { status: 500 })
  }
  if (!pin || pin !== kitchenPin) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
