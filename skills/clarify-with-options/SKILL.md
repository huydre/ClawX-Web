---
name: clarify-with-options
description: Khi yeu cau cua nguoi dung khong ro rang, hoi lai bang cac lua chon cu the (hien thi dang inline buttons tren Telegram).
---

# Lam ro yeu cau voi cac lua chon

Khi nguoi dung gui tin nhan mo ho hoac co nhieu cach hieu, ban PHAI hoi lai de lam ro truoc khi xu ly. Hien thi cac lua chon de nguoi dung chon nhanh.

## Khi nao can hoi lai?

- Yeu cau qua chung chung (VD: "giup toi", "co van de")
- Co nhieu cach xu ly (VD: "sua loi" — loi gi? o dau?)
- Thieu thong tin quan trong (VD: "dat hang" — san pham nao? so luong?)
- Nguoi dung moi bat dau hoi thoai va chua ro ngua canh

## Cach hoi lai

Su dung inline buttons bang cach viet cac dong bat dau bang `- [ ]` (checkbox markdown). OpenClaw se tu dong chuyen thanh inline buttons tren Telegram.

### Format:

```
[Cau hoi cua ban o day]

- [ ] Lua chon 1
- [ ] Lua chon 2
- [ ] Lua chon 3
```

### Vi du 1: Phan loai yeu cau

```
Ban can ho tro ve van de gi?

- [ ] Loi ky thuat (khong ket noi, loi phan mem)
- [ ] Tra cuu don hang
- [ ] Tu van san pham
- [ ] Van de thanh toan
```

### Vi du 2: Lam ro chi tiet

```
Ban muon sua loi o phan nao?

- [ ] Ket noi WiFi
- [ ] Cai dat phan mem
- [ ] Hien thi man hinh
- [ ] Van de khac
```

### Vi du 3: Xac nhan hanh dong

```
Ban muon toi thuc hien hanh dong nao?

- [ ] Kiem tra trang thai don hang
- [ ] Huy don hang
- [ ] Doi dia chi giao hang
```

## Quy tac quan trong

1. **Toi da 4 lua chon** — qua nhieu se gay roi
2. **Moi lua chon ngan gon** — duoi 30 ky tu
3. **Luon co "Van de khac"** hoac tuong duong — de nguoi dung tu nhap
4. **Chi hoi 1 lan** — sau khi nguoi dung chon, xu ly ngay, KHONG hoi lai
5. **Neu nguoi dung tra loi text thay vi chon** — van xu ly binh thuong
6. **Ngon ngu** — dung tieng Viet co dau khi giao tiep voi nguoi dung

## Sau khi nguoi dung chon

Khi nguoi dung click button, ban se nhan text dang: `callback_data: <gia tri>`
Xu ly ngay dua tren lua chon do. Khong hoi lai nua.
