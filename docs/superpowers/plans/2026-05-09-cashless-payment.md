# Cashless Payment System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a QR card + PIN cashless payment system to CanteenKiosk — students carry a printed QR card, scan it at the kiosk camera, enter a 4-digit PIN, and balance is deducted.

**Architecture:** New `StudentAccount` and `StudentTransaction` Prisma models back a student portal (`/student/*`) and admin student management (`/admin/students/*`). Kiosk gets a new `/payment/cashless` page using the browser camera to scan QR cards. Middleware is extended to IP-lock kiosk routes and protect student routes.

**Tech Stack:** Next.js App Router, Prisma + SQLite, iron-session, bcryptjs, `qrcode` npm package (server-side QR generation), `html5-qrcode` npm package (browser camera scanning)

---

## File Map

**New files:**
- `src/lib/student-session.ts` — student iron-session config
- `src/lib/pin-utils.ts` — bcrypt hash/verify for PINs
- `src/lib/qr-utils.ts` — generate qrToken, generate QR SVG
- `src/app/api/admin/students/route.ts` — GET list, POST create
- `src/app/api/admin/students/[id]/route.ts` — GET, PATCH (activate/freeze/reset-pin)
- `src/app/api/admin/students/[id]/topup/route.ts` — POST topup
- `src/app/api/admin/students/[id]/qr/route.ts` — GET svg, POST regenerate
- `src/app/admin/students/page.tsx` — student list + pending queue
- `src/app/admin/students/new/page.tsx` — create student form
- `src/app/admin/students/[id]/page.tsx` — detail, topup, freeze, QR print
- `src/app/api/student/login/route.ts`
- `src/app/api/student/logout/route.ts`
- `src/app/api/student/me/route.ts`
- `src/app/api/student/register/route.ts`
- `src/app/api/student/transactions/route.ts`
- `src/app/api/student/change-pin/route.ts`
- `src/app/(student)/layout.tsx` — inactivity auto-logout
- `src/app/(student)/page.tsx` — login
- `src/app/(student)/dashboard/page.tsx`
- `src/app/(student)/transactions/page.tsx`
- `src/app/(student)/change-pin/page.tsx`
- `src/app/(student)/register/page.tsx`
- `src/app/api/cashless/identify/route.ts`
- `src/app/api/cashless/pay/route.ts`
- `src/app/(kiosk)/payment/cashless/page.tsx`

**Modified files:**
- `prisma/schema.prisma` — add StudentAccount, StudentTransaction, update Order + AdminUser
- `src/middleware.ts` — add IP lock + student session protection
- `src/app/admin/layout.tsx` — add Students nav item
- `src/app/(kiosk)/payment/page.tsx` — add Cashless option

---

## Task 1: Install Dependencies

**Files:** `package.json`

- [ ] Run:
```bash
npm install qrcode html5-qrcode
npm install --save-dev @types/qrcode
```

- [ ] Verify install completed without errors.

- [ ] Commit:
```bash
git add package.json package-lock.json
git commit -m "add qrcode and html5-qrcode deps"
```

---

## Task 2: Update Prisma Schema

**Files:** `prisma/schema.prisma`

- [ ] Add to `prisma/schema.prisma` (after the `OrderLog` model):

```prisma
model StudentAccount {
  id              Int                  @id @default(autoincrement())
  studentIdNumber String               @unique
  accountType     String               @default("student")
  fullName        String
  course          String
  year            String
  photoUrl        String               @default("")
  pinHash         String
  isTemporaryPin  Boolean              @default(true)
  balance         Float                @default(0)
  qrToken         String               @unique @default("")
  status          String               @default("pending")
  pinAttempts     Int                  @default(0)
  pinLockedUntil  DateTime?
  createdAt       DateTime             @default(now())
  activatedAt     DateTime?
  activatedById   Int?
  activatedBy     AdminUser?           @relation("ActivatedAccounts", fields: [activatedById], references: [id])
  transactions    StudentTransaction[]
  orders          Order[]
}

model StudentTransaction {
  id               Int            @id @default(autoincrement())
  studentAccountId Int
  studentAccount   StudentAccount @relation(fields: [studentAccountId], references: [id])
  type             String
  amount           Float
  balanceBefore    Float
  balanceAfter     Float
  orderId          Int?
  order            Order?         @relation(fields: [orderId], references: [id])
  adminId          Int?
  admin            AdminUser?     @relation("AdminTopups", fields: [adminId], references: [id])
  note             String         @default("")
  createdAt        DateTime       @default(now())
}
```

- [ ] Update `Order` model — add after `cancelReason String @default("")`:
```prisma
  studentAccountId Int?
  studentAccount   StudentAccount? @relation(fields: [studentAccountId], references: [id])
```

- [ ] Update `AdminUser` model — add after `orders Order[]`:
```prisma
  activatedAccounts   StudentAccount[]    @relation("ActivatedAccounts")
  studentTransactions StudentTransaction[] @relation("AdminTopups")
```

- [ ] Run migration:
```bash
npx prisma migrate dev --name add_cashless_payment
```

Expected: migration file created, Prisma client regenerated.

- [ ] Commit:
```bash
git add prisma/
git commit -m "add student account and transaction models"
```

---

## Task 3: Utility Libraries

**Files:**
- Create: `src/lib/student-session.ts`
- Create: `src/lib/pin-utils.ts`
- Create: `src/lib/qr-utils.ts`

- [ ] Create `src/lib/student-session.ts`:

```typescript
import { SessionOptions } from 'iron-session'

export interface StudentSessionData {
  studentId?: number
  studentIdNumber?: string
  isLoggedIn: boolean
  isTemporaryPin: boolean
}

export const studentSessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? 'canteen-kiosk-secret-key-change-in-production-32chars',
  cookieName: 'hyperbite-student-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 2, // 2 hours max; UI enforces 3-min inactivity
  },
}
```

- [ ] Create `src/lib/pin-utils.ts`:

```typescript
import bcrypt from 'bcryptjs'

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

export function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

export function deriveTempPin(studentIdNumber: string): string {
  return studentIdNumber.slice(-4)
}
```

- [ ] Create `src/lib/qr-utils.ts`:

```typescript
import QRCode from 'qrcode'
import { randomUUID } from 'crypto'

export function generateQrToken(): string {
  return randomUUID()
}

export async function generateQrSvg(qrToken: string): Promise<string> {
  return QRCode.toString(qrToken, { type: 'svg', width: 256, margin: 1 })
}
```

- [ ] Commit:
```bash
git add src/lib/student-session.ts src/lib/pin-utils.ts src/lib/qr-utils.ts
git commit -m "add student session, pin, and qr utilities"
```

---

## Task 4: Update Middleware

**Files:** Modify `src/middleware.ts`

