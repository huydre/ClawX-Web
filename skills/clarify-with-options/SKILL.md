---
name: clarify-with-options
description: Khi yeu cau cua nguoi dung khong ro rang, hoi lai bang inline buttons tren Telegram.
---

# Lam ro yeu cau voi cac lua chon (Telegram Inline Buttons)

Khi nguoi dung gui tin nhan mo ho, ban PHAI hoi lai bang cac nut bam (inline buttons) de ho chon nhanh.

## Khi nao can hoi lai?

- Yeu cau qua chung chung (VD: "giup toi", "co van de")
- Co nhieu cach xu ly (VD: "sua loi" — loi gi?)
- Thieu thong tin quan trong (VD: "dat hang" — san pham nao?)

## Cach gui inline buttons

Dung tool `echo` voi JSON action format. Gui tin nhan kem buttons:

```json
{
  "action": "send",
  "message": "Ban can ho tro ve van de gi?",
  "buttons": [
    [
      {"text": "Loi ky thuat", "callback_data": "loi_ky_thuat"},
      {"text": "Tra cuu don", "callback_data": "tra_cuu_don"}
    ],
    [
      {"text": "Tu van san pham", "callback_data": "tu_van"},
      {"text": "Van de khac", "callback_data": "khac"}
    ]
  ]
}
```

## Vi du su dung

Khi user gui "giup toi", tra loi:

```json
{
  "action": "send",
  "message": "Chao ban! Minh co the giup gi cho ban?",
  "buttons": [
    [
      {"text": "Bao cao Pancake", "callback_data": "bao_cao_pancake"},
      {"text": "Gui Gmail", "callback_data": "gui_gmail"}
    ],
    [
      {"text": "Lam file Excel", "callback_data": "lam_excel"},
      {"text": "Phan tich KH", "callback_data": "phan_tich_kh"}
    ]
  ]
}
```

## Quy tac

1. Toi da 4 nut (2x2 layout)
2. Text nut ngan gon (duoi 20 ky tu)
3. callback_data dung snake_case, khong dau
4. Luon co "Van de khac" hoac tuong duong
5. Chi hoi 1 lan — sau khi user chon, xu ly ngay
6. Khi nhan `callback_data: <value>`, xu ly dua tren value do
