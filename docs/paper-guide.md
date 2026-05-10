# Research Paper Writing Guide
# Development of an ID QR Code-Based Cashless Payment System
# for Enhanced Canteen Transactions

This file guides what to write, where to write it, and how to present the system
in the thesis paper. Use this alongside the prod-notes file.

---

## TYPICAL THESIS CHAPTER STRUCTURE

Chapter 1 – Introduction (Background, Problem, Objectives, Significance, Scope)
Chapter 2 – Review of Related Literature
Chapter 3 – Research Methodology (how the system was built)
Chapter 4 – System Presentation and Discussion (the actual system features)
Chapter 5 – Summary, Conclusions, Recommendations

This guide focuses on Chapter 3 and Chapter 4, which describe the system itself.

---

## CHAPTER 3: RESEARCH METHODOLOGY

### 3.1 Research Design

Write this:

"This study employed a developmental research design, specifically the Agile
Software Development methodology, to design, develop, and evaluate a QR
code-based cashless payment system for the canteen. The system was developed
iteratively, with features incrementally built and tested throughout the
development cycle. The primary programming model followed is a client-server
architecture, where a locally hosted web application serves multiple device
types simultaneously over a shared local area network (LAN)."

---

### 3.2 System Architecture

Write this:

"The system is built using Next.js 14 (App Router) as the full-stack framework,
with React 18 for the user interface, Tailwind CSS for styling, and SQLite as
the local database managed through Prisma ORM. Sessions are encrypted using
iron-session, and all passwords and PINs are hashed using bcrypt (cost factor 10).

The system runs on a single server machine (PC or laptop) connected to a local
Wi-Fi network. All devices — the kiosk tablet, kitchen display, queue monitor,
and student smartphones — access the system through the local network using the
server's IP address and port 3000."

---

### 3.3 System Modules / Components

List and describe each module:

"The system is composed of the following modules:

1. **Kiosk Module (/)** — The customer-facing order interface displayed on a
   dedicated tablet or PC. Students browse the menu, add items to cart, and
   select a payment method (cash, GCash, or cashless).

2. **Kitchen Operator Module (/kitchen)** — Accessed by canteen staff on a
   separate device. Displays incoming orders in real time, allows staff to
   confirm payment and mark orders as preparing or ready for pickup.
   Protected by a staff PIN.

3. **Queue Display Module (/queue)** — A read-only display intended for a
   second monitor or TV. Shows orders currently being prepared and orders
   ready for pickup. Plays an audio announcement when an order is ready.

4. **Admin Panel (/admin)** — Management interface for authorized administrators.
   Provides control over the menu, orders, GCash accounts, student cashless
   accounts, system settings, and financial reports.

5. **Student Portal (/student)** — A mobile-optimized web portal for registered
   students. Displays account balance, transaction history, and a digital copy
   of their QR card. Protected by student ID number and 4-digit PIN.

6. **Cashless Payment Subsystem** — Core contribution of this study. Comprises
   student account management, QR card generation, top-up processing, PIN
   authentication, and balance deduction. Described in detail in Section 3.4."

---

### 3.4 Cashless Payment Subsystem (Core Contribution)

Write this in detail — this is the main novelty of the study:

"The cashless payment subsystem implements a two-factor authentication model
based on the possession of a physical QR card (something the student has) and
a 4-digit personal identification number or PIN (something the student knows).

**Account Registration:** A student account is created either by the system
administrator directly or through student self-registration pending
administrative approval. The administrator verifies the student's identity
face-to-face before activating the account. Student ID numbers follow the
institution's format: 7 digits for students and 6 digits for faculty.

**QR Card Generation:** Upon account activation, the system generates a unique
QR token — a UUID (universally unique identifier) — that serves as the account
identifier encoded in the QR code. The token contains no personally identifiable
information. The administrator prints the QR card and hands it to the student
with a temporary PIN equal to the last four digits of their student ID number.

**PIN Management:** Students are required to change their PIN upon first login
to the student portal. PINs are stored exclusively as bcrypt hashes and are
never retrievable in plain text. Failed PIN attempts are tracked per account:
three consecutive failures at the kiosk trigger a 30-second lockout; five
failures at the student portal trigger a 15-minute lockout.

**Top-Up Process:** Students add funds to their account by physically presenting
cash to the canteen administrator. The administrator credits the amount through
the admin panel. Every top-up transaction requires a mandatory reference note
and is permanently logged with the administrator's identity and timestamp,
providing a full audit trail.