- [ ] Replace `src/middleware.ts` entirely:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const kioskIp = process.env.KIOSK_IP

  // IP-lock kiosk routes — only kiosk device can access them
  const isKioskRoute = ['/', '/menu', '/cart', '/payment', '/confirmed', '/status'].some(
    p => pathname === p || pathname.startsWith(p + '/')
  )
  if (isKioskRoute && kioskIp && clientIp !== kioskIp) {
    return NextResponse.json({ error: 'Access restricted to kiosk device' }, { status: 403 })
  }

  // Block kiosk device from student portal
  if (pathname.startsWith('/student') && kioskIp && clientIp === kioskIp) {
    return NextResponse.json({ error: 'Student portal not available on kiosk' }, { status: 403 })
  }

  // Protect /admin/* routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const response = NextResponse.next()
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Protect /student/* routes (except login and register)
  const studentPublic = ['/student', '/student/register']
  if (pathname.startsWith('/student') && !studentPublic.includes(pathname)) {
    const response = NextResponse.next()
    const session = await getIronSession<StudentSessionData>(request, response, studentSessionOptions)
    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL('/student', request.url))
    }
    // Force PIN change if still on temp PIN
    if (session.isTemporaryPin && pathname !== '/student/change-pin') {
      return NextResponse.redirect(new URL('/student/change-pin', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/student/:path*', '/', '/menu/:path*', '/cart/:path*', '/payment/:path*', '/confirmed/:path*', '/status/:path*'],
}
```

- [ ] Add `KIOSK_IP=` to `.env` (leave blank for dev — blank disables the IP lock):
```
KIOSK_IP=
```

- [ ] Verify dev server starts without errors: `npm run dev`

- [ ] Commit:
```bash
git add src/middleware.ts .env
git commit -m "add ip lock and student session middleware"
```

---

## Task 5: Admin Students API — List + Create

**Files:** Create `src/app/api/admin/students/route.ts`

- [ ] Create `src/app/api/admin/students/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPin, deriveTempPin } from '@/lib/pin-utils'
import { generateQrToken } from '@/lib/qr-utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search') ?? ''

  try {
    const students = await prisma.studentAccount.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search ? {
          OR: [
            { fullName: { contains: search } },
            { studentIdNumber: { contains: search } },
          ]
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, studentIdNumber: true, accountType: true,
        fullName: true, course: true, year: true, photoUrl: true,
        balance: true, status: true, createdAt: true, activatedAt: true,
        isTemporaryPin: true,
      },
    })
    return NextResponse.json(students)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { studentIdNumber, fullName, course, year, photoUrl, accountType } = await request.json()

    if (!studentIdNumber || !fullName || !course || !year) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await prisma.studentAccount.findUnique({ where: { studentIdNumber } })
    if (existing) {
      return NextResponse.json({ error: 'Student ID already registered' }, { status: 409 })
    }

    const tempPin = deriveTempPin(studentIdNumber)
    const pinHash = await hashPin(tempPin)
    const qrToken = generateQrToken()
    const type = accountType ?? (studentIdNumber.length === 7 ? 'student' : 'faculty')

    const student = await prisma.studentAccount.create({
      data: {
        studentIdNumber,
        fullName,
        course,
        year,
        photoUrl: photoUrl ?? '',
        accountType: type,
        pinHash,
        qrToken,
        status: 'active',
        isTemporaryPin: true,
        activatedAt: new Date(),
      },
    })

    return NextResponse.json({ id: student.id, studentIdNumber: student.studentIdNumber })
  } catch {
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 })
  }
}
```

- [ ] Test via browser: visit `/admin/students` (will 404 until UI is built, but API should return `[]` at `GET /api/admin/students`).

- [ ] Commit:
```bash
git add src/app/api/admin/students/route.ts
git commit -m "add admin students list and create api"
```

---

## Task 6: Admin Student Detail API

**Files:** Create `src/app/api/admin/students/[id]/route.ts`

- [ ] Create `src/app/api/admin/students/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPin, deriveTempPin } from '@/lib/pin-utils'
import { generateQrToken } from '@/lib/qr-utils'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

async function getAdminId(): Promise<number | null> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  return session.userId ?? null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const student = await prisma.studentAccount.findUnique({
      where: { id: parseInt(id) },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        activatedBy: { select: { username: true } },
      },
    })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(student)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const adminId = await getAdminId()

  try {
    const student = await prisma.studentAccount.findUnique({ where: { id: parseInt(id) } })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Activate pending account
    if (body.action === 'activate') {
      const updated = await prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { status: 'active', activatedAt: new Date(), activatedById: adminId },
      })
      return NextResponse.json(updated)
    }

    // Freeze / unfreeze
    if (body.action === 'freeze' || body.action === 'unfreeze') {
      const updated = await prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { status: body.action === 'freeze' ? 'frozen' : 'active' },
      })
      return NextResponse.json(updated)
    }

    // Reset PIN to temp
    if (body.action === 'reset-pin') {
      const tempPin = deriveTempPin(student.studentIdNumber)
      const pinHash = await hashPin(tempPin)
      const updated = await prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { pinHash, isTemporaryPin: true, pinAttempts: 0, pinLockedUntil: null },
      })
      return NextResponse.json(updated)
    }

    // Regenerate QR token
    if (body.action === 'regen-qr') {
      const qrToken = generateQrToken()
      const updated = await prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { qrToken },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }
}
```

- [ ] Commit:
```bash
git add src/app/api/admin/students/[id]/route.ts
git commit -m "add admin student detail and patch api"
```

---

## Task 7: Admin Top-up + QR APIs

**Files:**
- Create: `src/app/api/admin/students/[id]/topup/route.ts`
- Create: `src/app/api/admin/students/[id]/qr/route.ts`

- [ ] Create `src/app/api/admin/students/[id]/topup/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { amount, note } = await request.json()

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  const adminId = session.userId ?? null

  try {
    const student = await prisma.studentAccount.findUnique({ where: { id: parseInt(id) } })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (student.status !== 'active') {
      return NextResponse.json({ error: 'Account not active' }, { status: 400 })
    }

    const balanceBefore = student.balance
    const balanceAfter = balanceBefore + amount

    const [, transaction] = await prisma.$transaction([
      prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { balance: balanceAfter },
      }),
      prisma.studentTransaction.create({
        data: {
          studentAccountId: parseInt(id),
          type: 'topup',
          amount,
          balanceBefore,
          balanceAfter,
          adminId,
          note: note ?? '',
        },
      }),
    ])

    return NextResponse.json({ balance: balanceAfter, transaction })
  } catch {
    return NextResponse.json({ error: 'Top-up failed' }, { status: 500 })
  }
}
```

- [ ] Create `src/app/api/admin/students/[id]/qr/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateQrSvg } from '@/lib/qr-utils'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const student = await prisma.studentAccount.findUnique({
      where: { id: parseInt(id) },
      select: { qrToken: true, fullName: true, studentIdNumber: true, accountType: true, course: true, year: true },
    })
    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const svg = await generateQrSvg(student.qrToken)
    return NextResponse.json({ svg, student })
  } catch {
    return NextResponse.json({ error: 'Failed to generate QR' }, { status: 500 })
  }
}
```

- [ ] Commit:
```bash
git add src/app/api/admin/students/[id]/topup/route.ts src/app/api/admin/students/[id]/qr/route.ts
git commit -m "add admin topup and qr generation api"
```

---

## Task 8: Admin Students List Page

**Files:** Create `src/app/admin/students/page.tsx`

- [ ] Create `src/app/admin/students/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

interface Student {
  id: number
  studentIdNumber: string
  accountType: string
  fullName: string
  course: string
  year: string
  balance: number
  status: string
  createdAt: string
}

export default function StudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const fetchStudents = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (search) params.set('search', search)
    const res = await fetch(`/api/admin/students?${params}`)
    const data = await res.json()
    setStudents(data)
    setLoading(false)
  }

  useEffect(() => { fetchStudents() }, [statusFilter, search])

  const statusColor: Record<string, string> = {
    pending: 'bg-warning-container text-on-warning-container',
    active: 'bg-secondary-container text-on-secondary-container',
    frozen: 'bg-error-container text-on-error-container',
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Students</h1>
          <p className="text-on-surface-variant text-sm mt-0.5">Manage cashless accounts</p>
        </div>
        <button
          onClick={() => router.push('/admin/students/new')}
          className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-xl font-bold text-sm shadow-primary-glow active:scale-95 transition-transform"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          <Icon name="person_add" size={18} />
          New Account
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or ID..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface text-sm outline-none focus:border-primary"
        />
        {['', 'pending', 'active', 'frozen'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
              statusFilter === s ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Icon name="hourglass_empty" size={32} className="text-on-surface-variant animate-spin" />
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-ambient">
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Icon name="group" size={48} className="text-on-surface-variant opacity-40" />
              <p className="text-on-surface-variant text-sm">No accounts found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-container">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Balance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/admin/students/${s.id}`)}
                    className="border-b border-surface-container last:border-0 hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-on-surface text-sm">{s.fullName}</p>
                      <p className="text-on-surface-variant text-xs">{s.course} · {s.year}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-sm font-mono">{s.studentIdNumber}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-sm capitalize">{s.accountType}</td>
                    <td className="px-4 py-3 font-bold text-on-surface text-sm">₱{s.balance.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${statusColor[s.status] ?? ''}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] Commit:
```bash
git add src/app/admin/students/page.tsx
git commit -m "add admin students list page"
```

---

## Task 9: Admin Students Nav + New Student Page

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Create: `src/app/admin/students/new/page.tsx`

- [ ] In `src/app/admin/layout.tsx`, add to `navItems` array after the GCash entry:
```typescript
{ href: '/admin/students', icon: 'group', label: 'Students' },
```

- [ ] Create `src/app/admin/students/new/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

export default function NewStudentPage() {
  const router = useRouter()
  const [form, setForm] = useState({ studentIdNumber: '', fullName: '', course: '', year: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.studentIdNumber || !form.fullName || !form.course || !form.year) {
      setError('All fields required')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to create account')
      setLoading(false)
      return
    }
    const data = await res.json()
    router.push(`/admin/students/${data.id}`)
  }

  return (
    <div className="p-6 max-w-lg">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-on-surface-variant mb-6 hover:text-on-surface transition-colors">
        <Icon name="arrow_back" size={20} />
        <span className="text-sm font-medium">Back</span>
      </button>

      <h1 className="text-2xl font-black text-on-surface mb-6" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>New Account</h1>

      <div className="space-y-4">
        {[
          { label: 'Student ID Number', key: 'studentIdNumber', placeholder: '7-digit student or 6-digit faculty ID' },
          { label: 'Full Name', key: 'fullName', placeholder: 'Last, First Middle' },
          { label: 'Course / Department', key: 'course', placeholder: 'BSCS, BSIT, etc.' },
          { label: 'Year / Level', key: 'year', placeholder: '1st Year, Faculty, etc.' },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">{label}</label>
            <input
              value={form[key as keyof typeof form]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface text-sm outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-error text-sm mt-4">{error}</p>}

      <div className="mt-2 p-4 bg-secondary-container rounded-xl text-on-secondary-container text-sm">
        Temp PIN = last 4 digits of ID number. Student must change on first login.
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full mt-6 bg-primary text-on-primary rounded-xl px-6 py-4 font-black text-lg shadow-primary-glow active:scale-[0.98] transition-transform disabled:opacity-40"
        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        {loading ? 'Creating…' : 'Create Account'}
      </button>
    </div>
  )
}
```

- [ ] Commit:
```bash
git add src/app/admin/layout.tsx src/app/admin/students/new/page.tsx
git commit -m "add students nav and new student page"
```

---

## Task 10: Admin Student Detail Page

**Files:** Create `src/app/admin/students/[id]/page.tsx`

- [ ] Create `src/app/admin/students/[id]/page.tsx`:

```typescript
'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

interface Student {
  id: number
  studentIdNumber: string
  accountType: string
  fullName: string
  course: string
  year: string
  photoUrl: string
  balance: number
  status: string
  isTemporaryPin: boolean
  activatedAt: string | null
  activatedBy: { username: string } | null
  transactions: Array<{
    id: number
    type: string
    amount: number
    balanceBefore: number
    balanceAfter: number
    note: string
    createdAt: string
  }>
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [qrSvg, setQrSvg] = useState('')
  const [qrStudent, setQrStudent] = useState<Student | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const fetch_ = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/students/${id}`)
    const data = await res.json()
    setStudent(data)
    setLoading(false)
  }

  useEffect(() => { fetch_() }, [id])

  const doAction = async (action: string) => {
    if (!confirm(`Confirm: ${action}?`)) return
    setActionLoading(true)
    await fetch(`/api/admin/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await fetch_()
    setActionLoading(false)
  }

  const doTopup = async () => {
    const amount = parseFloat(topupAmount)
    if (!amount || amount <= 0) return
    setTopupLoading(true)
    await fetch(`/api/admin/students/${id}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    })
    setTopupAmount('')
    await fetch_()
    setTopupLoading(false)
  }

  const loadQr = async () => {
    const res = await fetch(`/api/admin/students/${id}/qr`)
    const data = await res.json()
    setQrSvg(data.svg)
    setQrStudent(data.student)
    setShowQr(true)
  }

  const printQr = () => {
    const win = window.open('', '_blank')
    if (!win || !qrStudent) return
    win.document.write(`
      <html><head><title>QR Card</title>
      <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; padding: 32px; }
        .card { border: 2px solid #333; border-radius: 12px; padding: 24px; width: 280px; text-align: center; }
        svg { width: 200px; height: 200px; }
        h2 { margin: 12px 0 4px; font-size: 18px; }
        p { margin: 2px 0; font-size: 13px; color: #555; }
        .id { font-size: 11px; letter-spacing: 1px; color: #888; margin-top: 8px; }
      </style></head><body>
      <div class="card">
        ${qrSvg}
        <h2>${qrStudent.fullName}</h2>
        <p>${qrStudent.course} · ${qrStudent.year}</p>
        <p class="id">${qrStudent.studentIdNumber} · ${qrStudent.accountType}</p>
      </div>
      <script>window.onload=()=>window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  if (loading) return <div className="p-6 flex items-center gap-3 text-on-surface-variant"><Icon name="hourglass_empty" size={24} className="animate-spin" /> Loading…</div>
  if (!student) return <div className="p-6 text-error">Student not found</div>

  const statusColor: Record<string, string> = {
    pending: 'bg-warning-container text-on-warning-container',
    active: 'bg-secondary-container text-on-secondary-container',
    frozen: 'bg-error-container text-on-error-container',
  }

  const txTypeColor: Record<string, string> = {
    topup: 'text-green-600',
    payment: 'text-error',
    refund: 'text-secondary',
  }

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => router.push('/admin/students')} className="flex items-center gap-2 text-on-surface-variant mb-6 hover:text-on-surface">
        <Icon name="arrow_back" size={20} />
        <span className="text-sm font-medium">Students</span>
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{student.fullName}</h1>
          <p className="text-on-surface-variant text-sm">{student.studentIdNumber} · {student.course} · {student.year}</p>
          <span className={`inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${statusColor[student.status]}`}>
            {student.status}
          </span>
          {student.isTemporaryPin && (
            <span className="inline-block ml-2 text-xs px-2.5 py-1 rounded-full font-semibold bg-warning-container text-on-warning-container">
              Temp PIN active
            </span>
          )}
        </div>
        <p className="text-3xl font-black text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>₱{student.balance.toFixed(2)}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        {student.status === 'pending' && (
          <button onClick={() => doAction('activate')} disabled={actionLoading}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-xl text-sm font-bold shadow-primary-glow active:scale-95 disabled:opacity-40">
            <Icon name="check_circle" size={18} /> Activate
          </button>
        )}
        {student.status === 'active' && (
          <button onClick={() => doAction('freeze')} disabled={actionLoading}
            className="flex items-center gap-2 bg-error-container text-on-error-container px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
            <Icon name="lock" size={18} /> Freeze Account
          </button>
        )}
        {student.status === 'frozen' && (
          <button onClick={() => doAction('unfreeze')} disabled={actionLoading}
            className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
            <Icon name="lock_open" size={18} /> Unfreeze
          </button>
        )}
        <button onClick={() => doAction('reset-pin')} disabled={actionLoading}
          className="flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
          <Icon name="pin" size={18} /> Reset PIN
        </button>
        <button onClick={() => doAction('regen-qr')} disabled={actionLoading}
          className="flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40">
          <Icon name="qr_code" size={18} /> Regen QR
        </button>
        <button onClick={showQr ? printQr : loadQr}
          className="flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95">
          <Icon name="print" size={18} /> {showQr ? 'Print Card' : 'Load QR'}
        </button>
      </div>

      {/* QR Preview */}
      {showQr && qrSvg && (
        <div className="mb-6 p-4 bg-surface-container-lowest rounded-xl flex items-center gap-4">
          <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="w-24 h-24 shrink-0" />
          <div>
            <p className="font-bold text-on-surface text-sm">{qrStudent?.fullName}</p>
            <p className="text-on-surface-variant text-xs">{qrStudent?.studentIdNumber}</p>
            <button onClick={printQr} className="mt-2 text-primary text-xs font-semibold flex items-center gap-1">
              <Icon name="print" size={14} /> Open print dialog
            </button>
          </div>
        </div>
      )}

      {/* Top-up */}
      {student.status === 'active' && (
        <div className="mb-6 p-4 bg-surface-container-lowest rounded-xl">
          <p className="font-bold text-on-surface text-sm mb-3">Top Up Balance</p>
          <div className="flex gap-3">
            <input
              type="number"
              value={topupAmount}
              onChange={e => setTopupAmount(e.target.value)}
              placeholder="Amount (₱)"
              className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-surface-container text-on-surface text-sm outline-none focus:border-primary"
            />
            <button onClick={doTopup} disabled={topupLoading || !topupAmount}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-bold shadow-primary-glow active:scale-95 disabled:opacity-40">
              {topupLoading ? '…' : 'Credit'}
            </button>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div>
        <p className="font-bold text-on-surface text-sm mb-3">Recent Transactions</p>
        {student.transactions.length === 0 ? (
          <p className="text-on-surface-variant text-sm">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {student.transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3 bg-surface-container-lowest rounded-xl">
                <div>
                  <p className={`text-sm font-semibold capitalize ${txTypeColor[tx.type]}`}>{tx.type}</p>
                  <p className="text-on-surface-variant text-xs">{new Date(tx.createdAt).toLocaleString()}</p>
                  {tx.note && <p className="text-on-surface-variant text-xs">{tx.note}</p>}
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${tx.type === 'topup' ? 'text-green-600' : 'text-error'}`}>
                    {tx.type === 'topup' ? '+' : '-'}₱{tx.amount.toFixed(2)}
                  </p>
                  <p className="text-on-surface-variant text-xs">bal: ₱{tx.balanceAfter.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] Visit `/admin/students` in browser. Create a test account. Verify it appears in list, navigate to detail page.

- [ ] Commit:
```bash
git add src/app/admin/students/[id]/page.tsx
git commit -m "add admin student detail page"
```

---

## Task 11: Student Auth APIs

**Files:**
- Create: `src/app/api/student/login/route.ts`
- Create: `src/app/api/student/logout/route.ts`
- Create: `src/app/api/student/me/route.ts`

- [ ] Create `src/app/api/student/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'
import { verifyPin } from '@/lib/pin-utils'

export async function POST(request: NextRequest) {
  const { studentIdNumber, pin } = await request.json()

  if (!studentIdNumber || !pin) {
    return NextResponse.json({ error: 'ID and PIN required' }, { status: 400 })
  }

  const student = await prisma.studentAccount.findUnique({ where: { studentIdNumber } })
  if (!student) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  if (student.status === 'frozen') {
    return NextResponse.json({ error: 'Account frozen. Contact admin.' }, { status: 403 })
  }
  if (student.status === 'pending') {
    return NextResponse.json({ error: 'Account pending activation.' }, { status: 403 })
  }

  const valid = await verifyPin(pin, student.pinHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const session = await getIronSession<StudentSessionData>(cookieStore, studentSessionOptions)
  session.studentId = student.id
  session.studentIdNumber = student.studentIdNumber
  session.isLoggedIn = true
  session.isTemporaryPin = student.isTemporaryPin
  await session.save()

  return NextResponse.json({ ok: true, isTemporaryPin: student.isTemporaryPin })
}
```

- [ ] Create `src/app/api/student/logout/route.ts`:

```typescript
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
```

- [ ] Create `src/app/api/student/me/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'

export async function GET() {
  const cookieStore = await cookies()
  const session = await getIronSession<StudentSessionData>(cookieStore, studentSessionOptions)
  if (!session.isLoggedIn || !session.studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const student = await prisma.studentAccount.findUnique({
    where: { id: session.studentId },
    select: { id: true, fullName: true, studentIdNumber: true, accountType: true, balance: true, status: true, isTemporaryPin: true },
  })
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(student)
}
```

- [ ] Commit:
```bash
git add src/app/api/student/login/route.ts src/app/api/student/logout/route.ts src/app/api/student/me/route.ts
git commit -m "add student auth apis"
```

---

## Task 12: Student Register + Transactions + Change PIN APIs

**Files:**
- Create: `src/app/api/student/register/route.ts`
- Create: `src/app/api/student/transactions/route.ts`
- Create: `src/app/api/student/change-pin/route.ts`

- [ ] Create `src/app/api/student/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPin, deriveTempPin } from '@/lib/pin-utils'
import { generateQrToken } from '@/lib/qr-utils'

export async function POST(request: NextRequest) {
  const { studentIdNumber, fullName, course, year } = await request.json()

  if (!studentIdNumber || !fullName || !course || !year) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  const existing = await prisma.studentAccount.findUnique({ where: { studentIdNumber } })
  if (existing) {
    return NextResponse.json({ error: 'ID already registered' }, { status: 409 })
  }

  const tempPin = deriveTempPin(studentIdNumber)
  const pinHash = await hashPin(tempPin)
  const qrToken = generateQrToken()
  const accountType = studentIdNumber.length === 7 ? 'student' : 'faculty'

  await prisma.studentAccount.create({
    data: { studentIdNumber, fullName, course, year, accountType, pinHash, qrToken, status: 'pending', isTemporaryPin: true },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] Create `src/app/api/student/transactions/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'

export async function GET() {
  const cookieStore = await cookies()
  const session = await getIronSession<StudentSessionData>(cookieStore, studentSessionOptions)
  if (!session.isLoggedIn || !session.studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const transactions = await prisma.studentTransaction.findMany({
    where: { studentAccountId: session.studentId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(transactions)
}
```

- [ ] Create `src/app/api/student/change-pin/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'
import { hashPin, verifyPin } from '@/lib/pin-utils'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = await getIronSession<StudentSessionData>(cookieStore, studentSessionOptions)
  if (!session.isLoggedIn || !session.studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { currentPin, newPin } = await request.json()
  if (!currentPin || !newPin || newPin.length < 4) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
  }

  const student = await prisma.studentAccount.findUnique({ where: { id: session.studentId } })
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const valid = await verifyPin(currentPin, student.pinHash)
  if (!valid) return NextResponse.json({ error: 'Current PIN incorrect' }, { status: 401 })

  const newPinHash = await hashPin(newPin)
  await prisma.studentAccount.update({
    where: { id: session.studentId },
    data: { pinHash: newPinHash, isTemporaryPin: false },
  })

  session.isTemporaryPin = false
  await session.save()

  return NextResponse.json({ ok: true })
}
```

- [ ] Commit:
```bash
git add src/app/api/student/register/route.ts src/app/api/student/transactions/route.ts src/app/api/student/change-pin/route.ts
git commit -m "add student register, transactions, and change pin apis"
```

---

## Task 13: Student Portal Layout + Login Page

**Files:**
- Create: `src/app/(student)/layout.tsx`
- Create: `src/app/(student)/page.tsx`

- [ ] Create `src/app/(student)/layout.tsx`:

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const INACTIVITY_MS = 3 * 60 * 1000 // 3 minutes

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    // Only auto-logout on protected pages
    if (pathname === '/student' || pathname === '/student/register') return
    timer.current = setTimeout(async () => {
      await fetch('/api/student/logout', { method: 'POST' })
      router.push('/student')
    }, INACTIVITY_MS)
  }

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (timer.current) clearTimeout(timer.current)
    }
  }, [pathname])

  return <div className="min-h-screen bg-background">{children}</div>
}
```

- [ ] Create `src/app/(student)/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

export default function StudentLoginPage() {
  const router = useRouter()
  const [studentIdNumber, setStudentIdNumber] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/student/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentIdNumber, pin }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Login failed')
      setLoading(false)
      return
    }
    router.push(data.isTemporaryPin ? '/student/change-pin' : '/student/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-primary-glow">
            <Icon name="account_balance_wallet" size={32} className="text-on-primary" />
          </div>
          <h1 className="text-3xl font-black italic text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            HyperBite Pay
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">Student Cashless Account</p>
        </div>

        <div className="space-y-4">
          <input
            value={studentIdNumber}
            onChange={e => setStudentIdNumber(e.target.value)}
            placeholder="Student ID Number"
            className="w-full px-4 py-4 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface outline-none focus:border-primary text-center text-lg font-mono tracking-widest"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="PIN"
            className="w-full px-4 py-4 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface outline-none focus:border-primary text-center text-2xl tracking-[0.5em]"
          />
        </div>

        {error && <p className="text-error text-sm text-center mt-3">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading || !studentIdNumber || !pin}
          className="w-full mt-6 bg-primary text-on-primary rounded-xl px-6 py-4 font-black text-lg shadow-primary-glow active:scale-[0.98] transition-transform disabled:opacity-40"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <button
          onClick={() => router.push('/student/register')}
          className="w-full mt-3 text-on-surface-variant text-sm py-2 hover:text-on-surface transition-colors"
        >
          No account? Register here
        </button>
      </div>
    </div>
  )
}
```

- [ ] Commit:
```bash
git add src/app/(student)/layout.tsx src/app/(student)/page.tsx
git commit -m "add student portal layout and login page"
```

---

## Task 14: Student Dashboard + Transactions + Change PIN + Register Pages

**Files:**
- Create: `src/app/(student)/dashboard/page.tsx`
- Create: `src/app/(student)/transactions/page.tsx`
- Create: `src/app/(student)/change-pin/page.tsx`
- Create: `src/app/(student)/register/page.tsx`

- [ ] Create `src/app/(student)/dashboard/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

interface Me { fullName: string; studentIdNumber: string; accountType: string; balance: number }
interface Tx { id: number; type: string; amount: number; balanceAfter: number; createdAt: string }

export default function StudentDashboard() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [txs, setTxs] = useState<Tx[]>([])

  useEffect(() => {
    fetch('/api/student/me').then(r => r.json()).then(setMe).catch(() => router.push('/student'))
    fetch('/api/student/transactions').then(r => r.json()).then((data: Tx[]) => setTxs(data.slice(0, 5)))
  }, [])

  const handleLogout = async () => {
    await fetch('/api/student/logout', { method: 'POST' })
    router.push('/student')
  }

  if (!me) return null

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-on-surface-variant text-sm">Welcome back</p>
          <h1 className="text-xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{me.fullName}</h1>
        </div>
        <button onClick={handleLogout} className="p-2 text-on-surface-variant hover:text-on-surface">
          <Icon name="logout" size={22} />
        </button>
      </div>

      {/* Balance card */}
      <div className="bg-primary rounded-2xl p-6 mb-6 shadow-primary-glow">
        <p className="text-on-primary opacity-80 text-sm font-medium">Available Balance</p>
        <p className="text-on-primary font-black text-5xl mt-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          ₱{me.balance.toFixed(2)}
        </p>
        <p className="text-on-primary opacity-60 text-xs mt-2">{me.studentIdNumber} · {me.accountType}</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => router.push('/student/transactions')}
          className="flex flex-col items-center gap-2 p-4 bg-surface-container-lowest rounded-xl active:scale-95 transition-transform">
          <Icon name="receipt_long" size={28} className="text-primary" />
          <span className="text-sm font-medium text-on-surface">History</span>
        </button>
        <button onClick={() => router.push('/student/change-pin')}
          className="flex flex-col items-center gap-2 p-4 bg-surface-container-lowest rounded-xl active:scale-95 transition-transform">
          <Icon name="pin" size={28} className="text-primary" />
          <span className="text-sm font-medium text-on-surface">Change PIN</span>
        </button>
      </div>

      {/* Recent transactions */}
      <p className="font-bold text-on-surface text-sm mb-3">Recent</p>
      {txs.length === 0 ? (
        <p className="text-on-surface-variant text-sm">No transactions yet</p>
      ) : (
        <div className="space-y-2">
          {txs.map(tx => (
            <div key={tx.id} className="flex items-center justify-between px-4 py-3 bg-surface-container-lowest rounded-xl">
              <div className="flex items-center gap-3">
                <Icon name={tx.type === 'topup' ? 'add_circle' : 'remove_circle'} size={20}
                  className={tx.type === 'topup' ? 'text-green-600' : 'text-error'} />
                <div>
                  <p className="text-sm font-medium text-on-surface capitalize">{tx.type}</p>
                  <p className="text-xs text-on-surface-variant">{new Date(tx.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <p className={`font-bold text-sm ${tx.type === 'topup' ? 'text-green-600' : 'text-error'}`}>
                {tx.type === 'topup' ? '+' : '-'}₱{tx.amount.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] Create `src/app/(student)/transactions/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

interface Tx { id: number; type: string; amount: number; balanceBefore: number; balanceAfter: number; note: string; createdAt: string }

export default function TransactionsPage() {
  const router = useRouter()
  const [txs, setTxs] = useState<Tx[]>([])

  useEffect(() => {
    fetch('/api/student/transactions').then(r => r.json()).then(setTxs)
  }, [])

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-sm mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-on-surface-variant mb-6">
        <Icon name="arrow_back" size={20} />
        <span className="text-sm font-medium">Back</span>
      </button>
      <h1 className="text-2xl font-black text-on-surface mb-6" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Transactions</h1>

      {txs.length === 0 ? (
        <p className="text-on-surface-variant text-sm">No transactions yet</p>
      ) : (
        <div className="space-y-2">
          {txs.map(tx => (
            <div key={tx.id} className="px-4 py-3 bg-surface-container-lowest rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-on-surface capitalize">{tx.type}</p>
                <p className={`font-bold text-sm ${tx.type === 'topup' ? 'text-green-600' : 'text-error'}`}>
                  {tx.type === 'topup' ? '+' : '-'}₱{tx.amount.toFixed(2)}
                </p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-on-surface-variant">{new Date(tx.createdAt).toLocaleString()}</p>
                <p className="text-xs text-on-surface-variant">bal: ₱{tx.balanceAfter.toFixed(2)}</p>
              </div>
              {tx.note && <p className="text-xs text-on-surface-variant mt-1">{tx.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] Create `src/app/(student)/change-pin/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

export default function ChangePinPage() {
  const router = useRouter()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = async () => {
    if (newPin !== confirmPin) { setError('PINs do not match'); return }
    if (newPin.length < 4) { setError('PIN must be at least 4 digits'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/student/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed'); setLoading(false); return }
    router.push('/student/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="text-on-surface-variant">
            <Icon name="arrow_back" size={22} />
          </button>
          <h1 className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Change PIN</h1>
        </div>

        <div className="p-4 bg-secondary-container rounded-xl mb-6 text-on-secondary-container text-sm">
          Choose a new 4–6 digit PIN. You will use this at the kiosk when paying.
        </div>

        <div className="space-y-4">
          {[
            { label: 'Current PIN', val: currentPin, set: setCurrentPin },
            { label: 'New PIN', val: newPin, set: setNewPin },
            { label: 'Confirm New PIN', val: confirmPin, set: setConfirmPin },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">{label}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={val}
                onChange={e => set(e.target.value)}
                className="w-full px-4 py-4 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface outline-none focus:border-primary text-center text-2xl tracking-[0.5em]"
              />
            </div>
          ))}
        </div>

        {error && <p className="text-error text-sm text-center mt-3">{error}</p>}

        <button
          onClick={handleChange}
          disabled={loading || !currentPin || !newPin || !confirmPin}
          className="w-full mt-6 bg-primary text-on-primary rounded-xl px-6 py-4 font-black text-lg shadow-primary-glow active:scale-[0.98] transition-transform disabled:opacity-40"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {loading ? 'Saving…' : 'Set New PIN'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] Create `src/app/(student)/register/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

export default function StudentRegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ studentIdNumber: '', fullName: '', course: '', year: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/student/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed'); setLoading(false); return }
    setDone(true)
  }

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background text-center">
      <Icon name="check_circle" size={64} className="text-primary mb-4" />
      <h1 className="text-2xl font-black text-on-surface mb-2" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Registration Submitted</h1>
      <p className="text-on-surface-variant text-sm max-w-xs mb-6">Visit the canteen admin with your ID for face-to-face verification. You will receive your QR card once activated.</p>
      <button onClick={() => router.push('/student')} className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold shadow-primary-glow">
        Back to Login
      </button>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push('/student')} className="text-on-surface-variant">
            <Icon name="arrow_back" size={22} />
          </button>
          <h1 className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Register</h1>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Student ID Number', key: 'studentIdNumber', placeholder: '7-digit or 6-digit ID' },
            { label: 'Full Name', key: 'fullName', placeholder: 'Last, First Middle' },
            { label: 'Course / Department', key: 'course', placeholder: 'BSCS, BSIT…' },
            { label: 'Year / Level', key: 'year', placeholder: '1st Year, Faculty…' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1.5">{label}</label>
              <input
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface text-sm outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>

        {error && <p className="text-error text-sm mt-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || !form.studentIdNumber || !form.fullName || !form.course || !form.year}
          className="w-full mt-6 bg-primary text-on-primary rounded-xl px-6 py-4 font-black text-lg shadow-primary-glow active:scale-[0.98] disabled:opacity-40"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {loading ? 'Submitting…' : 'Submit Registration'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] Test full student flow: register → login → dashboard → change PIN → transactions. Verify 3-min inactivity logs out.

- [ ] Commit:
```bash
git add src/app/(student)/dashboard/page.tsx src/app/(student)/transactions/page.tsx src/app/(student)/change-pin/page.tsx src/app/(student)/register/page.tsx
git commit -m "add student portal pages"
```

---

## Task 15: Cashless Identify API

**Files:** Create `src/app/api/cashless/identify/route.ts`

- [ ] Create `src/app/api/cashless/identify/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const { qrToken } = await request.json()
  if (!qrToken) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const student = await prisma.studentAccount.findUnique({
    where: { qrToken },
    select: {
      id: true, fullName: true, studentIdNumber: true, accountType: true,
      photoUrl: true, balance: true, status: true,
      pinLockedUntil: true,
    },
  })

  if (!student) return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 })
  if (student.status === 'frozen') return NextResponse.json({ error: 'Account frozen' }, { status: 403 })
  if (student.status === 'pending') return NextResponse.json({ error: 'Account not activated' }, { status: 403 })

  if (student.pinLockedUntil && new Date() < student.pinLockedUntil) {
    const secondsLeft = Math.ceil((student.pinLockedUntil.getTime() - Date.now()) / 1000)
    return NextResponse.json({ error: `PIN locked. Try again in ${secondsLeft}s` }, { status: 429 })
  }

  return NextResponse.json({
    id: student.id,
    fullName: student.fullName,
    studentIdNumber: student.studentIdNumber,
    accountType: student.accountType,
    photoUrl: student.photoUrl,
    balance: student.balance,
  })
}
```

- [ ] Commit:
```bash
git add src/app/api/cashless/identify/route.ts
git commit -m "add cashless identify api"
```

---

## Task 16: Cashless Pay API

**Files:** Create `src/app/api/cashless/pay/route.ts`

- [ ] Create `src/app/api/cashless/pay/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPin } from '@/lib/pin-utils'

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 30

export async function POST(request: NextRequest) {
  const { qrToken, pin, orderId } = await request.json()
  if (!qrToken || !pin || !orderId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const student = await prisma.studentAccount.findUnique({ where: { qrToken } })
  if (!student) return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 })
  if (student.status === 'frozen') return NextResponse.json({ error: 'Account frozen' }, { status: 403 })
  if (student.status === 'pending') return NextResponse.json({ error: 'Account not activated' }, { status: 403 })

  if (student.pinLockedUntil && new Date() < student.pinLockedUntil) {
    const secondsLeft = Math.ceil((student.pinLockedUntil.getTime() - Date.now()) / 1000)
    return NextResponse.json({ error: `PIN locked. Try again in ${secondsLeft}s` }, { status: 429 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.paymentStatus === 'paid') return NextResponse.json({ error: 'Order already paid' }, { status: 400 })

  const pinValid = await verifyPin(pin, student.pinHash)

  if (!pinValid) {
    const newAttempts = student.pinAttempts + 1
    const locked = newAttempts >= MAX_ATTEMPTS
    await prisma.studentAccount.update({
      where: { id: student.id },
      data: {
        pinAttempts: locked ? 0 : newAttempts,
        pinLockedUntil: locked ? new Date(Date.now() + LOCKOUT_SECONDS * 1000) : null,
      },
    })
    if (locked) {
      return NextResponse.json({ error: `Too many attempts. Locked for ${LOCKOUT_SECONDS}s` }, { status: 429 })
    }
    return NextResponse.json({ error: `Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt(s) left` }, { status: 401 })
  }

  if (student.balance < order.totalAmount) {
    return NextResponse.json({ error: `Insufficient balance. Balance: ₱${student.balance.toFixed(2)}` }, { status: 400 })
  }

  const balanceBefore = student.balance
  const balanceAfter = balanceBefore - order.totalAmount

  await prisma.$transaction([
    prisma.studentAccount.update({
      where: { id: student.id },
      data: { balance: balanceAfter, pinAttempts: 0, pinLockedUntil: null },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'paid', status: 'confirmed', studentAccountId: student.id },
    }),
    prisma.studentTransaction.create({
      data: {
        studentAccountId: student.id,
        type: 'payment',
        amount: order.totalAmount,
        balanceBefore,
        balanceAfter,
        orderId,
      },
    }),
  ])

  return NextResponse.json({ ok: true, balanceAfter })
}
```

- [ ] Commit:
```bash
git add src/app/api/cashless/pay/route.ts
git commit -m "add cashless pay api with pin lockout"
```

---

## Task 17: Kiosk Payment Page — Add Cashless Option

**Files:** Modify `src/app/(kiosk)/payment/page.tsx`

- [ ] In `src/app/(kiosk)/payment/page.tsx`, change the `selected` type and add cashless handling:

Line 14 — change type:
```typescript
const [selected, setSelected] = useState<'cash' | 'gcash' | 'cashless' | null>(null)
```

In `handleConfirm`, after the GCash branch (line 37), add:
```typescript
if (selected === 'cashless') {
  router.push(`/payment/cashless?order=${order.orderNumber}&amount=${totalAmount}&orderId=${order.id}`)
  return
}
```

- [ ] In the payment options grid (after GCash button), add a Cashless button:
```typescript
{/* Cashless */}
<button
  onClick={() => setSelected('cashless')}
  className={`flex flex-col items-center gap-3 sm:gap-4 p-5 sm:p-8 rounded-xl transition-all duration-150 active:scale-95 ${
    selected === 'cashless'
      ? 'bg-primary text-on-primary shadow-primary-glow'
      : 'bg-surface-container-lowest text-on-surface shadow-ambient'
  }`}
>
  <Icon name="badge" size={48} className={selected === 'cashless' ? 'text-on-primary' : 'text-primary'} filled={selected === 'cashless'} />
  <div className="text-center">
    <p className="font-headline font-black text-xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Cashless</p>
    <p className="text-sm opacity-70 mt-1">Scan your QR card</p>
  </div>
</button>
```

- [ ] Also update the Order POST body to include the order `id` in the response. Check `src/app/api/orders/route.ts` — the response already includes `order.id` via the full `order` object. The payment page uses `order.orderNumber` — also grab `order.id`:

In `payment/page.tsx` line where it gets order:
```typescript
const order = await res.json()
clearCart()
if (selected === 'gcash') {
  router.push(`/payment/gcash?order=${order.orderNumber}&amount=${totalAmount}`)
} else if (selected === 'cashless') {
  router.push(`/payment/cashless?order=${order.orderNumber}&amount=${totalAmount}&orderId=${order.id}`)
} else {
  router.push(`/confirmed?order=${order.orderNumber}&method=${selected}&amount=${totalAmount}`)
}
```

- [ ] Change the grid from `grid-cols-1 min-[420px]:grid-cols-2` to `grid-cols-1 min-[420px]:grid-cols-3` to fit 3 options.

- [ ] Commit:
```bash
git add src/app/(kiosk)/payment/page.tsx
git commit -m "add cashless option to payment page"
```

---

## Task 18: Kiosk Cashless Scan + PIN Page

**Files:** Create `src/app/(kiosk)/payment/cashless/page.tsx`

- [ ] Create `src/app/(kiosk)/payment/cashless/page.tsx`:

```typescript
'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'
import { Html5Qrcode } from 'html5-qrcode'

type Stage = 'scanning' | 'confirm' | 'pin' | 'processing' | 'success' | 'error'

interface StudentInfo {
  id: number
  fullName: string
  studentIdNumber: string
  accountType: string
  photoUrl: string
  balance: number
}

function CashlessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderNumber = searchParams.get('order') ?? ''
  const amount = parseFloat(searchParams.get('amount') ?? '0')
  const orderId = parseInt(searchParams.get('orderId') ?? '0')

  const [stage, setStage] = useState<Stage>('scanning')
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [lockMsg, setLockMsg] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerDivId = 'cashless-qr-scanner'

  useEffect(() => {
    if (stage !== 'scanning') return

    const scanner = new Html5Qrcode(scannerDivId)
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        await scanner.stop()
        await handleScan(decodedText)
      },
      () => {} // ignore frame errors
    ).catch(() => setError('Camera unavailable. Check browser permissions.'))

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [stage])

  const handleScan = async (qrToken: string) => {
    setError('')
    const res = await fetch('/api/cashless/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Invalid QR')
      setStage('error')
      return
    }
    setStudent({ ...data, _qrToken: qrToken } as StudentInfo & { _qrToken: string })
    setStage('confirm')
  }

  const handlePay = async () => {
    if (pin.length < 4) { setError('Enter your PIN'); return }
    setStage('processing')
    setError('')
    const qrToken = (student as unknown as { _qrToken: string })?._qrToken
    const res = await fetch('/api/cashless/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken, pin, orderId }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 429) setLockMsg(data.error)
      else setError(data.error ?? 'Payment failed')
      setStage('pin')
      return
    }
    setStage('success')
    setTimeout(() => {
      router.push(`/confirmed?order=${orderNumber}&method=cashless&amount=${amount}`)
    }, 2000)
  }

  const addPinDigit = (d: string) => {
    if (pin.length < 6) setPin(p => p + d)
  }
  const delPinDigit = () => setPin(p => p.slice(0, -1))

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-8 py-3 sm:py-4 bg-surface-container-low shrink-0">
        <button onClick={() => router.push('/payment')}
          className="flex items-center gap-2 text-on-surface-variant active:scale-95 transition-transform">
          <Icon name="arrow_back" size={24} />
          <span className="font-body text-sm font-medium">Back</span>
        </button>
        <div className="text-xl sm:text-2xl font-black italic text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Cashless Pay
        </div>
        <div className="w-16" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">

        {/* Amount */}
        <div className="text-center">
          <p className="text-on-surface-variant font-medium mb-1">Order {orderNumber}</p>
          <p className="font-headline font-black text-5xl text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            ₱{amount.toFixed(0)}
          </p>
        </div>

        {/* SCANNING stage */}
        {stage === 'scanning' && (
          <div className="w-full max-w-sm flex flex-col items-center gap-4">
            <p className="text-on-surface-variant text-sm text-center">Hold your QR card in front of the camera</p>
            <div id={scannerDivId} className="w-72 h-72 rounded-xl overflow-hidden bg-black" />
            {error && <p className="text-error text-sm text-center">{error}</p>}
          </div>
        )}

        {/* CONFIRM stage */}
        {stage === 'confirm' && student && (
          <div className="w-full max-w-sm flex flex-col items-center gap-4">
            <div className="w-full bg-surface-container-lowest rounded-2xl p-5 flex items-center gap-4">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                  <Icon name="person" size={32} className="text-on-surface-variant" />
                </div>
              )}
              <div>
                <p className="font-black text-on-surface text-lg" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{student.fullName}</p>
                <p className="text-on-surface-variant text-sm">{student.studentIdNumber} · {student.accountType}</p>
                <p className="text-primary font-bold mt-1">Balance: ₱{student.balance.toFixed(2)}</p>
              </div>
            </div>

            {student.balance < amount && (
              <div className="w-full p-4 bg-error-container rounded-xl text-on-error-container text-sm text-center">
                Insufficient balance (₱{student.balance.toFixed(2)} available)
              </div>
            )}

            <p className="text-on-surface-variant text-sm text-center">Is this the right person?</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => { setStage('scanning'); setStudent(null) }}
                className="flex-1 bg-surface-container text-on-surface rounded-xl py-4 font-bold active:scale-95 transition-transform">
                Not me
              </button>
              <button
                onClick={() => { if (student.balance >= amount) setStage('pin') }}
                disabled={student.balance < amount}
                className="flex-1 bg-primary text-on-primary rounded-xl py-4 font-bold shadow-primary-glow active:scale-95 disabled:opacity-40 transition-transform">
                Correct
              </button>
            </div>
          </div>
        )}

        {/* PIN stage */}
        {(stage === 'pin' || stage === 'processing') && student && (
          <div className="w-full max-w-xs flex flex-col items-center gap-6">
            <div className="text-center">
              <p className="text-on-surface font-bold">{student.fullName}</p>
              <p className="text-on-surface-variant text-sm">Enter your PIN to pay ₱{amount.toFixed(0)}</p>
            </div>

            {/* PIN dots */}
            <div className="flex gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pin.length ? 'bg-primary' : 'bg-surface-container'}`} />
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3 w-full">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
                <button
                  key={i}
                  onClick={() => d === '⌫' ? delPinDigit() : d ? addPinDigit(d) : null}
                  disabled={stage === 'processing' || !d}
                  className={`py-4 rounded-xl font-black text-2xl transition-all active:scale-95 ${
                    d === '⌫' ? 'bg-surface-container text-on-surface' :
                    d ? 'bg-surface-container-lowest text-on-surface shadow-ambient' : 'invisible'
                  } disabled:opacity-40`}
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {d}
                </button>
              ))}
            </div>

            {error && <p className="text-error text-sm text-center">{error}</p>}
            {lockMsg && <p className="text-error text-sm text-center">{lockMsg}</p>}

            <button
              onClick={handlePay}
              disabled={pin.length < 4 || stage === 'processing'}
              className="w-full bg-primary text-on-primary rounded-xl py-4 font-black text-xl shadow-primary-glow active:scale-[0.98] disabled:opacity-40 transition-transform flex items-center justify-center gap-3"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {stage === 'processing' ? (
                <><Icon name="hourglass_empty" size={24} className="animate-spin" /> Processing…</>
              ) : (
                <><Icon name="check_circle" size={24} filled /> Pay ₱{amount.toFixed(0)}</>
              )}
            </button>

            <button onClick={() => { setStage('scanning'); setStudent(null); setPin('') }}
              className="text-on-surface-variant text-sm">
              Cancel
            </button>
          </div>
        )}

        {/* SUCCESS stage */}
        {stage === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <Icon name="check_circle" size={80} className="text-primary" filled />
            <p className="font-black text-2xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Payment Successful!</p>
            <p className="text-on-surface-variant text-sm">Redirecting…</p>
          </div>
        )}

        {/* ERROR stage */}
        {stage === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <Icon name="error" size={64} className="text-error" />
            <p className="text-error font-bold text-lg">{error}</p>
            <button onClick={() => { setStage('scanning'); setError('') }}
              className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold shadow-primary-glow">
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default function CashlessPage() {
  return (
    <Suspense>
      <CashlessContent />
    </Suspense>
  )
}
```

- [ ] Test end-to-end:
  1. Create student in admin, top up ₱500
  2. Load QR in admin student detail page, print card
  3. On kiosk: add item to cart → payment → Cashless
  4. Scan printed QR (or hold phone showing QR to camera)
  5. Confirm student identity
  6. Enter PIN
  7. Verify payment confirmed, balance reduced in admin

- [ ] Commit:
```bash
git add src/app/(kiosk)/payment/cashless/page.tsx
git commit -m "add kiosk cashless scan and pin page"
```

---

## Self-Review Checklist

- [x] **Spec: DB models** — StudentAccount, StudentTransaction, Order relation → Tasks 2
- [x] **Spec: QR token** — UUID, not personal data, invalidated on regen → Tasks 3, 6
- [x] **Spec: Admin create + activate** — both paths implemented → Tasks 5, 6
- [x] **Spec: Top-up with admin log** — adminId stored on transaction → Task 7
- [x] **Spec: QR print card** — SVG returned from API, print window opened → Task 10
- [x] **Spec: Student portal** — login, dashboard, transactions, change PIN, register → Tasks 11–14
- [x] **Spec: First-login force PIN change** — middleware redirect + isTemporaryPin flag → Tasks 3, 4, 12
- [x] **Spec: Inactivity auto-logout** — 3-min timer in layout → Task 13
- [x] **Spec: Kiosk IP lock** — middleware KIOSK_IP env var → Task 4
- [x] **Spec: Camera scan + identify + PIN + pay** — Tasks 15–18
- [x] **Spec: 3-attempt PIN lockout** — pinAttempts + pinLockedUntil in pay API → Task 16
- [x] **Spec: Atomic payment** — prisma.$transaction → Task 16
- [x] **Spec: Freeze/unfreeze** — PATCH action in detail API → Task 6
- [x] **Spec: PIN reset** — PATCH action resets to temp PIN → Task 6
- [x] **Spec: accountType student/faculty** — derived from ID length → Tasks 5, 12
