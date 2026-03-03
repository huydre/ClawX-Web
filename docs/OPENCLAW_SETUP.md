# Hướng dẫn cấu hình OpenClaw cho ClawX-Web

> Tài liệu hướng dẫn thiết lập và kết nối OpenClaw Gateway với ClawX-Web Dashboard.

---

## Mục lục

- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [1. Cài đặt OpenClaw](#1-cài-đặt-openclaw)
- [2. Cấu hình Gateway](#2-cấu-hình-gateway)
- [3. Cấu hình Tunnel (Cloudflare)](#3-cấu-hình-tunnel-cloudflare)
- [4. Cấu hình Channels](#4-cấu-hình-channels)
- [5. Cấu hình ClawX-Web (.env)](#5-cấu-hình-clawx-web-env)
- [6. Khởi chạy](#6-khởi-chạy)
- [7. Xử lý sự cố](#7-xử-lý-sự-cố)
- [Tham khảo](#tham-khảo)

---

## Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu |
|---|---|
| **Node.js** | v20+ |
| **pnpm** | v9+ |
| **OpenClaw CLI** | 2026.1.x+ |
| **Cloudflared** | Mới nhất (tự động cài qua OpenClaw) |

---

## 1. Cài đặt OpenClaw

### 1.1 Cài đặt CLI

```bash
curl -fsSL https://get.openclaw.ai | bash
```

### 1.2 Chạy Onboarding Wizard

```bash
openclaw onboard --install-daemon
```

Wizard sẽ hướng dẫn:
- Cấu hình model providers (API key, base URL)
- Thiết lập Gateway auth (token + password)
- Tạo agent mặc định

### 1.3 Kiểm tra trạng thái

```bash
openclaw gateway status
```

Kết quả mong đợi:
```
Gateway is running on port 18789
```

---

## 2. Cấu hình Gateway

File cấu hình: `~/.openclaw/openclaw.json`

### 2.1 Cấu trúc Gateway Auth

```json
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "your-gateway-token-here",
      "password": "your-password-here"
    }
  }
}
```

| Trường | Mô tả | Bắt buộc |
|---|---|---|
| `port` | Port Gateway lắng nghe | Có (mặc định: `18789`) |
| `mode` | Chế độ chạy (`local`) | Có |
| `bind` | Binding address (`loopback` = chỉ localhost) | Có |
| `auth.mode` | Phương thức xác thực (`token` / `password`) | Có |
| `auth.token` | Gateway auth token | Có |
| `auth.password` | Mật khẩu truy cập Control UI | Khuyến nghị |

### 2.2 Lấy Gateway Token

Nếu cần tạo lại token:

```bash
openclaw doctor --generate-gateway-token
```

Token cũng được hiển thị trong:
```bash
cat ~/.openclaw/openclaw.json | grep token
```

### 2.3 Quản lý Device Pairing

Gateway yêu cầu mỗi thiết bị (trình duyệt, app) phải được **pair** trước khi kết nối. Điều này đảm bảo an toàn khi truy cập qua mạng.

**Xem danh sách devices:**
```bash
openclaw devices list
```

**Approve device đang chờ:**
```bash
openclaw devices approve <requestId>
```

**Xem devices đã pair:**
```bash
cat ~/.openclaw/devices/paired.json | python3 -m json.tool
```

> [!IMPORTANT]
> Kết nối từ `127.0.0.1` (localhost) thường được **auto-approve**.
> Kết nối từ tunnel/remote cần approve thủ công.

### 2.4 Bỏ qua Pairing cho Token Auth (Tùy chọn)

Nếu muốn bypass device pairing khi đã có token hợp lệ, thêm vào `gateway.auth`:

```json
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "your-token",
      "password": "your-password",
      "skipPairingForTokenAuth": true
    }
  }
}
```

> [!WARNING]
> Chỉ bật khi bạn tin tưởng mạng và không expose Gateway ra public internet.

---

## 3. Cấu hình Tunnel (Cloudflare)

ClawX-Web sử dụng Cloudflare Tunnel để expose Gateway ra internet qua domain an toàn.

### 3.1 Tạo Cloudflare API Token

1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Vào **My Profile** → **API Tokens** → **Create Token**
3. Chọn template: **Edit Cloudflare Tunnel**
4. Cấp quyền truy cập vào zone/domain của bạn
5. Copy API token

### 3.2 Cấu hình Tunnel trong .env

```env
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_TUNNEL_DOMAIN=veoforge.ggff.net
CLOUDFLARE_TUNNEL_SUBDOMAIN=clawbox02
```

### 3.3 URL Pattern

Khi tunnel kết nối thành công, ClawX-Web tạo 2 URL:

| URL | Mục đích |
|---|---|
| `https://{subdomain}.{domain}` | ClawX-Web Dashboard |
| `https://dashboard-{subdomain}.{domain}` | OpenClaw Gateway Control UI |

**Ví dụ:**
```
ClawX-Web:  https://clawbox02.veoforge.ggff.net
Gateway UI: https://dashboard-clawbox02.veoforge.ggff.net
```

### 3.4 Kiểm tra Tunnel

```bash
curl -s http://localhost:2003/api/tunnel/status | python3 -m json.tool
```

Kết quả mong đợi:
```json
{
  "running": true,
  "mode": "named",
  "publicUrl": "https://clawbox02.veoforge.ggff.net",
  "dashboardUrl": "https://dashboard-clawbox02.veoforge.ggff.net/?token=abc123",
  "state": "connected"
}
```

---

## 4. Cấu hình Channels

### 4.1 Telegram Bot

1. Tạo bot qua [@BotFather](https://t.me/BotFather) trên Telegram
2. Copy **Bot Token**
3. Thêm vào `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "telegram": {
      "botToken": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
    }
  }
}
```

Hoặc cấu hình qua ClawX-Web UI: **Kênh** → **+ Thêm kênh** → **Telegram**

### 4.2 Zalo (OpenZalo)

1. Chuẩn bị tài khoản Zalo cá nhân
2. Trong ClawX-Web: **Kênh** → **+ Thêm kênh** → **Zalo**
3. Quét mã QR bằng app Zalo

---

## 5. Cấu hình ClawX-Web (.env)

### 5.1 Tạo file .env

```bash
cp .env.example .env
```

### 5.2 Biến môi trường

```env
# === BẮT BUỘC ===

# Port Gateway OpenClaw (phải khớp với openclaw.json)
OPENCLAW_GATEWAY_PORT=18789

# === TUNNEL (Tùy chọn — cần nếu muốn truy cập từ xa) ===

# Cloudflare API Token
CLOUDFLARE_API_TOKEN=your_token

# Domain gốc cho tunnel
CLOUDFLARE_TUNNEL_DOMAIN=veoforge.ggff.net

# Subdomain cố định
CLOUDFLARE_TUNNEL_SUBDOMAIN=clawbox02

# === DEVELOPMENT ===

# Port dev server (chỉ dùng khi develop)
VITE_DEV_SERVER_PORT=5173
```

| Biến | Mô tả | Mặc định |
|---|---|---|
| `OPENCLAW_GATEWAY_PORT` | Port kết nối Gateway | `18789` |
| `CLOUDFLARE_API_TOKEN` | Token API Cloudflare | — |
| `CLOUDFLARE_TUNNEL_DOMAIN` | Domain gốc | — |
| `CLOUDFLARE_TUNNEL_SUBDOMAIN` | Subdomain tunnel | — |
| `VITE_DEV_SERVER_PORT` | Port Vite dev server | `5173` |

---

## 6. Khởi chạy

### 6.1 Cài dependencies

```bash
pnpm install
```

### 6.2 Build và chạy

```bash
pnpm build        # Build frontend
pnpm build:server # Build server
pnpm start        # Chạy production
```

### 6.3 Chạy development

```bash
pnpm dev          # Vite dev server + hot reload
```

### 6.4 Kiểm tra kết nối

Sau khi chạy, xác nhận trong terminal log:

```
✓ Gateway connected
✓ Gateway handshake completed successfully
✓ Gateway password loaded from openclaw.json
✓ Tunnel connected: https://clawbox02.veoforge.ggff.net
```

---

## 7. Xử lý sự cố

### Lỗi: `gateway password missing`

**Nguyên nhân:** Gateway yêu cầu password nhưng ClawX-Web không đọc được.

**Giải pháp:**
1. Kiểm tra `~/.openclaw/openclaw.json` có `gateway.auth.password`
2. Đảm bảo file có quyền đọc: `chmod 644 ~/.openclaw/openclaw.json`
3. Restart ClawX-Web

---

### Lỗi: `pairing required`

**Nguyên nhân:** Device chưa được approve trong Gateway.

**Giải pháp:**
```bash
# Xem devices đang chờ
openclaw devices list

# Approve device
openclaw devices approve <requestId>
```

Hoặc bỏ qua pairing: thêm `"skipPairingForTokenAuth": true` vào `gateway.auth` trong `~/.openclaw/openclaw.json`.

---

### Lỗi: `gateway token missing`

**Nguyên nhân:** URL Gateway Dashboard thiếu token.

**Giải pháp:**
Truy cập Dashboard qua URL có token:
```
https://dashboard-{subdomain}.{domain}/?token=your-gateway-token
```

Token lấy từ: `cat ~/.openclaw/openclaw.json | grep token`

---

### Lỗi: `ECONNREFUSED 127.0.0.1:18789`

**Nguyên nhân:** Gateway chưa chạy.

**Giải pháp:**
```bash
openclaw gateway start
# hoặc
openclaw gateway status  # Kiểm tra trạng thái
```

---

### Lỗi: `Process exited with code null` (khi tắt server)

**Nguyên nhân:** Cloudflared tunnel crash khi shutdown. Đây là lỗi cosmetic, không ảnh hưởng chức năng.

**Giải pháp:** Có thể bỏ qua — server đã tắt thành công.

---

### Lỗi: Cron tasks — `invalid cron.update params`

**Nguyên nhân:** Format payload không đúng theo Gateway schema.

**Quy tắc:**
| Session Target | `payload.kind` | Text field |
|---|---|---|
| `isolated` | `agentTurn` | `message` |
| `main` | `systemEvent` | `text` |

ClawX-Web đã xử lý tự động dựa trên `sessionTarget` của job.

---

## Tham khảo

| Tài nguyên | Link |
|---|---|
| OpenClaw Docs | [openclaw.ai/docs](https://openclaw.ai/docs) |
| Cloudflare Tunnel | [developers.cloudflare.com/cloudflare-one/connections/connect-networks/](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) |
| ClawX-Web Repo | `./README.md` |

---

> **Lưu ý bảo mật:** Không commit file `.env` hoặc tiết lộ `gateway.auth.token`. Luôn sử dụng tunnel hoặc SSH khi truy cập Gateway từ xa.
