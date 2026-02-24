# 🚀 Hướng Dẫn Setup Cloudflare Tunnel Auto-Start

## 📋 Tổng Quan

ClawX Web đã được cấu hình để tự động khởi động Cloudflare Tunnel khi server start. Có 2 chế độ:

### **Quick Tunnel (Khuyến nghị)** ⚡
- ✅ Không cần Cloudflare account
- ✅ Setup trong 2 phút
- ✅ URL ngẫu nhiên `*.trycloudflare.com`
- ⚠️ URL thay đổi mỗi lần restart

### **Named Tunnel (Nâng cao)** 🔧
- ✅ Custom domain của bạn
- ✅ URL cố định không đổi
- ⚠️ Cần Cloudflare account + API token

---

## 🎯 Option 1: Quick Tunnel Auto-Start (Đơn giản nhất)

### Bước 1: Truy cập Settings

```bash
# Trên Armbian, đảm bảo server đang chạy
pm2 status

# Mở trình duyệt
http://192.168.1.18:2003
```

### Bước 2: Enable Quick Tunnel

1. Vào **Settings** → **Cloudflare Tunnel**
2. Chọn tab **Quick Tunnel**
3. Bật toggle switch **Enable Quick Tunnel**
4. Đợi 10-20 giây để tunnel kết nối
5. Copy public URL (dạng: `https://random-name.trycloudflare.com`)

### Bước 3: Verify Tunnel

```bash
# Test từ máy khác hoặc điện thoại
curl https://your-tunnel-url.trycloudflare.com/status

# Hoặc mở trình duyệt
https://your-tunnel-url.trycloudflare.com
```

### Bước 4: Auto-Start đã được cấu hình

✅ **Tunnel sẽ tự động start khi:**
- Server restart
- PM2 restart
- System reboot

**Không cần làm gì thêm!** Tunnel sẽ tự động kết nối lại.

---

## 🔧 Option 2: Named Tunnel Auto-Start (Custom Domain)

### Bước 1: Tạo Cloudflare API Token

1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Vào **My Profile** → **API Tokens**
3. Click **Create Token**
4. Chọn template **Edit Cloudflare Zero Trust**
5. Hoặc tạo custom token với permissions:
   - Account → Cloudflare Tunnel → Edit
   - Zone → DNS → Edit
6. Copy API token (chỉ hiện 1 lần!)

### Bước 2: Setup Named Tunnel

1. Vào **Settings** → **Cloudflare Tunnel**
2. Chọn tab **Named Tunnel**
3. Điền thông tin:
   - **API Token**: Paste token vừa copy
   - **Tunnel Name**: `clawx-armbian` (hoặc tên bạn muốn)
   - **Domain** (optional): `yourdomain.com` (nếu muốn tạo DNS record)
4. Click **Setup Tunnel**
5. Đợi 10-20 giây
6. Tunnel sẽ được tạo và tự động start

### Bước 3: Verify Named Tunnel

```bash
# Check tunnel status
curl http://192.168.1.18:2003/api/tunnel/status

# Test public URL
curl https://your-tunnel-id.cfargotunnel.com
```

### Bước 4: Auto-Start đã được cấu hình

✅ **Named tunnel sẽ tự động start khi:**
- Server restart
- PM2 restart
- System reboot

**Token và config đã được lưu**, không cần setup lại!

---

## 🔄 Quản Lý Tunnel

### Check Status

```bash
# Via API
curl http://localhost:2003/api/tunnel/status

# Via PM2 logs
pm2 logs clawx-web | grep -i tunnel

# Via UI
http://192.168.1.18:2003 → Settings → Cloudflare Tunnel
```

### Restart Tunnel

**Cách 1: Qua UI**
1. Vào Settings → Cloudflare Tunnel
2. Tắt toggle switch
3. Đợi 2 giây
4. Bật lại toggle switch

**Cách 2: Qua API**
```bash
# Stop
curl -X POST http://localhost:2003/api/tunnel/stop

# Start
curl -X POST http://localhost:2003/api/tunnel/start
```

**Cách 3: Restart Server**
```bash
pm2 restart clawx-web
```

### Stop Tunnel

```bash
# Via API
curl -X POST http://localhost:2003/api/tunnel/stop

# Via UI
Settings → Cloudflare Tunnel → Tắt toggle
```

### Xóa Tunnel Hoàn Toàn

```bash
# Via API (Named tunnel only)
curl -X DELETE http://localhost:2003/api/tunnel/teardown

# Via UI
Settings → Cloudflare Tunnel → Named Tunnel → Teardown button
```

