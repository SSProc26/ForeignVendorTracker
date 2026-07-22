# Vendor Tracker — PRD

## Original problem statement (verbatim, ID)
> buat ini jadi bentuk web based dan pwa dong...hilangkan watermark emergent. ada opsi 5 tone warna. buat login menu dan ada config atur2 member di role admin. buat lebih rapi dan detil dan interaktif dan saling terintegrasi dan sempurna. buat yang komperehensif.

Source: `vendor-tracker (8).html` — a single-file Foreign Vendor Registration Tracker (checklists per country, workflow: DRAFT → IN_REVIEW → PENDING_APPROVAL → APPROVED/RETURNED, master data, history).

## Architecture
- Backend: FastAPI (single service, `/api/*`) + MongoDB (motor).
- Frontend: React + shadcn/ui + Tailwind + TanStack Query + React Router.
- Auth: JWT (Bearer, localStorage key `vt_token`), bcrypt.
- Storage: Emergent Object Storage for document uploads.
- PWA: manifest.json + sw.js + SVG icons.
- 5 corporate themes via CSS custom props on `[data-theme=…]`.

## User personas
- **Admin**: manages users, all vendor operations, sees audit log.
- **Approver**: approves / returns items in `PENDING_APPROVAL`.
- **Reviewer**: creates & edits vendors, submits for review/approval.

## Core requirements (static)
- Convert HTML tracker → web PWA, remove Emergent watermark.
- 5 corporate color themes (Steel Blue, Forest, Burgundy, Slate, Copper).
- Login page + JWT auth.
- Admin member management: create, role, active toggle, reset password, delete.
- Comprehensive & integrated: dashboard analytics, ledger, workflow, doc upload, master data, history, audit log, country reference, CSV export.

## Implemented (2026-02)
- **Auth**: passcode-only login. `GET /api/auth/members` (public) → dropdown pilih member. `POST /api/auth/login` body `{user_id, passcode}` (6-digit). `POST /api/auth/change-passcode` self-service. Admin buat member cukup {name, role} — default passcode `123456`. `POST /api/users/{id}/reset-password` (body opsional) reset ke `123456`.
- **Backend**: `/api/auth/{members,login,logout,me,change-passcode}`, `/api/users/*`, `/api/vendors/*` (CRUD + status + history + `db.transitions`), `/api/documents/*` via Emergent object storage, `/api/reference/*`, `/api/analytics/{summary,insights,insights-pdf,audit-log}`, `/api/vendors-export/csv`, `/api/settings/theme`.
- **Analytics `/api/analytics/insights`** returns: sla_by_status, sla_by_handler, aging, return_rate, weekly_trend (8w), category_completeness, country_risk, **time_heatmap (7×24)**, **rework (distribution + top vendors + avg per approved)**, **eta (predicted per non-approved vendor: baseline avg per-country × completeness factor, with confidence high/medium/low)**.
- **PDF Export** (`/api/analytics/insights-pdf`): reportlab-generated multi-table report with KPIs, SLA per status, handler perf, aging, country risk, ETA, rework, category coverage. Accepts `?auth=` query or Bearer header.
- **Frontend**:
  - Login: member cards + 6-digit PIN pad (mobile-friendly, keyboard support, auto-submit).
  - Admin Users: create dialog hanya {name, role}; toast menampilkan default passcode; tombol Reset one-click (konfirmasi → reset ke `123456`).
  - Settings: PinInput dua kolom (passcode lama + baru) untuk ganti passcode sendiri.
  - Insights & SLA page: 4 KPIs + Dwell chart + Return vs Approved + 8-week trend + Handler table + Aging + Country risk + Doc completeness + **Time-of-day/Day-of-week heatmap** + **Rework distribution & hotlist** + **Predictive ETA table** + Export PDF button.
- **PWA**: manifest + service worker + SVG icons.
- **Testing**: 57/57 backend pytest pass (iteration 3), all frontend flows validated.

## Backlog (post-MVP)
- P1: Email notifications on status change (Resend/SendGrid) — deferred by user.
- P1: PDF report export (currently CSV only).
- P1: Object-level RBAC per vendor (assignee-only edit) & row-level notifications.
- P2: PWA offline queue for status changes.
- P2: Password self-reset via email link (currently admin-driven only).
- P2: Migrate FastAPI `on_event` to lifespan handlers.
- P2: Router split (`routers/{auth,users,vendors,documents,analytics}.py`).
- P2: JWT invalidation on password reset (token version / jti blacklist).
- P2: Stricter Pydantic model for `PUT /api/vendors/{id}` payload.

## Test credentials
See `/app/memory/test_credentials.md`.
