# Topup Receipt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin gets a printable receipt immediately after topping up a student; students can tap any topup/adjustment in their transaction history to view and print a receipt.

**Architecture:** Admin topup API response already returns the full transaction — extend it with `include: { admin }` to expose the username. Admin page stores the last topup in state and renders a hidden `print-area` div revealed by `@media print` (same pattern as the order confirmed page). Student transactions API gets the same `include: { admin }` addition; the student transactions page gains a `selectedTx` state, a receipt modal, and a matching hidden print area.

**Tech Stack:** Next.js App Router, Prisma, Tailwind CSS, browser print API

---

## File Map

| File | Change |
|------|--------|
| `src/app/api/admin/students/[id]/topup/route.ts` | Add `include: { admin: { select: { username: true } } }` to transaction create |
| `src/app/admin/students/[id]/page.tsx` | Import `useStoreName`; add `lastTopup` state; modify `doTopup` to store result; add Print button + print area |
| `src/app/api/student/transactions/route.ts` | Add `include: { admin: { select: { username: true } } }` to findMany |
| `src/app/student/transactions/page.tsx` | Add `useStoreName`, `selectedTx` state, Receipt button per topup/adjustment row, receipt modal, hidden print area |

---

### Task 1: Admin API — include admin username in topup response

**Files:**
- Modify: `src/app/api/admin/students/[id]/topup/route.ts:41-57`

- [ ] **Step 1: Add `include` to the studentTransaction.create call**

Lines 41-57 currently read:
```ts
    const [, transaction] = await prisma.$transaction([
      prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { balance: balanceAfter },
      }),
      prisma.studentTransaction.create({
        data: {
          studentAccountId: parseInt(id),
          type,
          amount: Math.abs(amount),
          balanceBefore,
          balanceAfter,
          adminId,
          note: note ?? '',
        },
      }),
    ])

    return NextResponse.json({ balance: balanceAfter, transaction })
```
Replace with:
```ts
    const [, transaction] = await prisma.$transaction([
      prisma.studentAccount.update({
        where: { id: parseInt(id) },
        data: { balance: balanceAfter },
      }),
      prisma.studentTransaction.create({
        data: {
          studentAccountId: parseInt(id),
          type,
          amount: Math.abs(amount),
          balanceBefore,
          balanceAfter,
          adminId,
          note: note ?? '',
        },
        include: {
          admin: { select: { username: true } },
        },
      }),
    ])

    return NextResponse.json({ balance: balanceAfter, transaction })
```

- [ ] **Step 2: Manual verify**

In the browser DevTools Network tab, perform a topup on any active student. Confirm the POST response body includes `transaction.admin.username`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/students/[id]/topup/route.ts
git commit -m "include admin username in topup API response"
```

---

### Task 2: Admin page — lastTopup state, Print Receipt button, print area

**Files:**
- Modify: `src/app/admin/students/[id]/page.tsx`

- [ ] **Step 1: Add `useStoreName` import**

Line 6 currently reads:
```tsx
import { Icon } from '@/components/shared/Icon'
```
Add after it:
```tsx
import { useStoreName } from '@/lib/store-context'
```

- [ ] **Step 2: Add `storeName` hook call and `lastTopup` state**

After line 34 (`const router = useRouter()`), add:
```tsx
  const storeName = useStoreName()
```

After line 50 (`const [deleteError, setDeleteError] = useState('')`), add:
```tsx
  const [lastTopup, setLastTopup] = useState<{
    id: number
    type: string
    amount: number
    balanceBefore: number
    balanceAfter: number
    note: string
    createdAt: string
    admin: { username: string } | null
  } | null>(null)
```

- [ ] **Step 3: Modify `doTopup` to store the transaction result**

Lines 76-97 currently read:
```tsx
  const doTopup = async () => {
    const amount = parseFloat(topupAmount)
    if (!amount || !topupNote.trim()) return
    setTopupLoading(true)
    setTopupError('')
    const res = await fetch(`/api/admin/students/${id}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, note: topupNote.trim() }),
    })
    if (!res.ok) {
      const data = await res.json()
      setTopupError(data.error ?? 'Failed')
      setTopupLoading(false)
      return
    }
    setTopupAmount('')
    setTopupNote('')
    setTopupError('')
    await fetch_()
    setTopupLoading(false)
  }
```
Replace with:
```tsx
  const doTopup = async () => {
    const amount = parseFloat(topupAmount)
    if (!amount || !topupNote.trim()) return
    setTopupLoading(true)
    setTopupError('')
    setLastTopup(null)
    const res = await fetch(`/api/admin/students/${id}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, note: topupNote.trim() }),
    })
    if (!res.ok) {
      const data = await res.json()
      setTopupError(data.error ?? 'Failed')
      setTopupLoading(false)
      return
    }
    const data = await res.json()
    setLastTopup(data.transaction)
    setTopupAmount('')
    setTopupNote('')
    setTopupError('')
    await fetch_()
    setTopupLoading(false)
  }
