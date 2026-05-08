import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'

export async function POST() {
  const cookieStore = await cookies()
  const session = await getIronSession<StudentSessionData>(cookieStore, studentSessionOptions)
  session.destroy()
  return NextResponse.json({ ok: true })
}
