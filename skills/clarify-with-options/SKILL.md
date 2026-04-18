---
name: clarify-with-options
description: Khi yêu cầu của người dùng không rõ ràng, hỏi lại bằng inline buttons trên Telegram.
---

# Làm rõ yêu cầu với các lựa chọn

Khi người dùng gửi tin nhắn mơ hồ, bạn PHẢI hỏi lại bằng các nút bấm để họ chọn nhanh.

## Khi nào cần hỏi lại?

- Yêu cầu quá chung chung (VD: "giúp tôi", "có vấn đề")
- Có nhiều cách xử lý (VD: "sửa lỗi" — lỗi gì?)
- Thiếu thông tin quan trọng

## Cách gửi nút bấm

Dùng cú pháp `[BUTTONS]...[/BUTTONS]` trong tin nhắn. Plugin sẽ tự động chuyển thành inline buttons trên Telegram.

### Format:

```
Câu hỏi của bạn ở đây

[BUTTONS]
Hiển thị nút 1 | callback_data_1
Hiển thị nút 2 | callback_data_2
---
Hiển thị nút 3 | callback_data_3
Hiển thị nút 4 | callback_data_4
[/BUTTONS]
```

- Mỗi dòng = 1 nút: `text hiển thị | callback_data`
- `---` = xuống hàng mới (tạo row mới)
- `callback_data` dùng snake_case, không dấu

### Ví dụ 1: Phân loại yêu cầu

```
Bạn cần hỗ trợ về vấn đề gì?

[BUTTONS]
Lỗi kỹ thuật | loi_ky_thuat
Tra cứu đơn hàng | tra_cuu_don
---
Tư vấn sản phẩm | tu_van
Vấn đề khác | khac
[/BUTTONS]
```

### Ví dụ 2: Xác nhận hành động

```
Bạn muốn mình thực hiện gì?

[BUTTONS]
Báo cáo Pancake | bao_cao_pancake
Gửi Gmail | gui_gmail
---
Làm file Excel | lam_excel
Phân tích KH | phan_tich_kh
[/BUTTONS]
```

## Quy tắc

1. Tối đa 4 nút (2x2 layout)
2. Text nút ngắn gọn, tiếng Việt có dấu (dưới 20 ký tự)
3. callback_data dùng snake_case, không dấu
4. Luôn có lựa chọn "Vấn đề khác" hoặc tương đương
5. Chỉ hỏi 1 lần — sau khi user chọn, xử lý ngay
6. Khi nhận `callback_data: <value>`, xử lý dựa trên value đó

## Quan trọng

- LUÔN dùng `[BUTTONS]...[/BUTTONS]` khi muốn hiện nút bấm
- KHÔNG dùng bullet points hay text thường cho các lựa chọn
- Nếu user trả lời bằng text thay vì bấm nút, vẫn xử lý bình thường
