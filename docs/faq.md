# Câu hỏi thường gặp (FAQ)

## Tổng quan

### ClawX là gì?
ClawX là ứng dụng giúp bạn sử dụng AI dễ dàng qua giao diện đồ hoạ. Bạn có thể chat với AI, kết nối với Telegram/Discord/WhatsApp/Zalo, và đặt lịch tự động — tất cả không cần biết lập trình.

### ClawX có miễn phí không?
ClawX miễn phí. Tuy nhiên, bạn cần API key từ nhà cung cấp AI (OpenAI, Anthropic...) — các dịch vụ này có thể tính phí theo lượng sử dụng. Nếu muốn dùng miễn phí hoàn toàn, hãy dùng **Ollama** để chạy AI trên máy tính của bạn.

### Tôi cần biết lập trình không?
Không. ClawX được thiết kế cho người không biết kỹ thuật. Mọi thứ đều thao tác qua giao diện.

---

## Sử dụng

### Làm sao để bắt đầu chat với AI?
1. Mở ClawX
2. Thêm nhà cung cấp AI trong **Cài đặt > Nhà cung cấp AI** (nếu chưa có)
3. Vào trang **Chat**
4. Nhập tin nhắn và nhấn Enter

### AI không trả lời, phải làm sao?
Kiểm tra theo thứ tự:
1. **Gateway có đang chạy không?** → Xem trên Bảng điều khiển. Nếu dừng, vào Cài đặt > Gateway để khởi động lại
2. **Đã thêm nhà cung cấp AI chưa?** → Vào Cài đặt > Nhà cung cấp AI
3. **API key có hợp lệ không?** → Nhấn "Xác nhận" để kiểm tra lại key
4. **Xem nhật ký lỗi** → Cài đặt > Gateway > Xem logs

### Tôi có thể dùng AI miễn phí không?
Có, bằng cách dùng **Ollama**:
1. Cài đặt Ollama từ [ollama.com](https://ollama.com)
2. Trong ClawX, thêm provider **Ollama** (không cần API key)
3. Bắt đầu chat — AI chạy hoàn toàn trên máy bạn

### Làm sao để AI trả lời tốt hơn?
- Đặt câu hỏi rõ ràng, cụ thể
- Cài thêm skills phù hợp (ví dụ: skill tìm kiếm web để AI có thông tin mới)
- Dùng model mạnh hơn (GPT-4, Claude) thay vì model cơ bản

---

## Kênh (Channels)

### Kênh là gì?
Kênh là cầu nối giữa AI và ứng dụng nhắn tin. Khi kết nối kênh Telegram, AI sẽ tự động trả lời tin nhắn Telegram cho bạn.

### Tôi có thể kết nối bao nhiêu kênh?
Không giới hạn. Bạn có thể kết nối nhiều kênh cùng lúc.

### Kênh bị ngắt kết nối, phải làm sao?
- Kiểm tra token/API key có còn hợp lệ không
- Kiểm tra Gateway đang chạy
- Thử xoá kênh và thêm lại

---

## Tác vụ tự động (Cron)

### Cron là gì?
Cron cho phép bạn đặt lịch để AI tự động thực hiện công việc. Ví dụ: mỗi sáng 8h gửi tin tức vào nhóm Telegram.

### Tại sao tác vụ cron bị lỗi?
- Kênh đích chưa kết nối hoặc bị ngắt
- Gateway không chạy
- API key hết hạn hoặc hết quota

---

## Cập nhật

### Làm sao cập nhật ClawX?
Vào **Cài đặt > Cập nhật** và nhấn **"Kiểm tra ngay"**. Nếu có bản mới, nhấn **"Cập nhật"** để tải và cài đặt.

---

## Lỗi thường gặp

### "Gateway connection error"
Hệ thống AI không khởi động được. Thử:
1. Vào Cài đặt > Gateway > nhấn Khởi động lại
2. Xem logs để tìm nguyên nhân
3. Khởi động lại ClawX

### "Unauthorized" hoặc "Phiên đã hết hạn"
Phiên đăng nhập hết hạn (sau 7 ngày). Đăng nhập lại với mật khẩu của bạn.

### Không thấy kênh nào trên trang Channels
Gateway chưa chạy. Kiểm tra Bảng điều khiển và khởi động Gateway nếu cần.
