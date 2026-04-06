# CanteenKiosk — Remaining Features Design

**Date:** 2026-04-07  
**Scope:** Everything not yet built after Phase 1–2 (kiosk screens) and partial Phase 3 (admin auth + dashboard)

---

## 1. Commit Untracked API Routes

Three routes exist on disk but are untracked in git:
- `src/app/api/categories/[id]/route.ts` — PATCH + DELETE
- `src/app/api/menu-items/[id]/route.ts` — PATCH + DELETE
- `src/app/api/upload/route.ts` — POST (file upload to `public/images/menu/`)

Action: commit as-is with no changes.

---

## 2. Admin Menu Management (`/admin/menu`)

### Design reference
`stitch/food_management/` — inventory-style table with image, name, category, price, stock bar, edit/delete actions. Header has "+ Add New Item" button. Stats row shows total items, low stock count, out of stock count.

### Layout
Single page with two tabs: **Categories** and **Menu Items** (default).

**Menu Items tab:**
- Stats row: Total Items, Low Stock (stock ≤ 5), Out of Stock (stock = 0)
- Search input (client-side filter by name)
- Category filter dropdown
- Table: thumbnail | name | category badge | price | stock bar | available toggle | edit | delete
- "+ Add Item" button opens a slide-in drawer (not a modal, so the table stays visible)

**Categories tab:**
- List of all categories with name, icon (Material Symbol), sort order, active toggle
- Inline edit (click name to rename), drag handle for reorder (or up/down arrows — simpler)
- "+ Add Category" inline form at bottom of list

### Drawer (Add / Edit Item)
Fields: Name, Category (select), Price (₱), Description (textarea), Image (upload via `/api/upload`), Stock (number), Available (toggle)

Image upload: shows current image thumbnail if editing; drag-and-drop or click-to-browse; calls `POST /api/upload` then stores returned URL in form state.

### New API routes
- `POST /api/categories` — `{ name, icon, sortOrder }` → create category
- `POST /api/menu-items` — `{ name, categoryId, price, description, image, stock, available }` → create item
- Modify `GET /api/categories` to accept `?all=true` (skip `active: true` + `available: true` filters) for admin use
- Modify `GET /api/menu-items` to accept `?all=true` (return unavailable items too) for admin use

---

## 3. Admin Orders Page (`/admin/orders`)

### Layout
- Filter bar: status tabs (All | Pending GCash | Awaiting Cash | Preparing | Ready | Completed | Cancelled)
- Date filter: Today (default) / This Week / All
- Order list: cards or table rows showing order number, time, items summary, total, payment method, status badge, action button
- Action button per status:
  - `pending_verification` → "Confirm GCash Payment" (marks `paymentStatus: paid`, `status: preparing`)
  - `awaiting_payment` → "Confirm Cash Payment" (same effect)
  - `preparing` → "Mark Ready"
  - `ready` → "Mark Complete"
  - `completed` / `cancelled` → no action

### New API routes
- `PATCH /api/orders/[id]` — `{ status?, paymentStatus?, confirmedById? }` → update order
- `GET /api/orders` — list orders with optional `?status=` and `?date=today|week|all` filters

---

## 4. Admin GCash Config (`/admin/gcash`)

### Design reference
`stitch/payment_settings/` — card showing active QR account with name, number, monthly usage bar, toggle active button. Secondary list of backup accounts.

### Layout
- Active account card (highlighted in primary color): account name, number, QR image preview, monthly received / monthly limit bar, "Set Active" indicator
- List of all accounts below with same fields at smaller scale
- "+ Add Account" button → drawer with fields: Account Name, Account Number, Monthly Limit, QR Code Image (upload)
- Each account row: edit, delete, "Set Active" toggle (only one can be active at a time)

### New API routes
- `GET /api/gcash` — list all GCash accounts
- `POST /api/gcash` — create account
- `PATCH /api/gcash/[id]` — update account (name, number, limit, QR image, isActive). Setting `isActive: true` deactivates all others first.
- `DELETE /api/gcash/[id]` — delete account

---

## 5. Admin Settings (`/admin/settings`)

Simple settings page — no complex logic. Settings stored directly in the DB is overkill for this scope; use a `settings.json` file in the project root that the server reads/writes.