---

## 🐛 Troubleshooting

### Tunnel không start

**Kiểm tra logs:**
```bash
pm2 logs clawx-web --lines 50 | grep -i tunnel
```

**Kiểm tra binary:**
```bash
ls -lh ~/.clawx-web/bin/cloudflared
~/.clawx-web/bin/cloudflared --version
```

**Download lại binary:**
```bash
rm -f ~/.clawx-web/bin/cloudflared
pm2 restart clawx-web
```

### Tunnel bị disconnect

**Auto-reconnect sẽ tự động chạy:**
- Retry sau 5s, 15s, 30s, 60s, 120s
- Tối đa 5 lần retry

**Nếu vẫn fail, restart server:**
```bash
pm2 restart clawx-web
```

### URL không accessible

**Kiểm tra firewall:**
```bash
# Cloudflared cần kết nối ra ngoài port 7844
# Không cần mở port vào (inbound)
```

**Test kết nối:**
```bash
curl -I https://your-tunnel-url.trycloudflare.com
```

### Named tunnel không tạo được

**Kiểm tra API token:**
```bash
curl -X POST http://localhost:2003/api/tunnel/validate-token \
  -H "Content-Type: application/json" \
  -d '{"apiToken":"your-token-here"}'
```

**Kiểm tra permissions:**
- Token cần quyền: Account → Cloudflare Tunnel → Edit
- Token cần quyền: Zone → DNS → Edit (nếu dùng custom domain)

---

## 📊 Monitoring

### Check Uptime

```bash
# Via API
curl http://localhost:2003/api/tunnel/status | jq '.uptime'

# Via UI
Settings → Cloudflare Tunnel → Uptime display
```

### Check Public URL

```bash
# Via API
curl http://localhost:2003/api/tunnel/status | jq '.publicUrl'

# Via logs
pm2 logs clawx-web | grep "Public URL"
```

### Check Connection Status

```bash
# Via API
curl http://localhost:2003/api/tunnel/status | jq '.state'

# Possible states:
# - "stopped": Tunnel không chạy
# - "starting": Đang kết nối
# - "connected": Đã kết nối thành công
# - "error": Có lỗi
```

---

## 🔒 Security Notes

### Quick Tunnel
- ✅ URL ngẫu nhiên khó đoán
- ⚠️ Không có authentication mặc định
- 💡 Nên enable authentication trong ClawX settings

### Named Tunnel
- ✅ Custom domain với SSL/TLS
- ✅ Cloudflare DDoS protection
- ✅ API token được encrypt trong database
- 💡 Nên enable Cloudflare Access cho bảo mật cao hơn

---

## 📝 Configuration Files

### Tunnel State
```bash
# Stored in database
~/.clawx-web/db.json

# Check current config
cat ~/.clawx-web/db.json | jq '.cloudflare'
```

### Cloudflared Binary
```bash
# Binary location
~/.clawx-web/bin/cloudflared

# Config directory
~/.clawx-web/cloudflare/
```

### Logs
```bash
# PM2 logs
pm2 logs clawx-web

# Filter tunnel logs
pm2 logs clawx-web | grep -i tunnel

# Filter cloudflared logs
pm2 logs clawx-web | grep -i cloudflared
```

---

## 🎯 Quick Reference

### Start Quick Tunnel
```bash
curl -X POST http://localhost:2003/api/tunnel/quick/start
```

### Stop Tunnel
```bash
curl -X POST http://localhost:2003/api/tunnel/stop
```

### Get Status
```bash
curl http://localhost:2003/api/tunnel/status
```

### Restart Server (tunnel auto-starts)
```bash
pm2 restart clawx-web
```

---

## ✅ Verification Checklist

Sau khi setup, verify các điểm sau:

- [ ] Tunnel status = "connected"
- [ ] Public URL hiển thị trong UI
- [ ] Public URL accessible từ internet
- [ ] Uptime đang tăng
- [ ] Restart server → tunnel tự động start lại
- [ ] PM2 logs không có error

---

## 🆘 Support

Nếu gặp vấn đề:

1. Check logs: `pm2 logs clawx-web`
2. Check status: `curl http://localhost:2003/api/tunnel/status`
3. Restart server: `pm2 restart clawx-web`
4. Check documentation: `README_TUNNEL.md`

---

**Setup hoàn tất!** 🎉

Tunnel sẽ tự động start mỗi khi server khởi động.
