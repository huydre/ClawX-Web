# Cài đặt ClawX

ClawX có hai cách sử dụng: **ứng dụng desktop** (cài trên máy tính) hoặc **phiên bản web** (chạy trên server, truy cập qua trình duyệt).

## Cách 1: Ứng dụng Desktop (Khuyến nghị)

Đây là cách đơn giản nhất — tải về, cài đặt và dùng ngay.

### Bước 1: Tải ứng dụng

Truy cập trang [Releases](https://github.com/ValueCell-ai/ClawX/releases) và tải bản phù hợp:

| Hệ điều hành | File tải về |
|---------------|-------------|
| **Windows** | `ClawX-Setup-x.x.x.exe` |
| **macOS (Intel)** | `ClawX-x.x.x.dmg` |
| **macOS (Apple Silicon)** | `ClawX-x.x.x-arm64.dmg` |
| **Linux** | `ClawX-x.x.x.AppImage` |

### Bước 2: Cài đặt

**Windows:**
1. Mở file `.exe` vừa tải
2. Nhấn **"Install"** nếu được hỏi
3. Chờ cài đặt hoàn tất, ứng dụng sẽ tự mở

**macOS:**
1. Mở file `.dmg` vừa tải
2. Kéo biểu tượng **ClawX** vào thư mục **Applications**
3. Mở ClawX từ Launchpad hoặc thư mục Applications

**Linux:**
1. Chuột phải vào file `.AppImage` → Properties → Permissions → Cho phép thực thi
2. Nhấp đúp để mở

### Bước 3: Thiết lập lần đầu

Khi mở ClawX lần đầu, một trình hướng dẫn (Setup Wizard) sẽ giúp bạn cấu hình nhà cung cấp AI, chọn ngôn ngữ và cài đặt kỹ năng.

---

## Cách 2: Phiên bản Web (Chạy trên server)

Phù hợp khi bạn muốn truy cập ClawX từ nhiều thiết bị qua trình duyệt, hoặc chạy ClawX 24/7 trên server.

### Yêu cầu

- Một máy chủ Linux (VPS, Raspberry Pi, máy tính cũ...)
- Có thể kết nối SSH vào server

### Cài đặt nhanh

Đăng nhập vào server qua SSH, sau đó chạy các lệnh sau:

```bash
git clone https://github.com/huydre/ClawX-Web.git
cd ClawX-Web
chmod +x setup.sh
./setup.sh --install
```

Script sẽ tự động làm mọi thứ:
- Kiểm tra và cài đặt các phần mềm cần thiết
- Build ứng dụng
- Tạo dịch vụ chạy nền tự động
- Cấu hình hệ thống AI

Sau khi cài xong, mở trình duyệt và truy cập `http://<địa-chỉ-IP-server>:2003`.

### Cài đặt bằng Docker

Nếu server đã có Docker, bạn có thể cài nhanh hơn:

```bash
git clone https://github.com/huydre/ClawX-Web.git
cd ClawX-Web
docker compose up -d
```

Truy cập `http://<địa-chỉ-IP-server>:2003` để bắt đầu.
