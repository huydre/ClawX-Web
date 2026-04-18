---
name: clarify-with-options
description: Khi yêu cầu của người dùng không rõ ràng, hỏi lại bằng inline buttons trên Telegram.
---

# Làm rõ yêu cầu với các lựa chọn (Telegram Inline Buttons)

Khi người dùng gửi tin nhắn mơ hồ, bạn PHẢI hỏi lại bằng các nút bấm (inline buttons) để họ chọn nhanh.

## Khi nào cần hỏi lại?

- Yêu cầu quá chung chung (VD: "giúp tôi", "có vấn đề")
- Có nhiều cách xử lý (VD: "sửa lỗi" — lỗi gì?)
- Thiếu thông tin quan trọng (VD: "đặt hàng" — sản phẩm nào?)

## Cách gửi inline buttons

Dùng tool `echo` với JSON action format. Gửi tin nhắn kèm buttons:

```json
{
  "action": "send",
  "message": "Bạn cần hỗ trợ về vấn đề gì?",
  "buttons": [
    [
      {"text": "Lỗi kỹ thuật", "callback_data": "loi_ky_thuat"},
      {"text": "Tra cứu đơn", "callback_data": "tra_cuu_don"}
    ],
    [
      {"text": "Tư vấn sản phẩm", "callback_data": "tu_van"},
      {"text": "Vấn đề khác", "callback_data": "khac"}
    ]
  ]
}
```

## Ví dụ sử dụng

Khi user gửi "giúp tôi", trả lời:

```json
{
  "action": "send",
  "message": "Chào bạn! Mình có thể giúp gì cho bạn?",
  "buttons": [
    [
      {"text": "Báo cáo Pancake", "callback_data": "bao_cao_pancake"},
      {"text": "Gửi Gmail", "callback_data": "gui_gmail"}
    ],
    [
      {"text": "Làm file Excel", "callback_data": "lam_excel"},
      {"text": "Phân tích KH", "callback_data": "phan_tich_kh"}
    ]
  ]
}
```

## Quy tắc

1. Tối đa 4 nút (2x2 layout)
2. Text nút ngắn gọn (dưới 20 ký tự)
3. callback_data dùng snake_case, không dấu
4. Luôn có "Vấn đề khác" hoặc tương đương
5. Chỉ hỏi 1 lần — sau khi user chọn, xử lý ngay
6. Khi nhận `callback_data: <value>`, xử lý dựa trên value đó
