# Topup Receipt Design

**Date:** 2026-05-14  
**Status:** Approved

## Problem

When admin tops up a student's balance, there is no printable receipt. Students also have no way to view a detailed receipt for individual topup transactions.

## Goal

- Admin gets a "Print Receipt" button immediately after a successful topup — triggers browser print, isolates receipt via `@media print`
- Student can tap any topup/adjustment row in their transaction history → full-screen modal with receipt details + print button
- Receipt format matches existing order receipt (monospace, thermal-style) for uniformity

## Out of Scope

- Printing from the topup audit list page
- PDF download / email delivery
- Receipts for payment or refund transaction types

---

## Design

### 1. Admin — Student Detail Page

**File:** `src/app/admin/students/[id]/page.tsx`

**State:** Add `lastTopup` to store the transaction object returned by the topup API after a successful topup.

**API change:** `src/app/api/admin/students/[id]/topup/route.ts`  
Add `include: { admin: { select: { username: true } } }` to the `studentTransaction.create` call so the response includes admin username. The API already returns `{ balance, transaction }`.

**Flow:**
1. `doTopup` succeeds → store `lastTopup = data.transaction`, clear form, refresh student
2. Show "Print Receipt" button (with print icon) in the topup section
3. `window.print()` on click

**Print area** (hidden `<div className="print-area">` at page bottom):  
Same `@media print` CSS as confirmed page — hides everything except `.print-area`.

Receipt content (monospace, thermal-style):
```
[StoreName]
CTU - Danao Campus
──────────────────
[STUDENT FULL NAME]
[Student ID Number]
──────────────────
TOP-UP  /  ADJUSTMENT
₱[amount]
──────────────────
Before: ₱[balanceBefore]
After:  ₱[balanceAfter]
Ref: [note]
By: [admin.username]
──────────────────
[createdAt locale string]
```

Store name sourced from `useStoreName()` hook (already used elsewhere in admin).

`lastTopup` is cleared when a new topup form is submitted (so stale receipt can't be re-printed accidentally after a second topup without noticing).

---

### 2. Student — Transactions Page

**File:** `src/app/student/transactions/page.tsx`

**API change:** `src/app/api/student/transactions/route.ts`  
Add `include: { admin: { select: { username: true } } }` to `prisma.studentTransaction.findMany`. Returns admin username for topup/adjustment rows.

**Interface update:**
```ts
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
```

**State:** Add `selectedTx: Tx | null`.

**Row change:** Topup and adjustment rows get a small "Receipt" button. Other types (payment, refund) do not. Pressing sets `selectedTx`.

**Modal:** Full-screen overlay (`fixed inset-0 z-50`) renders when `selectedTx` is set. Contains:
- Same receipt layout as admin print area (student name from student session context or displayed on page)
- "Print" button → `window.print()`
- Close button → `setSelectedTx(null)`

**Print area:** Hidden `<div className="print-area">` renders `selectedTx` receipt content. `@media print` CSS shows only this div.

Student name is already available on the transactions page (fetched from session/profile) — if not, it can be omitted from the student-side receipt since it's implied by the logged-in session.

---

## Receipt Format (both sides identical)

Matches `src/app/(kiosk)/confirmed/page.tsx` print area pattern:
- `font-mono text-sm` container
- Store name: `text-2xl font-black italic`
- Dashed `border-t border-black border-dashed` dividers
- Amount: `text-4xl font-black`
- All other fields: `text-sm font-bold`
- Date: `text-[10px] opacity-50`

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/admin/students/[id]/topup/route.ts` | Add `include: { admin: ... }` to transaction create |
| `src/app/admin/students/[id]/page.tsx` | `lastTopup` state, Print Receipt button, hidden print area |
| `src/app/api/student/transactions/route.ts` | Add `include: { admin: ... }` to findMany |
| `src/app/student/transactions/page.tsx` | `selectedTx` state, Receipt button on rows, modal, hidden print area |
