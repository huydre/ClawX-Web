# Quản lý kênh (Channels)

Kênh (Channel) là cầu nối giữa AI và các ứng dụng nhắn tin. Khi bạn kết nối một kênh, AI sẽ tự động nhận và trả lời tin nhắn trên ứng dụng đó.

## Các kênh được hỗ trợ

| Kênh | Cách kết nối |
|------|-------------|
| **Telegram** | Bot Token |
| **Discord** | Bot Token |
| **WhatsApp** | Quét mã QR |
| **Zalo** | Qua OpenZalo CLI |
| **Signal** | Liên kết thiết bị |
| **LINE** | Token |
| **Microsoft Teams** | Token |
| **Google Chat** | Token |
| **Feishu / Lark** | Token |
| **Matrix** | Token |
| **Mattermost** | Token |
| **iMessage** | Liên kết thiết bị (chỉ macOS) |

## Cách thêm kênh mới

1. Vào trang **Kênh** từ thanh bên
2. Nhấn nút **"Thêm kênh mới"**
3. Chọn loại kênh muốn kết nối
4. Nhập thông tin cấu hình (xem hướng dẫn từng kênh bên dưới)
5. Nhấn **Lưu**

---

## Hướng dẫn kết nối từng kênh

### Telegram

Bạn cần tạo một Telegram Bot trước:

1. Mở Telegram, tìm **@BotFather**
2. Gửi lệnh `/newbot`
3. Đặt tên cho bot (ví dụ: "Trợ lý AI của tôi")
4. Đặt username cho bot (ví dụ: `myai_assistant_bot`)
5. BotFather sẽ gửi cho bạn một **Bot Token** (dạng `123456:ABC-DEF...`)
6. Sao chép Token này

Quay lại ClawX:
1. Nhấn **Thêm kênh** → chọn **Telegram**
2. Dán **Bot Token** vào ô tương ứng
3. Chọn **Chính sách DM** (ai được phép nhắn tin cho bot):
   - **Open** — Ai cũng có thể nhắn
   - **Pairing** — Cần phê duyệt từng người
   - **Allowlist** — Chỉ những ID được cho phép
   - **Disabled** — Tắt tin nhắn riêng
4. Nhấn **Lưu**

Bot sẽ tự động kết nối và bắt đầu nhận tin nhắn.

### Discord

Bạn cần tạo một Discord Bot:

1. Truy cập [Discord Developer Portal](https://discord.com/developers/applications)
2. Nhấn **"New Application"** → đặt tên → **"Create"**
3. Vào mục **Bot** ở thanh bên → nhấn **"Add Bot"**
4. Nhấn **"Reset Token"** để lấy Bot Token → sao chép
5. Bật các quyền cần thiết:
   - **Message Content Intent** — Để bot đọc được tin nhắn
   - **Server Members Intent** — Để bot thấy thành viên
6. Vào mục **OAuth2 > URL Generator**:
   - Chọn scope: `bot`
   - Chọn permissions: `Send Messages`, `Read Message History`
   - Sao chép URL và mở để mời bot vào server

Quay lại ClawX:
1. Nhấn **Thêm kênh** → chọn **Discord**
2. Dán **Bot Token**
3. Nhập **Guild ID** (ID server Discord — chuột phải vào tên server → "Copy Server ID")
4. Nhập **Channel ID** (ID kênh chat — chuột phải vào kênh → "Copy Channel ID")
5. Nhấn **Lưu**

::: tip Bật chế độ Developer trên Discord
Để copy ID, bạn cần bật: **Discord Settings > Advanced > Developer Mode**
:::

### WhatsApp

WhatsApp sử dụng phương thức quét mã QR, giống khi đăng nhập WhatsApp Web:

1. Nhấn **Thêm kênh** → chọn **WhatsApp**
2. Một mã QR sẽ hiện ra
3. Mở WhatsApp trên điện thoại → **Thiết bị liên kết** → **Liên kết thiết bị**
4. Quét mã QR trên màn hình ClawX
5. Chờ vài giây để kết nối

Sau khi kết nối, AI sẽ nhận và trả lời tin nhắn WhatsApp của bạn.

### Zalo

Zalo sử dụng OpenZalo CLI (được cài tự động khi dùng `setup.sh`):

1. Nhấn **Thêm kênh** → chọn **Zalo**
2. Làm theo hướng dẫn trên màn hình để kết nối tài khoản Zalo

---

## Trạng thái kênh

Mỗi kênh hiển thị trạng thái với màu sắc rõ ràng:

| Trạng thái | Màu | Ý nghĩa |
|------------|-----|---------|
| **Connected** | 🟢 Xanh | Kênh đang hoạt động, AI đang nhận tin nhắn |
| **Connecting** | 🟡 Vàng | Đang kết nối, chờ vài giây |
| **Disconnected** | ⚪ Xám | Kênh đã tắt hoặc mất kết nối |
| **Error** | 🔴 Đỏ | Có lỗi xảy ra — xem thông báo lỗi để biết chi tiết |

## Phê duyệt ghép nối (Pairing)

Một số kênh (như Telegram với chế độ Pairing) yêu cầu bạn phê duyệt trước khi người dùng có thể chat với bot.

Khi có yêu cầu mới, bạn sẽ thấy thông báo trong mục **Phê duyệt ghép nối**. Nhấn **Chấp nhận** hoặc **Từ chối** cho từng yêu cầu.

## Chỉnh sửa và xoá kênh

- **Chỉnh sửa** — Nhấn vào kênh để xem và thay đổi cấu hình (token, chính sách DM...)
- **Bật/Tắt** — Tắt tạm thời một kênh mà không cần xoá
- **Xoá** — Nhấn nút xoá và xác nhận để loại bỏ kênh hoàn toàn

::: warning Lưu ý
Đảm bảo hệ thống AI (Gateway) đang chạy trước khi thêm kênh. Kiểm tra trạng thái trên [Bảng điều khiển](/usage/dashboard).
:::
