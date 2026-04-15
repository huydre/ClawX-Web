# Ticket System — Admin Dashboard Integration Spec

**Date:** 2026-04-15
**From:** ClawX-Web Team
**To:** Admin Dashboard Team

---

## 1. Tong quan

ClawX-Web se them chuc nang "Ho tro nhanh" cho phep nguoi dung gui ticket yeu cau ho tro ky thuat. Data luu vao **Supabase** chung, Admin Dashboard can them phan quan ly tickets.

## 2. Database Schema (Supabase)

Team admin can tao 2 tables trong Supabase project:

```sql
-- Tao bang tickets
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT,                              -- ID thiet bi ClawX
  description TEXT NOT NULL,                   -- Mo ta loi
  contact_info TEXT,                           -- SDD/Zalo/Email cua nguoi dung
  amount INTEGER DEFAULT 500000,               -- Chi phi (VND)
  status TEXT DEFAULT 'pending_payment',        -- Trang thai
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  admin_notes TEXT                             -- Ghi chu cua admin
);

-- Tao bang file dinh kem
CREATE TABLE ticket_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,                      -- URL tren Supabase Storage
  file_name TEXT,
  file_type TEXT,                              -- image/jpeg, video/mp4, ...
  file_size INTEGER,                           -- bytes
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created ON tickets(created_at DESC);
CREATE INDEX idx_ticket_files_ticket ON ticket_files(ticket_id);
```

### Supabase Storage

Tao bucket **`ticket-files`** (public read):
- Path format: `tickets/{ticket_id}/{filename}`
- Max file: 50MB
- Allowed types: image/*, video/*

## 3. Ticket Status Flow

```
pending_payment → confirmed → in_progress → resolved
                                           → cancelled
```

| Status | Mo ta | Ai doi? |
|--------|-------|---------|
| `pending_payment` | Ticket moi, chua thanh toan | ClawX-Web tao |
| `confirmed` | Admin xac nhan da nhan tien | Admin update |
| `in_progress` | Dang xu ly | Admin update |
| `resolved` | Hoan thanh | Admin update, set resolved_at |
| `cancelled` | Huy | Admin update |

## 4. Admin Dashboard can lam gi

### 4.1 Danh sach tickets

- Hien thi tat ca tickets, sort theo `created_at DESC`
- Filter theo `status`: all / pending / confirmed / in_progress / resolved
- Hien thi: ID (8 ky tu dau), mo ta (truncate), status badge, ngay tao, so file

### 4.2 Chi tiet ticket

- Mo ta day du
- Danh sach file dinh kem (click mo/download)
- Thong tin lien he (SDD/Zalo/Email)
- Device ID
- So tien + noi dung chuyen khoan (TICKET{shortId})
- Admin notes (textarea, editable)
- Nut doi status

### 4.3 Actions

| Action | API | Mo ta |
|--------|-----|-------|
| Confirm payment | `UPDATE tickets SET status='confirmed', updated_at=now() WHERE id=?` | Admin xac nhan da nhan tien |
| Start working | `UPDATE tickets SET status='in_progress', updated_at=now() WHERE id=?` | Bat dau xu ly |
| Resolve | `UPDATE tickets SET status='resolved', resolved_at=now(), updated_at=now() WHERE id=?` | Hoan thanh |
| Cancel | `UPDATE tickets SET status='cancelled', updated_at=now() WHERE id=?` | Huy ticket |
| Add notes | `UPDATE tickets SET admin_notes=?, updated_at=now() WHERE id=?` | Ghi chu |

## 5. Telegram Notification

Khi nguoi dung gui ticket, bot Telegram se gui thong bao vao group:

```
📋 Ticket moi #A1B2C3D4
📝 Mo ta loi o day...
📎 2 file dinh kem
💰 500,000 VND (cho thanh toan)
📞 0901234567
🕐 15/04/2026 17:30
```

**Bot rieng** (khong dung chung bot OpenClaw). Team admin cung cap:
- Bot token
- Chat ID cua group

## 6. Thong tin thanh toan

| Field | Value |
|-------|-------|
| Ngan hang | Techcombank |
| STK | MS01T17213302551927 |
| So tien | 500,000 VND |
| Noi dung CK | `TICKET{8 ky tu dau UUID}` |

QR code tu dong tao bang VietQR:
```
https://img.vietqr.io/image/TCB-MS01T17213302551927-compact.png?amount=500000&addInfo=TICKETA1B2C3D4
```

## 7. API Contract (ClawX-Web → Admin API)

ClawX-Web forward ticket data toi admin API. **Khong luu credentials tren LIVA.**

### POST `https://admin.openclaw-box.com/api/tickets`

**Request:** `multipart/form-data`

| Field | Type | Required | Mo ta |
|-------|------|----------|-------|
| `description` | string | Yes | Mo ta loi (min 10 chars) |
| `contact_info` | string | No | SDT/Zalo/Email |
| `device_id` | string | No | ClawX device identifier |
| `files` | File[] | No | Anh/video dinh kem (max 5, max 50MB each) |

**Response (200):**
```json
{
  "success": true,
  "ticket": {
    "id": "uuid",
    "shortId": "A1B2C3D4",
    "status": "pending_payment",
    "amount": 500000
  },
  "qrUrl": "https://img.vietqr.io/image/TCB-MS01T17213302551927-compact.png?amount=500000&addInfo=TICKETA1B2C3D4",
  "files": [{ "name": "screenshot.png", "url": "https://..." }]
}
```

### GET `https://admin.openclaw-box.com/api/tickets/config`

**Response (200):**
```json
{
  "amount": 500000,
  "bankAccount": "MS01T17213302551927",
  "bankName": "TCB",
  "enabled": true
}
```

### Env tren LIVA (chi can 1 bien)

```
ADMIN_API_URL=https://admin.openclaw-box.com
```

## 8. Timeline

| Buoc | Ai | Deadline |
|------|-----|----------|
| Tao Supabase tables + storage | Admin team | Truoc implement |
| Tao Telegram bot + group | Admin team | Truoc implement |
| Cung cap env vars | Admin team | Truoc implement |
| Implement ticket API + UI | ClawX-Web team | Sau khi co env |
| Them ticket management vao admin dashboard | Admin team | Song song |

## 9. Cau hoi cho Admin Team

1. Supabase project URL + anon key?
2. Telegram bot token + group chat ID?
3. Admin dashboard URL (de link tu ticket notification)?
4. Co can them truong nao khac trong tickets table?
5. Co can phan quyen (role) cho ai duoc xem tickets?
