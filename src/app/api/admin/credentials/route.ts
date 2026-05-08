import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { sessionOptions, SessionData } from '@/lib/session'
import bcrypt from 'bcryptjs'

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { currentPassword, newUsername, newPassword } = await request.json()

  if (!currentPassword) {
    return NextResponse.json({ error: 'Current password required' }, { status: 400 })
  }
  if (!newUsername && !newPassword) {
    return NextResponse.json({ error: 'Provide a new username or password' }, { status: 400 })
  }

  const user = await prisma.adminUser.findUnique({ where: { id: session.userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) return NextResponse.json({ error: 'Current password incorrect' }, { status: 401 })

  if (newUsername && newUsername !== user.username) {
    const taken = await prisma.adminUser.findUnique({ where: { username: newUsername } })
    if (taken) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const updateData: Record<string, string> = {}
  if (newUsername) updateData.username = newUsername
  if (newPassword) {
    if (newPassword.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    updateData.passwordHash = await bcrypt.hash(newPassword, 10)
  }

  await prisma.adminUser.update({ where: { id: session.userId }, data: updateData })

  // Update session if username changed
  if (newUsername) {
    session.username = newUsername
    await session.save()
  }

  return NextResponse.json({ ok: true })
}