**Payment Process at Kiosk:** When a student selects the Cashless payment
method, the kiosk activates its camera. The student presents their physical
QR card to the camera. The system reads the QR token using the jsQR library
via the browser's getUserMedia API, identifies the account, and displays the
student's name and available balance. The student then enters their 4-digit PIN
using an on-screen numpad. If the PIN is correct and the balance is sufficient,
the amount is atomically deducted from the student's balance and the order is
confirmed, progressing immediately to the kitchen preparation queue.

**Cashier Fallback:** In cases where the student is unable to use the kiosk
camera (e.g., damaged card, camera malfunction), the kitchen operator can
manually enter the student's ID number and PIN through the kitchen display to
process the payment on the student's behalf."

---

### 3.5 Security Design

Write this:

"Security was incorporated at multiple layers throughout the system:

- **Network-level isolation:** Kiosk pages are restricted to a designated device
  IP address via server-side middleware, preventing students from accessing the
  order interface on their personal devices.

- **Authentication:** Admin access is protected by session-based authentication
  using encrypted cookies. Student access requires student ID number and PIN.
  Kitchen access is protected by a configurable staff PIN.

- **Brute-force protection:** Rate limiting is applied to login endpoints (10
  attempts per minute per IP address). Per-account lockouts are enforced for
  repeated failed PIN attempts at both the kiosk and the student portal.

- **Data integrity:** All financial operations — balance deduction, top-up
  crediting — are executed within atomic database transactions to prevent
  race conditions and double-spending.

- **Audit trail:** All top-up and balance adjustment transactions are permanently
  recorded and cannot be deleted, even when a student account is deactivated
  (soft delete). This ensures administrative accountability.

- **Two-factor payment:** Cashless payments require both a physical QR card
  and a known PIN, mitigating the risk of unauthorized use if a card is lost
  or stolen."

---

### 3.6 Data Flow / System Flowcharts

Draw these flowcharts for Chapter 3 or as appendices:

**Flowchart 1: Cashless Payment Flow (Main)**

  START
  → Student selects items and proceeds to payment
  → Student selects "Cashless" payment method
  → System creates order (status: pending_verification)
  → Kiosk activates camera
  → Student presents QR card
  → System reads QR token → identifies student account
  → [Account frozen/invalid?] → YES → Error, back to payment options
  → Display student name, balance, order amount
  → [Sufficient balance?] → NO → Show "Insufficient balance", option to change method
  → Student enters 4-digit PIN
  → [PIN correct?] → NO → Increment attempt counter
    → [3 attempts reached?] → YES → 30-second lockout → END
    → NO → Show remaining attempts → back to PIN entry
  → Atomically deduct balance + mark order as "Confirmed (Cashless Paid)"
  → Kitchen display shows order as "Cashless — Paid"
  → Operator presses "Start Preparing"
  → Order status: Preparing → Queue display updates
  → Operator marks "Ready for Pickup"
  → Queue display announces order number
  → Operator marks "Complete" → stock deducted
  END

**Flowchart 2: Student Account Registration Flow**

  START
  → Student visits /student/register OR admin goes to Admin → Students → New Account
  → [Self-register path?]
    → Student fills form (ID, name, course, year)
    → Account created with status: PENDING
    → Student visits admin counter with valid ID
    → Admin verifies identity face-to-face
    → Admin activates account
  → [Admin-create path?]
    → Admin fills student details
    → Account created with status: ACTIVE immediately
  → System generates unique QR token (UUID)
  → Admin loads QR → prints card → hands to student
  → Admin verbally gives temporary PIN (last 4 digits of student ID)
  → Student logs into /student portal
  → System detects temp PIN → forces PIN change
  → Student sets new 4-digit PIN
  → Account fully active
  END

**Flowchart 3: Top-Up Flow**

  START
  → Student approaches canteen admin with cash
  → Admin goes to Admin → Students → search student
  → Admin opens student detail page
  → Admin enters amount and mandatory reference note (e.g. "Cash received, ₱500")
  → System credits balance atomically
  → StudentTransaction record created (type: topup, adminId, timestamp, note)
  → Student checks balance in /student portal
  END

**Flowchart 4: Order Flow (All Payment Methods)**

  START → Student places order → Payment method selected:
  
  [CASH]
    → Order status: awaiting_payment
    → Kitchen shows "Confirm Cash — ₱XX"
    → Cashier collects cash → confirms in kitchen
    → Order: preparing → ready → complete → stock deducted
  
  [GCASH]
    → Order status: pending_verification
    → Student scans GCash QR on kiosk screen
    → Student pays via GCash app
    → Student taps "I've Sent Payment" → cart cleared
    → Kitchen shows "Confirm GCash — ₱XX"
    → Cashier verifies GCash receipt → confirms
    → GCash account monthly received credited
    → Order: preparing → ready → complete → stock deducted
  
  [CASHLESS]
    → (See Flowchart 1 above)
    → Order: confirmed → preparing (operator presses Start) → ready → complete
  END

