---
name: clarify-with-options
description: >
  Khi yêu cầu của người dùng không rõ ràng, hỏi lại bằng inline buttons trên Telegram.
  Sử dụng message() format với buttons array để hiển thị các lựa chọn nhanh.

  KHI NÀO DÙNG:
  - Người dùng gửi yêu cầu mơ hồ (VD: "giúp tôi", "có vấn đề")
  - Có nhiều cách xử lý và cần user chọn
  - Thiếu thông tin quan trọng để thực hiện

  KHÔNG DÙNG:
  - Khi yêu cầu đã rõ ràng
  - Khi chỉ cần trả lời text thường
---

# Làm rõ yêu cầu với Inline Buttons

Khi người dùng gửi tin nhắn mơ hồ hoặc có nhiều hướng xử lý, bạn PHẢI hỏi lại bằng inline buttons.

## Cách gửi inline buttons

Dùng format `message({...})` với `buttons` array:

```
message({
  message: "Câu hỏi của bạn ở đây",
  buttons: [
    [
      { text: "Lựa chọn 1", callback_data: "chon_1" },
      { text: "Lựa chọn 2", callback_data: "chon_2" }
    ],
    [
      { text: "Lựa chọn 3", callback_data: "chon_3" },
      { text: "Khác", callback_data: "khac" }
    ]
  ]
})
```

- Mỗi mảng con `[...]` = 1 hàng nút
- `text` = hiển thị trên nút (tiếng Việt có dấu, dưới 20 ký tự)
- `callback_data` = giá trị trả về khi user bấm (snake_case, không dấu)

## Ví dụ 1: Phân loại yêu cầu

Khi user gửi "giúp tôi" hoặc "có vấn đề":

```
message({
  message: "Bạn cần hỗ trợ về vấn đề gì?",
  buttons: [
    [
      { text: "Lỗi kỹ thuật", callback_data: "loi_ky_thuat" },
      { text: "Tra cứu đơn", callback_data: "tra_cuu_don" }
    ],
    [
      { text: "Tư vấn sản phẩm", callback_data: "tu_van" },
      { text: "Vấn đề khác", callback_data: "khac" }
    ]
  ]
})
```

## Ví dụ 2: Chọn hành động

```
message({
  message: "Bạn muốn mình thực hiện gì?",
  buttons: [
    [
      { text: "Báo cáo Pancake", callback_data: "bao_cao_pancake" },
      { text: "Gửi Gmail", callback_data: "gui_gmail" }
    ],
    [
      { text: "Làm file Excel", callback_data: "lam_excel" },
      { text: "Phân tích KH", callback_data: "phan_tich_kh" }
    ]
  ]
})
```

## Ví dụ 3: Xác nhận

```
message({
  message: "Bạn muốn tiếp tục không?",
  buttons: [
    [
      { text: "✅ Đồng ý", callback_data: "dong_y" },
      { text: "❌ Hủy", callback_data: "huy" }
    ]
  ]
})
```

## Quy tắc quan trọng

1. **Tối đa 4 nút** (layout 2x2)
2. **Text nút ngắn gọn** — tiếng Việt có dấu, dưới 20 ký tự
3. **callback_data** — snake_case, không dấu, mô tả rõ lựa chọn
4. **Luôn có lựa chọn mở** — "Vấn đề khác" hoặc "Khác"
5. **Chỉ hỏi 1 lần** — sau khi user chọn, xử lý ngay không hỏi lại
6. **Khi nhận callback** — user bấm nút → bạn nhận text `callback_data: <value>` → xử lý dựa trên value
7. **Nếu user gõ text** thay vì bấm nút → vẫn xử lý bình thường
8. **LUÔN dùng `message({...})`** — không dùng bullet points hay text cho lựa chọn