### Settings exposed
- **Kiosk idle timeout** (seconds before screensaver, default 60)
- **GCash payment timeout** (minutes before auto-cancel, default 5)
- **Receipt footer message** (string, e.g. "Thank you for dining at HyperBite!")
- **Operating hours** (open time + close time, or "Always open" toggle)

### API
- `GET /api/settings` — read settings.json
- `PATCH /api/settings` — write settings.json

Settings are read by the kiosk GCash countdown timer and the idle screensaver for their timeout values.

---

## 6. Kitchen Display System (`/kitchen`)

### Purpose
Staff-facing screen (tablet or monitor in the kitchen). Shows active orders that need to be prepared.

### Layout
- Header: "Kitchen Display" + current time + order count badge
- Grid of order cards (2–3 columns depending on screen width)
- Each card shows:
  - Order number (large, bold)
  - Time elapsed since order placed (e.g. "3 min ago", colored red if > 10 min)
  - Payment method badge (Cash / GCash)
  - Items list with quantities
  - Status: `pending_verification` (yellow — awaiting payment confirm), `awaiting_payment` (yellow), `preparing` (blue), `ready` (green)
  - Action button: "Start Preparing" / "Mark Ready" / "Complete"
- Cards sorted by age (oldest first)
- Completed orders disappear after 10 seconds

### No login required
The KDS is intended for a fixed kitchen screen — no auth gate. Anyone on LAN can access `/kitchen`.

### Polling
Fetch `GET /api/orders?date=today&exclude=completed,cancelled` every 3 seconds — returns all of today's orders that are not completed or cancelled.

### Sound
Play a short beep on new order arrival (compare previous fetch vs current, if new order IDs appear → play audio). Use Web Audio API to generate a simple tone (no file needed).

---

## 7. Order Queue Display (`/queue`)

### Purpose
Student-facing TV/monitor near the counter. Shows which orders are being prepared and which are ready.

### Layout
Full-screen, two columns:
- **Left — Now Preparing** (blue tint): order numbers currently being cooked
- **Right — Ready for Pickup** (green tint, larger text, pulsing animation): order numbers ready

Footer: "Please proceed to the counter when your number is called."

### Polling
Fetch every 5 seconds. Show only today's orders with status `preparing` or `ready`.

### No login required
Public screen, no auth.

---

## Data Flow Summary

```
Kiosk places order → POST /api/orders
  → status: awaiting_payment (cash) or pending_verification (gcash)

Admin/KDS confirms payment → PATCH /api/orders/[id] { status: preparing, paymentStatus: paid }
  → appears in KDS "preparing" column and queue "Now Preparing"

KDS marks ready → PATCH /api/orders/[id] { status: ready }
  → moves to queue "Ready for Pickup" with pulse animation

KDS/admin marks complete → PATCH /api/orders/[id] { status: completed }
  → disappears from KDS and queue
```

---

## API Routes Summary

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/categories` | Create category |
| GET | `/api/categories?all=true` | Admin: all categories + items |
| POST | `/api/menu-items` | Create menu item |
| GET | `/api/menu-items?all=true` | Admin: all items incl. unavailable |
| GET | `/api/orders` | List orders with filters |
| PATCH | `/api/orders/[id]` | Update order status/payment |
| GET | `/api/gcash` | List all GCash accounts |
| POST | `/api/gcash` | Create GCash account |
| PATCH | `/api/gcash/[id]` | Update GCash account |
| DELETE | `/api/gcash/[id]` | Delete GCash account |
| GET | `/api/settings` | Read settings |
| PATCH | `/api/settings` | Write settings |

---

## Design Conventions (from stitch + DESIGN.md)

- Warm red palette: `primary: #b90905`, `surface: #fff4f4`
- Fonts: Plus Jakarta Sans (headlines), Be Vietnam Pro (body)
- No 1px borders — use background color shifts for separation
- Rounded corners: `xl` (3rem) for cards, `full` for pills/badges
- Material Symbols Outlined for all icons
- Admin sidebar already built — all pages slot into existing layout
- KDS and Queue are standalone fullscreen pages (no admin sidebar)
