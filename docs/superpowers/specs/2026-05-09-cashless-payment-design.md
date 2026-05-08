# Cashless Payment System Design
**Date:** 2026-05-09
**Study Title:** Development of an ID QR Code-Based Cashless Payment System for Enhanced Canteen Transactions

---

## Overview

Add a school-exclusive cashless payment option to the existing CanteenKiosk system. Students and faculty receive a physical QR card (admin-printed) linked to a prepaid balance account. At the kiosk, they scan their QR card with the camera, enter a 4-digit PIN, and payment is deducted from their balance. An admin portal manages accounts, top-ups, and QR card generation.

---

## Architecture

Same Next.js PWA codebase. No separate app or deployment.

| Route Group | Who | Access |
|---|---|---|
| `/` (kiosk) | Kiosk device only | IP-locked via middleware (`KIOSK_IP` env var) |
| `/student/*` | Students/faculty on school network | Blocked from kiosk IP |
| `/admin/*` | Admin/staff | Existing session auth, unchanged |

Middleware enforces both directions — kiosk can't reach `/student`, student devices can't reach kiosk routes.

---

## Database Models

### New: `StudentAccount`

```prisma
model StudentAccount {
  id              Int      @id @default(autoincrement())
  studentIdNumber String   @unique
  accountType     String   @default("student") // "student" (7-digit) | "faculty" (6-digit)
  fullName        String
  course          String
  year            String
  photoUrl        String   @default("")
  pinHash         String
  balance         Float    @default(0)
  qrToken         String   @unique
  status          String   @default("pending") // "pending" | "active" | "frozen"
  createdAt       DateTime @default(now())
  activatedAt     DateTime?
  activatedById   Int?
  activatedBy     AdminUser? @relation(fields: [activatedById], references: [id])
  transactions    StudentTransaction[]
}
```

### New: `StudentTransaction`

```prisma
model StudentTransaction {
  id               Int            @id @default(autoincrement())
  studentAccountId Int
  studentAccount   StudentAccount @relation(fields: [studentAccountId], references: [id])
  type             String         // "topup" | "payment" | "refund"
  amount           Float
  balanceBefore    Float
  balanceAfter     Float
  orderId          Int?
  order            Order?         @relation(fields: [orderId], references: [id])
  adminId          Int?
  admin            AdminUser?     @relation(fields: [adminId], references: [id])
  note             String         @default("")
  createdAt        DateTime       @default(now())
}
```

### Modified: `Order`

- `paymentMethod` gains `cashless` as valid value
- Add `studentAccountId Int?` + `studentAccount StudentAccount?` relation

### Modified: `AdminUser`

- Add `activatedAccounts StudentAccount[]` relation
- Add `studentTransactions StudentTransaction[]` relation

---

## Student Account Creation

Two paths, same result:

**Path A — Student self-registers:**
1. Student visits `/student/register` on their phone
2. Fills: student ID number, full name, course, year, optional photo
3. Account created with `status: pending`
4. Student goes to admin face-to-face for verification
5. Admin activates account in `/admin/students` → `status: active`
6. Admin generates + prints QR card, tells student temp PIN (last 4 digits of student ID number)
7. Student logs into `/student` → forced PIN change before accessing dashboard

**Path B — Admin creates account directly:**
1. Admin fills student details in `/admin/students/new`
2. Account created with `status: active` immediately
3. Admin generates + prints QR card, tells student temp PIN face-to-face
4. Student logs into `/student` → forced PIN change

**Account types:**
- 7-digit ID → `accountType: student`
- 6-digit ID → `accountType: faculty`
- No external MIS validation — admin face-to-face verification is the gate
- Future recommendation: integrate with school MIS to validate ID numbers on registration

---

## QR Card

- `qrToken`: a unique random string (e.g. UUID) generated on account activation — never the student ID number itself
- QR encodes only the `qrToken` — no personal data in the QR
- Admin panel renders a printable QR card: student name, ID number, account type, QR code
- Printed via browser print dialog (same approach as existing receipt printing)
- If card lost/stolen: admin clicks "Regenerate QR" → old `qrToken` invalidated → new one issued → reprint required

---

## Kiosk Payment Flow

Student selects **Cashless** on payment page:

```
1. Camera activates (getUserMedia API — works in PWA)
2. Student holds QR card to camera
3. Kiosk decodes qrToken → POST /api/cashless/identify
   → returns: student name, photo, balance (no PIN data)
4. Screen shows: student photo + name + balance + order total
5. On-screen PIN pad appears (4 digits)
6. Student enters PIN → POST /api/cashless/pay
   → server validates pinHash + checks balance + deducts atomically
7a. Success → order confirmed → receipt screen
7b. Wrong PIN → "Incorrect PIN" counter shown
    → 3 failed attempts → 30-second lockout on that qrToken
7c. Insufficient balance → "Insufficient balance" → back to payment options
```

**API endpoints:**
- `POST /api/cashless/identify` — body: `{ qrToken }` → returns student info (no sensitive fields)
- `POST /api/cashless/pay` — body: `{ qrToken, pin, orderId }` → validates + deducts + logs transaction

Balance deduction is atomic (Prisma transaction) — no double-spend possible.

---

## Top-Up Flow (Admin)

1. Admin goes to `/admin/students` → searches student by name or ID number
2. Opens student page → clicks "Top Up"
3. Enters amount → confirms
4. Server credits balance + creates `StudentTransaction` record (`type: topup`, `adminId` logged)
5. Admin sees updated balance immediately

Every top-up is traceable: amount, which admin, timestamp.

---

## Student Portal (`/student`)

| Page | Purpose |
|---|---|
| `/student` | Login: student ID number + PIN |
| `/student/dashboard` | Balance + last 10 transactions |
| `/student/transactions` | Full paginated transaction history |
| `/student/change-pin` | Current PIN → new PIN → confirm |

**Session behavior:**
- Separate session cookie from admin (different cookie name/secret)
- Auto-logout after 3 minutes inactivity
- First-login gate: if PIN matches temp PIN (last 4 of student ID) → force redirect to `/student/change-pin`

---

## Admin Panel Additions (`/admin/students`)

- List all accounts — filterable by status (pending / active / frozen)
- Pending queue — activate or reject with one click
- Create account manually
- Per-student page:
  - Balance + transaction history
  - Top-up button
  - Freeze / Unfreeze account
  - Reset PIN (sets back to temp PIN, student must change on next login)
  - Regenerate QR + print card
- Account type badge: Student / Faculty

---

## Security Model

| Threat | Mitigation |
|---|---|
| Stolen QR card | PIN required — card useless without it |
| Photographed/copied QR | Admin regenerates qrToken → old QR dead instantly |
| PIN brute force at kiosk | 3 attempts → 30s lockout per qrToken |
| Student portal session hijack | 3-min inactivity auto-logout |
| Wrong person using QR | Student name + photo shown before PIN entry — staff can see mismatch |
| Admin fake topups | Every topup logs adminId + timestamp — full audit trail |
| Students opening kiosk on phone | Middleware IP-blocks kiosk routes from non-kiosk IPs |
| Fake student ID registration | Face-to-face admin verification before activation |
| Two-factor narrative | QR card (something you have) + PIN (something you know) |

PINs stored as bcrypt hashes. `qrToken` is a UUID — unguessable. No personal data encoded in QR.

---

## Out of Scope (Future Recommendations)

- MIS integration for automatic ID number validation
- Email/SMS notifications on payment or low balance
- Student-initiated account recovery (currently admin-assisted only)
- Daily spending limits per account
- Balance expiry
