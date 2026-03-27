# Cài đặt (Settings)

Trang Cài đặt cho phép bạn tuỳ chỉnh mọi khía cạnh của ClawX. Truy cập bằng cách nhấn **Cài đặt** trên thanh bên hoặc biểu tượng bánh răng.

## Giao diện

### Chủ đề (Theme)
Chọn giao diện sáng, tối, hoặc tự động theo hệ thống:
- **Sáng (Light)** — Nền trắng, chữ đen
- **Tối (Dark)** — Nền đen, chữ trắng — dễ chịu khi dùng ban đêm
- **Hệ thống (System)** — Tự động theo cài đặt máy tính của bạn

### Ngôn ngữ
Chuyển đổi giữa:
- 🇻🇳 Tiếng Việt
- 🇬🇧 English
- 🇯🇵 日本語

### Thu gọn thanh bên
Bật để ẩn bớt thanh bên, tạo không gian rộng hơn cho nội dung chính.

---

## Nhà cung cấp AI (Providers)

Đây là nơi bạn quản lý các dịch vụ AI mà ClawX sử dụng.

### Xem danh sách
Mỗi nhà cung cấp hiển thị:
- Tên và biểu tượng
- Trạng thái: **"Đã cấu hình"** (xanh) hoặc **"Chưa có key"** (xám)
- Nhãn **"Mặc định"** nếu đang là provider chính

### Thêm nhà cung cấp mới

1. Nhấn nút **"Thêm"**
2. Chọn loại:
   - **OpenAI** — Dùng ChatGPT, GPT-4
   - **Anthropic** — Dùng Claude
   - **Google** — Dùng Gemini
   - **DeepSeek** — Giá rẻ, chất lượng tốt
   - **OpenRouter** — Truy cập nhiều model qua một key
   - **Ollama** — Chạy AI miễn phí trên máy (không cần API key)
   - **Custom** — Bất kỳ dịch vụ tương thích
3. Nhập **API Key** (lấy từ trang web nhà cung cấp)
4. (Tuỳ chọn) Nhập **Base URL** nếu dùng server riêng
5. Nhấn **"Xác nhận"** để kiểm tra kết nối
6. Nhấn **Lưu**

### Đặt làm mặc định
Nhấn **"Đặt mặc định"** trên provider bạn muốn dùng chính. Model mặc định sẽ được dùng cho tất cả cuộc chat và tác vụ cron.

### Sửa / Xoá
- Nhấn **Sửa** để thay đổi API key hoặc cấu hình
- Nhấn **Xoá** để loại bỏ provider

### Khởi động lại OpenClaw
Nếu thay đổi provider mà chat không hoạt động, nhấn nút **"Khởi động lại OpenClaw"** để áp dụng thay đổi.

---

## Gateway

Hiển thị trạng thái hệ thống AI bên trong:
- **Trạng thái**: Đang chạy / Đã dừng
- **Port**: Cổng kết nối (mặc định 18789)
- **Nhật ký**: Nhấn **"Xem logs"** để đọc nhật ký hoạt động, hữu ích khi cần xử lý lỗi
- **Tự động khởi động**: Bật để Gateway tự chạy khi mở ClawX

---

## Cập nhật

Nhấn **"Kiểm tra cập nhật"** để xem có phiên bản mới không. Nếu có, nhấn **"Cập nhật"** để tải và cài đặt tự động.

---

## Truy cập từ xa (Tunnel)

Xem chi tiết tại trang [Truy cập từ xa](/usage/tunnel).

---

## Google Workspace

Kết nối tài khoản Google để AI truy cập Gmail, Google Drive, Calendar, Sheets, Docs:

1. Nhấn **"Kết nối Google"**
2. Đăng nhập tài khoản Google và cho phép quyền truy cập
3. Sau khi kết nối, bạn sẽ thấy email đã liên kết
4. Cài thêm skill **Google Workspace** trong trang Skills để sử dụng

Để ngắt kết nối, nhấn **"Ngắt kết nối"**.

---

## Bảo mật

### Đổi mật khẩu
Nếu đã đặt mật khẩu cho ClawX:
1. Nhập **mật khẩu hiện tại**
2. Nhập **mật khẩu mới** (tối thiểu 4 ký tự)
3. Nhập lại để **xác nhận**
4. Nhấn **"Đổi mật khẩu"**

### Đăng xuất
Nhấn **"Đăng xuất"** để thoát phiên đăng nhập hiện tại.

---

## Giới thiệu

Hiển thị thông tin về ClawX:
- Tên ứng dụng và phiên bản
- Liên kết trang web và cộng đồng
