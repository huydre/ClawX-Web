# Hướng dẫn mua và sử dụng Codex

**Codex** là gói AI cao cấp tích hợp trong ClawX, sử dụng các model mạnh nhất của OpenAI (GPT-5, Codex). Bạn chỉ cần mua một lần và kết nối tài khoản để sử dụng.

## Giá

**200.000 VND / slot / tháng**

---

## Cách mua Codex

### Bước 1: Mở trang mua Codex

1. Vào **Cài đặt** (Settings)
2. Chọn mục **Nhà cung cấp AI** (Providers)
3. Nhấn **"Thêm"** → chọn **Codex (OpenAI)**
4. Chọn tab **"Mua Codex slot"**

### Bước 2: Nhập email

Nhập **email** bạn muốn dùng để đăng ký. Email này sẽ nhận lời mời từ OpenAI sau khi thanh toán.

### Bước 3: Thanh toán

Nhấn **"Tạo mã QR thanh toán"**. Một mã QR sẽ hiện ra với thông tin:

| Thông tin | Chi tiết |
|-----------|----------|
| **Ngân hàng** | Techcombank |
| **Chủ tài khoản** | TECHLA AI CO., LTD |
| **Số tài khoản** | 39156868 |
| **Số tiền** | 200.000 VND (1 tháng) |
| **Nội dung chuyển khoản** | `CODEX email_của_bạn` |

**Cách thanh toán:**
- Mở app ngân hàng trên điện thoại → **Quét mã QR** hiển thị trên màn hình
- Hoặc chuyển khoản thủ công với đúng nội dung chuyển khoản

::: warning Lưu ý
Nội dung chuyển khoản phải đúng định dạng `CODEX email_của_bạn` để hệ thống xử lý tự động.
:::

### Bước 4: Chờ xử lý

Sau khi thanh toán, hệ thống sẽ xử lý trong **5-15 phút** (giờ hành chính). Bạn sẽ nhận được **email mời** từ OpenAI.

---

## Kích hoạt Codex sau khi mua

### Bước 1: Chấp nhận lời mời

Mở email và nhấn **chấp nhận lời mời** từ OpenAI.

### Bước 2: Đăng nhập OpenAI

Truy cập [platform.openai.com](https://platform.openai.com) và đăng nhập bằng email bạn đã đăng ký.

### Bước 3: Kết nối với ClawX

Quay lại ClawX, nhấn nút **"Kết nối Codex"** (Connect Codex). Một cửa sổ trình duyệt sẽ mở ra để bạn đăng nhập OpenAI và cấp quyền cho ClawX.

Sau khi đăng nhập thành công, cửa sổ sẽ tự đóng và Codex sẽ được kết nối.

::: tip Nếu cửa sổ không tự đóng
Bạn có thể sao chép URL từ thanh địa chỉ trình duyệt và dán vào ô **"Paste callback URL"** trong ClawX.
:::

---

## Sử dụng Codex

Sau khi kết nối thành công, Codex sẽ xuất hiện trong danh sách nhà cung cấp AI. Bạn có thể:

1. **Đặt làm mặc định** — Nhấn "Đặt mặc định" để dùng Codex cho tất cả cuộc chat
2. **Chọn model** — Các model có sẵn:

| Model | Mô tả |
|-------|--------|
| **gpt-5.4** | Model mới nhất, mạnh nhất (mặc định) |
| **gpt-5.3-codex** | Tối ưu cho lập trình |
| **gpt-5.2** | Cân bằng giữa tốc độ và chất lượng |
| **codex-mini** | Nhanh, phù hợp tác vụ đơn giản |

3. **Bắt đầu chat** — Vào trang Chat và trò chuyện bình thường, AI sẽ dùng model Codex

---

## Kết nối nhiều tài khoản

Bạn có thể kết nối **nhiều tài khoản OpenAI** cùng lúc. ClawX sẽ tự động luân chuyển giữa các tài khoản.

### Xem danh sách tài khoản
Trong phần Codex provider, bạn sẽ thấy danh sách các tài khoản đã kết nối với:
- **Email** tài khoản
- **Trạng thái**: Đang hoạt động (xanh) hoặc Hết hạn (đỏ)

### Thêm tài khoản
Nhấn **"Kết nối Codex"** và đăng nhập bằng tài khoản OpenAI khác.

### Xoá tài khoản
Nhấn nút **xoá** bên cạnh tài khoản muốn gỡ.

---

## Câu hỏi thường gặp

### Tôi đã chuyển khoản nhưng chưa nhận được email?
Thời gian xử lý là 5-15 phút trong giờ hành chính. Nếu quá 30 phút, hãy liên hệ hỗ trợ qua [nhóm Zalo](https://zalo.me/g/hxrehm544).

### Token Codex hết hạn thì sao?
ClawX sẽ tự động làm mới token. Nếu không thể làm mới, bạn cần nhấn **"Kết nối Codex"** lại để đăng nhập lại.

### Tôi có thể dùng Codex cho tác vụ Cron không?
Có. Chỉ cần đặt Codex làm provider mặc định, tất cả tác vụ Cron sẽ sử dụng model Codex.