```

- [ ] **Step 4: Add Print Receipt button inside the topup section**

Line 308 currently reads (the Apply button):
```tsx
            <button onClick={doTopup} disabled={topupLoading || !topupAmount || !topupNote.trim()}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-md text-sm font-bold shadow-primary-glow active:scale-95 disabled:opacity-40 self-end">
              {topupLoading ? '…' : 'Apply'}
            </button>
```
Replace with:
```tsx
            <button onClick={doTopup} disabled={topupLoading || !topupAmount || !topupNote.trim()}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-md text-sm font-bold shadow-primary-glow active:scale-95 disabled:opacity-40 self-end">
              {topupLoading ? '…' : 'Apply'}
            </button>
            {lastTopup && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-primary text-xs font-semibold self-end"
              >
                <Icon name="print" size={14} /> Print Receipt
              </button>
            )}
```

- [ ] **Step 5: Add print style and hidden print area before the closing `</div>` on line 403**

Line 402 currently reads:
```tsx
      )}
    </div>
  )
}
```
Replace with:
```tsx
      )}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; display: block !important; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
        }
      `}</style>

      {lastTopup && (
        <div className="print-area hidden invisible bg-white text-black w-full max-w-sm p-4 text-center font-mono text-sm leading-tight">
          <h1 className="text-2xl font-black italic mb-2 mt-4">{storeName}</h1>
          <p className="mb-4 text-xs font-bold">CTU - Danao Campus</p>
          <div className="border-t border-black border-dashed my-4" />
          <p className="text-xl font-black mb-1">{student.fullName}</p>
          <p className="text-xs font-bold mb-4">{student.studentIdNumber}</p>
          <div className="border-t border-black border-dashed my-4" />
          <p className="text-[10px] uppercase font-bold tracking-widest mb-1">
            {lastTopup.type === 'topup' ? 'TOP-UP' : 'ADJUSTMENT'}
          </p>
          <p className="text-4xl font-black mb-1">&#8369;{lastTopup.amount.toFixed(2)}</p>
          <div className="border-t border-black border-dashed my-4" />
          <p className="text-sm font-bold mb-1">Before: &#8369;{lastTopup.balanceBefore.toFixed(2)}</p>
          <p className="text-sm font-bold mb-4">After: &#8369;{lastTopup.balanceAfter.toFixed(2)}</p>
          {lastTopup.note && <p className="text-xs font-bold mb-1">Ref: {lastTopup.note}</p>}
          {lastTopup.admin && <p className="text-xs font-bold mb-4">By: {lastTopup.admin.username}</p>}
          <p className="text-[10px] mt-6 opacity-50 mb-4 tracking-widest">
            Date: {new Date(lastTopup.createdAt).toLocaleString('en-PH')}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Manual verify**

Perform a topup on an active student. Confirm "Print Receipt" button appears. Click it — browser print dialog should open showing only the receipt (store name, student name/ID, amount, before/after balance, note, admin username, date). Confirm a second topup clears the old receipt and shows a fresh one.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/students/[id]/page.tsx
git commit -m "add printable topup receipt to admin student page"
```

---

### Task 3: Student API — include admin username in transactions

**Files:**
- Modify: `src/app/api/student/transactions/route.ts:14-18`

- [ ] **Step 1: Add `include` to the findMany call**

Lines 14-18 currently read:
```ts
  const transactions = await prisma.studentTransaction.findMany({
    where: { studentAccountId: session.studentId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
```
Replace with:
```ts
  const transactions = await prisma.studentTransaction.findMany({
    where: { studentAccountId: session.studentId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      admin: { select: { username: true } },
    },
  })
```

- [ ] **Step 2: Manual verify**