---

## CHAPTER 4: SYSTEM PRESENTATION AND DISCUSSION

This chapter shows screenshots with explanations. Organize by module:

### 4.1 Kiosk Interface
- Welcome/home screen
- Menu browsing (categories, items, add to cart)
- Cart review
- Payment method selection (Cash / GCash / Cashless)
- Cashless scan screen (camera active, QR detected, confirm identity, PIN pad)
- Payment confirmation screen

### 4.2 Kitchen Operator Interface
- Overview of active orders
- Order card states: Awaiting Cash / Pending GCash / Cashless Paid / Preparing / Ready
- Confirming cash/GCash payment
- "Confirm Cashless" with manual PIN entry (fallback)
- Marking order as ready and complete

### 4.3 Queue Display
- Preparing column
- Ready for Pickup column
- Audio announcement on order ready

### 4.4 Admin Panel
- Dashboard (orders today, revenue, cashless stats, pending activations)
- Menu management (categories, items, stock)
- Orders management (filter by status, date)
- GCash account management (monthly limit tracking)
- Student account management (create, activate, freeze, top-up, QR print)
- Top-up audit log
- System settings (store name, timeouts, danger zone)

### 4.5 Student Portal
- Login screen (ID number + PIN)
- Dashboard (balance, top-up guide, quick actions)
- My QR (full-screen digital QR card for backup)
- Transaction history
- Change PIN

---

## PRESENTATION FLOW (ORAL DEFENSE / DEMO)

Suggested sequence for live demo:

1. **Open Admin Panel** — show dashboard stats, explain what each card means
2. **Create a student account** — Admin → Students → New Account, fill details, show QR generation and print
3. **Top up the account** — enter amount + reference note, show balance update
4. **Show Student Portal** — log in as student, show balance, QR, transaction history
5. **Place a cashless order on kiosk**:
   - Browse menu → add item → cart → payment → Cashless
   - Scan QR card with camera → show student identified → enter PIN → payment success
6. **Show kitchen display** — order appears as "Cashless — Paid", press "Start Preparing"
7. **Show queue display** — order appears under Preparing
8. **Mark ready → complete** — show queue update, audio announcement
9. **Back to student portal** — show balance deducted, transaction in history
10. **Show Top-up Audit Log** — demonstrate accountability trail
11. **Demo fallback** — show kitchen "Confirm Cashless" manual PIN entry (student forgot card scenario)
12. **Show security features** — wrong PIN lockout counter, frozen account behavior

Estimated demo time: 10–15 minutes

---

## KEY PHRASES FOR THE PAPER (USE THESE)

On two-factor security:
"The system employs a two-factor authentication model for cashless transactions,
combining a physical QR card (possession factor) with a 4-digit PIN (knowledge
factor), ensuring that unauthorized use is prevented even in cases of card loss
or theft."

On audit trail:
"All balance adjustments are permanently recorded with the administrator's
identity, timestamp, and a mandatory reference note enforced at the API level,
providing an immutable audit trail for financial accountability."

On atomic transactions:
"Balance deductions are executed within atomic database transactions using
Prisma's interactive transaction API, preventing race conditions and ensuring
that no double-spending can occur even under concurrent requests."

On soft delete:
"Deleted student accounts are soft-deleted — the record and all associated
transaction history are retained in the database — ensuring that no financial
records can be erased to conceal unauthorized activity."

On local deployment:
"The system operates entirely within the institution's local area network,
eliminating dependency on external internet connectivity and reducing latency.
All data remains on-premises, addressing data privacy concerns relevant to
student financial information."

---

## LIMITATIONS TO ACKNOWLEDGE IN THE PAPER

1. Kitchen PIN gate uses browser sessionStorage — clears on browser close,
   no server-side session validation.
2. Rate limiter is in-memory — resets on server restart.
3. Top-up accountability relies on institutional oversight in addition to
   technical controls — admin can write a false reference note.
4. No MIS integration — student ID validation is manual (face-to-face).
5. System requires all devices on the same local network — students cannot
   access the student portal outside school Wi-Fi.
6. BarcodeDetector API not used (Android-only on desktop Chrome) — jsQR
   library used instead for cross-browser camera QR scanning.
