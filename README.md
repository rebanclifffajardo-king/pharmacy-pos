# YasMar Pharmacy — POS & Inventory (client demo)

An interactive implementation of the **"Pharmacy POS and inventory system"** design (YasMar Pharmacy branding) built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Base UI), Lucide, Motion and Recharts.

> **Demo Mode.** All data is fictional sample data stored in the browser (localStorage). No backend, environment variables, payment provider or printer is required. Prices, barcodes, batch numbers and supplier details are not verified pharmaceutical, regulatory or pricing information.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`, `npm run typecheck`, `npm run check:seed` (prints seed counts and checks determinism).

Open the app, pick a role on the **Demo sign in** screen (Administrator, Pharmacist, Cashier, Inventory Staff or Manager) and click **Enter Demo Mode**. Demo PINs used for simulated approvals are shown on screen (Admin 1111 · Pharmacist 2222 · Cashier 3333 · Inventory 4444 · Manager 5555).

## Pages

| Route | What works |
|---|---|
| `/login` | Demo role picker (5 roles), no credentials |
| `/dashboard` | KPIs computed from records (today, month, stock, low/out/expiring/expired, gross profit), period filter, sales chart (daily/weekly/monthly/yearly), payment donut, top 10, inventory by category, recent sales, low-stock & expiry widgets, activity feed |
| `/pos` | Search by brand/generic/SKU/barcode, USB scanner input, category & in-stock filters, cart with pack sizes (piece/strip/box) and manual qty, FEFO batch preview, stock validation, expired/quarantined blocking, Rx pharmacist verification, SC/PWD/manual discounts, hold/resume/cancel, Cash · QR Ph (simulated) · Card (simulated), idempotent checkout, success + receipt print |
| `/inventory` | Add/edit/archive medicines, pricing & reorder, status filters, batch & movement detail, CSV import/export |
| `/stock-management` | Expiry buckets, batch tabs (all/90/60/30/expired), stock in/out/adjust/write-off/quarantine/release with authorized user + PIN, movement history, activity log |
| `/purchase-orders` | Create/edit drafts, send, cancel, partial & full receiving with batch + expiry, print PO |
| `/suppliers` | Add/edit/deactivate suppliers, supplied medicines, POs per supplier |
| `/sales` | History with date/payment/cashier/status filters, details, receipt preview & reprint, same-day void, CSV |
| `/refunds` | Authorized partial refunds linked to the original sale, saleable-only restock, history |
| `/reports` | 13 reports with date/category filters, charts, CSV, print and PDF (via the print dialog) |
| `/users` | Staff, roles, status, permission matrix, "sign in as" |
| `/settings` | Pharmacy profile & logo, POS/VAT/discount rules & numbering, printer (58mm, columns, logo, footer, test print with live preview), Reset Demo Data |

## Architecture

```
lib/types            Domain types (≈ future Supabase tables)
lib/mock-data        Deterministic seed: 100 SKUs, 12 categories, 8 suppliers, ~1,000 sales over 12 months, 13 POs, users
lib/services         Pure business logic: pricing, stock/FEFO, sales, refunds, inventory, POs, admin, reports, receipts, payments
lib/store            Zustand store (single source of truth) + `actions` — the only way the UI mutates data
lib/storage          SSR-safe, quota-aware localStorage wrapper
lib/printing         Printer drivers (browser print, ESC/POS bridge) + ESC/POS encoder
lib/auth             Demo role permissions
components/…         Layout, shared UI, POS, payments, receipts and one folder per module
hooks/               Cart store, session/permissions, stock index, barcode scanner
```

Every mutation is a pure service function `(db, ctx, input) → { db, result }` that validates first (stock never goes negative, expired batches are never sold, receipt numbers never reused) and then applies changes immutably. Sales are idempotent per checkout key, so double-clicking **Complete** cannot create two sales or deduct stock twice.

## Printing (XPrinter 58mm)

Receipts are laid out as 32 monospace columns (configurable to 42/48) and printed through a dedicated `#print-root` with `@page { size: 58mm auto; margin: 0 }`, so only the receipt prints. The print animation reports only what can be known: **Preparing → Printing → Print request submitted**. Browser printing cannot confirm that paper came out, so the app never claims hardware completion unless a printer bridge acknowledges the job.

## Limitations (demo)

- Data lives in one browser's localStorage (~1.4 MB); other browsers/devices don't share it. Use **Settings › Demo data › Reset** to restore the seed. Seed dates are anchored to the moment of reset, so "today" always has sales.
- Permissions are UI-only and not a security boundary.
- VAT and SC/PWD calculations are configurable demo rules, not verified Philippine tax treatment. Receipts are marked "DEMO – NOT AN OFFICIAL RECEIPT".
- Rx verification is a simulation and not a substitute for dispensing compliance.
- QR Ph and card payments are simulated and labelled "Demo Payment"; no money moves.

## Next steps

**Supabase:** move tables from `lib/types` to Postgres; implement `finalizeSale`, `createRefund`, `voidSale`, `adjustStock` and `receivePurchaseOrder` as transactional database functions (RPC) with the same validations and an idempotency-key unique index; Supabase Auth for staff with real PINs/passwords; Row Level Security per role and branch; replace `lib/store/actions.ts` with calls to those RPCs.

**Live payments:** a QR Ph-capable acquirer / payment gateway (dynamic QR, webhook confirmation) and a card terminal integration (acquirer SDK or ECR link) — completion only on a server-verified reference; card data never touches this app.

**XPrinter hardware:** implement `window.YasmarPrinter.printEscPos(base64)` in an Android WebView wrapper or a local print service (USB/Bluetooth/LAN) using `lib/printing/escpos.ts`, set the device code page, and enable "ESC/POS bridge" in Settings so the app can show confirmed **Printed / Failed** states.
