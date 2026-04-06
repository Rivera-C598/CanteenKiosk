import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true'
  try {
    const categories = await prisma.category.findMany({
      where: all ? {} : { active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: all ? {} : { available: true },
          orderBy: { name: 'asc' },
        },
      },
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Categories error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, icon = 'restaurant', sortOrder = 0 } = body
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const category = await prisma.category.create({
      data: { name, icon, sortOrder },
    })
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
