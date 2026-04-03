# Quản lý Agent

Agent là một trợ lý AI độc lập với tính cách, mô hình và ngữ cảnh riêng. Mỗi agent có thể kết nối với các kênh nhắn tin khác nhau, sử dụng các skill khác nhau, và phục vụ mục đích riêng biệt.

## Tổng quan giao diện

Trang Agent gồm các phần:

- **Thanh tìm kiếm** — lọc agent theo tên hoặc ID
- **Cross-Agent Communication** — cấu hình giao tiếp giữa các agent
- **Danh sách agent** — hiển thị dạng lưới với emoji, tên, và nút thao tác

## Tạo agent mới

1. Nhấn nút **"Tạo Agent"** ở góc trên bên phải
2. Điền thông tin:
   - **Emoji** — chọn biểu tượng đại diện
   - **Tên hiển thị** — tên thân thiện cho agent (VD: "Trợ lý CSKH")
   - **Workspace** — đường dẫn thư mục riêng (tự động tạo từ tên)
3. **(Tùy chọn)** Cấu hình kênh ngay khi tạo:
   - Chọn loại kênh (Telegram, Discord, WhatsApp, Signal, Feishu, Zalo)
   - Nhập token/thông tin xác thực
   - Nhấn nút xác thực để kiểm tra token
   - Chọn **Chính sách DM** (ai được phép nhắn tin cho bot)
4. Nhấn **Lưu**

### Chính sách DM

| Chính sách | Mô tả |
|-----------|-------|
| **Mở** | Ai cũng có thể nhắn tin cho bot |
| **Ghép cặp** | Duyệt từng người dùng trước khi cho phép |
| **Danh sách cho phép** | Chỉ những user ID được chỉ định |
| **Tắt** | Chặn tất cả tin nhắn trực tiếp |

## Chi tiết agent

Nhấn vào một agent card để mở dialog chi tiết. Có 2 tab:

### Tab Tổng quan

- **Tính cách** — đổi tên hiển thị
- **Mô hình & Cấu hình** — chọn mô hình AI (từ danh sách có sẵn hoặc nhập thủ công)
- **Kênh** — xem kênh đang liên kết (loại kênh, account ID, chính sách DM)
- **Nhà cung cấp AI** — xem trạng thái kết nối provider, có thể sao chép auth từ agent khác

### Tab Tập tin

Quản lý các file ngữ cảnh của agent:

- **SOUL.md** — định nghĩa tính cách, giọng nói, phong cách giao tiếp
- **IDENTITY.md** — thông tin danh tính (tên, vai trò, mục đích)
- **Các file khác** — file cấu hình tuỳ chỉnh

Nhấn vào tên file để xem và chỉnh sửa nội dung, sau đó nhấn **Lưu**.

Phần **Skills** hiển thị danh sách skill đã cài trong workspace của agent.

## Giao tiếp giữa các agent (Cross-Agent)

Cấu hình cách các agent tương tác với nhau:

### Phạm vi nhìn thấy session

| Giá trị | Mô tả |
|---------|-------|
| **Self** | Agent chỉ thấy session của chính nó |
| **Tree** | Thấy session trong cùng cây phân cấp |
| **Agent** | Thấy tất cả session của cùng loại agent |
| **All** | Thấy tất cả session trong hệ thống |

### Agent-to-Agent

Bật/tắt cho phép các agent gửi tin nhắn cho nhau. Hữu ích khi muốn agent chuyên biệt (VD: agent CSKH chuyển sang agent kỹ thuật khi cần).

> **Lưu ý:** Thay đổi Cross-Agent cần khởi động lại Gateway để áp dụng.

## Trò chuyện với agent

Có 2 cách:

1. Nhấn nút **"Trò chuyện"** trên agent card
2. Mở menu (⋮) trên agent card → chọn **Trò chuyện**

Hệ thống sẽ tạo session chat riêng cho agent đó và chuyển về trang Chat.

## Xóa agent

1. Mở menu (⋮) trên agent card
2. Chọn **Xóa**
3. Xác nhận trong dialog

> **Lưu ý:** Xóa agent chỉ xóa cấu hình agent, **workspace và các file vẫn được giữ lại** trên disk. Agent mặc định không thể xóa.

## Ví dụ cấu hình thực tế

### Bot chăm sóc khách hàng

1. Tạo agent "CSKH Bot" với emoji 💬
2. Kết nối kênh Telegram hoặc Zalo
3. Chính sách DM: **Mở** (ai cũng nhắn được)
4. Chỉnh SOUL.md: "Bạn là nhân viên CSKH chuyên nghiệp, trả lời lịch sự và ngắn gọn..."
5. Cài skill phù hợp (FAQ, order tracking...)

### Bot nội bộ team

1. Tạo agent "Dev Assistant" với emoji 🛠️
2. Kết nối kênh Discord
3. Chính sách DM: **Danh sách cho phép** (chỉ team member)
4. Chỉnh SOUL.md cho phong cách kỹ thuật
5. Cài skill: GitHub, coding-agent

### Multi-agent system

1. Tạo nhiều agent chuyên biệt (CSKH, Kỹ thuật, Bán hàng)
2. Bật **Agent-to-Agent** communication
3. Đặt Session Visibility là **All**
4. Mỗi agent kết nối kênh riêng hoặc dùng binding rules để route tin nhắn
