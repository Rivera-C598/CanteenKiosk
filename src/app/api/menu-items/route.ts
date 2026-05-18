import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sessionOptions, SessionData } from '@/lib/session'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('categoryId')
  const all = searchParams.get('all') === 'true'

  try {
    const items = await prisma.menuItem.findMany({
      where: {
        ...(all ? {} : { available: true }),
        ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
      },
      include: { category: true, addons: { where: all ? {} : { available: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Menu items error:', error)
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, categoryId, price, description = '', image = '', stock = 999, available = true } = body
    if (!name || categoryId == null || price == null) {
      return NextResponse.json({ error: 'name, categoryId, and price are required' }, { status: 400 })
    }
    if (parseFloat(price) < 0) {
      return NextResponse.json({ error: 'Price cannot be negative' }, { status: 400 })
    }
    if (Number(stock) < 0) {
      return NextResponse.json({ error: 'Stock cannot be negative' }, { status: 400 })
    }
    const item = await prisma.menuItem.create({
      data: { name, categoryId: parseInt(categoryId), price: parseFloat(price), description, image, stock: Number(stock), available },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Create menu item error:', error)
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 })
  }
}