Log in as a student who has topup history. Open DevTools Network tab, navigate to `/student/transactions`. Confirm the GET response includes `admin: { username: "..." }` on topup/adjustment rows and `admin: null` on payment rows.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/student/transactions/route.ts
git commit -m "include admin username in student transactions API"
```

---

### Task 4: Student transactions page — receipt modal + print area

**Files:**
- Modify: `src/app/student/transactions/page.tsx` (full rewrite — file is 49 lines)

- [ ] **Step 1: Replace the entire file**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'
import { useStoreName } from '@/lib/store-context'

interface Tx {
  id: number
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  note: string
  createdAt: string
  admin: { username: string } | null
}

export default function TransactionsPage() {
  const router = useRouter()
  const storeName = useStoreName()
  const [txs, setTxs] = useState<Tx[]>([])
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null)

  useEffect(() => {
    fetch('/api/student/transactions').then(r => r.json()).then(setTxs)
  }, [])

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-sm mx-auto">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; display: block !important; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
        }
      `}</style>

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
                  {tx.type === 'topup' ? '+' : '-'}&#8369;{tx.amount.toFixed(2)}
                </p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-on-surface-variant">{new Date(tx.createdAt).toLocaleString()}</p>
                <p className="text-xs text-on-surface-variant">bal: &#8369;{tx.balanceAfter.toFixed(2)}</p>
              </div>
              {tx.note && <p className="text-xs text-on-surface-variant mt-1">{tx.note}</p>}
              {(tx.type === 'topup' || tx.type === 'adjustment') && (
                <button
                  onClick={() => setSelectedTx(tx)}
                  className="flex items-center gap-1 text-primary text-xs font-semibold mt-2"
                >
                  <Icon name="receipt" size={14} /> Receipt
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Receipt modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setSelectedTx(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-xs w-full text-black font-mono text-sm text-center"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-2xl font-black italic mb-1">{storeName}</p>
            <p className="text-xs font-bold mb-4">CTU - Danao Campus</p>
            <div className="border-t border-black border-dashed my-3" />
            <p className="text-[10px] uppercase font-bold tracking-widest mb-1">
              {selectedTx.type === 'topup' ? 'TOP-UP' : 'ADJUSTMENT'}
            </p>
            <p className="text-4xl font-black mb-1">&#8369;{selectedTx.amount.toFixed(2)}</p>
            <div className="border-t border-black border-dashed my-3" />
            <p className="text-sm font-bold mb-1">Before: &#8369;{selectedTx.balanceBefore.toFixed(2)}</p>
            <p className="text-sm font-bold mb-3">After: &#8369;{selectedTx.balanceAfter.toFixed(2)}</p>
            {selectedTx.note && <p className="text-xs font-bold mb-1">Ref: {selectedTx.note}</p>}
            {selectedTx.admin && <p className="text-xs font-bold mb-3">By: {selectedTx.admin.username}</p>}
            <p className="text-[10px] opacity-50 mb-4 tracking-widest">
              {new Date(selectedTx.createdAt).toLocaleString('en-PH')}
            </p>
            <button
              onClick={() => window.print()}
              className="w-full bg-black text-white px-4 py-3 rounded-xl font-bold text-sm mb-2 flex items-center justify-center gap-2"
            >
              <Icon name="print" size={18} /> Print Receipt
            </button>
            <button
              onClick={() => setSelectedTx(null)}
              className="w-full text-gray-500 text-sm py-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Hidden print area */}
      {selectedTx && (
        <div className="print-area hidden invisible bg-white text-black w-full max-w-sm p-4 text-center font-mono text-sm leading-tight">
          <h1 className="text-2xl font-black italic mb-2 mt-4">{storeName}</h1>
          <p className="mb-4 text-xs font-bold">CTU - Danao Campus</p>
          <div className="border-t border-black border-dashed my-4" />
          <p className="text-[10px] uppercase font-bold tracking-widest mb-1">
            {selectedTx.type === 'topup' ? 'TOP-UP' : 'ADJUSTMENT'}
          </p>
          <p className="text-4xl font-black mb-1">&#8369;{selectedTx.amount.toFixed(2)}</p>
          <div className="border-t border-black border-dashed my-4" />
          <p className="text-sm font-bold mb-1">Before: &#8369;{selectedTx.balanceBefore.toFixed(2)}</p>
          <p className="text-sm font-bold mb-4">After: &#8369;{selectedTx.balanceAfter.toFixed(2)}</p>
          {selectedTx.note && <p className="text-xs font-bold mb-1">Ref: {selectedTx.note}</p>}
          {selectedTx.admin && <p className="text-xs font-bold mb-4">By: {selectedTx.admin.username}</p>}
          <p className="text-[10px] mt-6 opacity-50 mb-4 tracking-widest">
            Date: {new Date(selectedTx.createdAt).toLocaleString('en-PH')}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Manual verify**

Log in as a student with topup history. Open `/student/transactions`. Confirm topup/adjustment rows show a "Receipt" button; payment/refund rows do not. Tap Receipt → modal opens with correct amount, before/after balance, note, admin name, date. Click Print Receipt → browser print dialog shows only the receipt, not the rest of the page. Click outside modal or Close → modal dismisses.

- [ ] **Step 3: Commit**

```bash
git add src/app/student/transactions/page.tsx
git commit -m "add topup receipt modal and print area to student transactions"
```
