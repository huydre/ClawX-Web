# Tác vụ định kỳ (Cron)

Tính năng Cron cho phép bạn đặt lịch để AI tự động gửi tin nhắn đến kênh đã kết nối — ví dụ: gửi tin tức mỗi sáng, nhắc nhở công việc, hoặc báo cáo hàng tuần.

## Tổng quan trang Cron

Khi mở trang **Cron**, bạn sẽ thấy:

- **Thống kê nhanh** — Tổng số tác vụ, đang chạy, tạm dừng, bị lỗi
- **Danh sách tác vụ** — Các tác vụ đã tạo với thông tin chi tiết
- **Nút tạo mới** — Để thêm tác vụ mới

## Tạo tác vụ mới

1. Nhấn nút **"+ Tác vụ mới"**
2. Điền thông tin:

### Tên tác vụ
Đặt tên ngắn gọn để bạn nhận ra. Ví dụ: "Tin tức buổi sáng", "Nhắc nhở họp".

### Tin nhắn (Prompt)
Nội dung chỉ thị cho AI. Đây là những gì AI sẽ thực hiện mỗi lần chạy.

**Ví dụ:**
- *"Tóm tắt 5 tin tức công nghệ nổi bật nhất hôm nay bằng tiếng Việt"*
- *"Nhắc nhở: Đã đến giờ họp team lúc 10h!"*
- *"Cho tôi biết thời tiết hôm nay ở Hà Nội"*

### Lịch chạy

Bạn có thể chọn từ các **lịch có sẵn** hoặc tự nhập:

| Lịch có sẵn | Ý nghĩa |
|-------------|---------|
| Mỗi phút | Chạy mỗi phút (dùng để test) |
| Mỗi 5 phút | Chạy mỗi 5 phút |
| Mỗi 15 phút | Chạy mỗi 15 phút |
| Mỗi giờ | Chạy đầu mỗi giờ |
| Hàng ngày lúc 9h sáng | Chạy mỗi ngày lúc 9:00 |
| Hàng ngày lúc 6h tối | Chạy mỗi ngày lúc 18:00 |
| Thứ Hai hàng tuần lúc 9h | Chạy mỗi thứ Hai lúc 9:00 |
| Ngày 1 hàng tháng lúc 9h | Chạy ngày đầu tiên mỗi tháng |

Nếu muốn lịch khác, bạn có thể nhập **biểu thức cron** thủ công. Ví dụ:
- `30 8 * * 1-5` — 8:30 sáng các ngày trong tuần (Thứ 2 đến Thứ 6)
- `0 12 * * *` — 12h trưa mỗi ngày
- `0 */3 * * *` — Mỗi 3 giờ

ClawX sẽ hiển thị ý nghĩa lịch bằng ngôn ngữ dễ hiểu (ví dụ: "Hàng ngày lúc 08:30").

### Kênh đích
Chọn kênh mà AI sẽ gửi kết quả đến. Bạn cần [kết nối kênh](/usage/channels) trước.

::: tip Discord
Nếu chọn kênh Discord, bạn cần nhập thêm **Channel ID** (ID kênh chat cụ thể trên Discord).
:::

### Bật/Tắt
Bật để tác vụ bắt đầu chạy ngay theo lịch. Tắt để lưu nhưng chưa chạy.

3. Nhấn **Lưu** để tạo tác vụ

## Ví dụ thực tế

### Tin tức buổi sáng
- **Tên:** Tin tức buổi sáng
- **Tin nhắn:** "Tóm tắt 5 tin tức công nghệ nổi bật nhất hôm nay bằng tiếng Việt"
- **Lịch:** Hàng ngày lúc 8h sáng
- **Kênh:** Telegram

### Nhắc nhở công việc
- **Tên:** Nhắc nhở sáng
- **Tin nhắn:** "Nhắc nhở kiểm tra email và cập nhật task board"
- **Lịch:** 8:30 sáng các ngày trong tuần
- **Kênh:** Zalo

### Báo cáo crypto hàng tuần
- **Tên:** Báo cáo crypto
- **Tin nhắn:** "Báo cáo giá Bitcoin và Ethereum trong tuần qua, kèm phân tích xu hướng"
- **Lịch:** Thứ Hai hàng tuần lúc 10h
- **Kênh:** Discord

## Quản lý tác vụ

Mỗi thẻ tác vụ hiển thị:
- **Tên** tác vụ
- **Lịch chạy** dưới dạng dễ đọc
- **Nội dung** tin nhắn (rút gọn)
- **Kênh đích** với biểu tượng
- **Lần chạy cuối** — Thành công hay thất bại, thời gian
- **Lần chạy tiếp** — Thời gian dự kiến

### Các thao tác

| Thao tác | Cách làm |
|----------|----------|
| **Chạy ngay** | Nhấn nút "Chạy ngay" để thực hiện tức thì, không cần chờ lịch |
| **Tạm dừng** | Tắt công tắc để dừng tác vụ |
| **Bật lại** | Bật công tắc để tiếp tục chạy theo lịch |
| **Sửa** | Nhấn biểu tượng chỉnh sửa để thay đổi thông tin |
| **Xoá** | Nhấn biểu tượng xoá và xác nhận |

## Xử lý lỗi

Nếu tác vụ chạy thất bại, thẻ tác vụ sẽ hiển thị:
- Trạng thái **"Lỗi"** với màu đỏ
- Thông báo lỗi cụ thể

Nguyên nhân thường gặp:
- Kênh đích bị mất kết nối → Kiểm tra trang [Kênh](/usage/channels)
- Hệ thống AI (Gateway) không chạy → Kiểm tra [Bảng điều khiển](/usage/dashboard)
- API key hết hạn → Kiểm tra [Cài đặt](/usage/settings)

::: warning Lưu ý
Đảm bảo kênh đích đã kết nối và hệ thống AI đang chạy trước khi tạo tác vụ cron.
:::
