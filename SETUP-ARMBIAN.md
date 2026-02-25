# Hướng dẫn Setup ClawX trên Armbian VPS

## Bước 1: Chuẩn bị VPS Armbian

### 1.1. SSH vào VPS

```bash
ssh root@192.168.1.18
# Hoặc IP của VPS bạn
```

### 1.2. Update hệ thống

```bash
apt update && apt upgrade -y
```

### 1.3. Cài đặt các công cụ cần thiết

```bash
# Cài git, curl, build tools
apt install -y git curl wget build-essential

# Cài Node.js 22 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Kiểm tra version
node -v  # Phải >= v22
npm -v
```

### 1.4. Cài pnpm

```bash
npm install -g pnpm
pnpm -v
```

### 1.5. Cài PM2

```bash
npm install -g pm2
pm2 -v
```

## Bước 2: Upload code lên VPS

### Cách 1: Dùng Git (Khuyên dùng)

```bash
# Trên VPS
cd /opt
git clone https://github.com/your-repo/ClawX-Web.git clawx
cd clawx
```

### Cách 2: Dùng SCP từ máy local

```bash
# Trên máy local (Mac)
cd /Users/hnam/Desktop/ClawX-Web

# Nén code
tar -czf clawx.tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=dist-server \
  --exclude=.git \
  .

# Upload lên VPS
scp clawx.tar.gz root@192.168.1.18:/opt/

# SSH vào VPS và giải nén
ssh root@192.168.1.18
cd /opt
mkdir -p clawx
tar -xzf clawx.tar.gz -C clawx
cd clawx
```

### Cách 3: Dùng rsync (Nhanh hơn, sync được)

```bash
# Trên máy local
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='dist-server' \
  --exclude='.git' \
  /Users/hnam/Desktop/ClawX-Web/ \
  root@192.168.1.18:/opt/clawx/
```

## Bước 3: Cấu hình trên VPS

### 3.1. Tạo file .env

```bash
cd /opt/clawx

cat > .env << 'EOF'
# Cloudflare API Token
CLOUDFLARE_API_TOKEN=your_cloudflare_token_here

# Cloudflare Tunnel Domain
CLOUDFLARE_TUNNEL_DOMAIN=veoforge.ggff.net

# Cloudflare Tunnel Subdomain
CLOUDFLARE_TUNNEL_SUBDOMAIN=clawbox02

# Gateway Token (tùy chọn)
GATEWAY_TOKEN=your_gateway_token_here

# Node Environment
NODE_ENV=production

# Port (mặc định 2003)
PORT=2003
EOF

# Chỉnh sửa file .env với token thật
nano .env
```

### 3.2. Cài đặt dependencies

```bash
# Install production dependencies
pnpm install

Thiếu tar

```

## Bước 4: Build ứng dụng

### 4.1. Build server

```bash
pnpm build:server
```

### 4.2. Build frontend (nếu chưa build trên local)

```bash
pnpm build
```

**Lưu ý**: Nếu Armbian RAM thấp (<2GB), nên build frontend trên máy local rồi upload folder `dist` lên:

```bash
# Trên máy local
pnpm build

# Upload dist folder
rsync -avz --progress dist/ root@192.168.1.18:/opt/clawx/dist/
```

## Bước 5: Deploy với PM2

### 5.1. Chạy script deploy tự động

```bash
chmod +x deploy-pm2.sh
./deploy-pm2.sh
```

### 5.2. Hoặc deploy thủ công

```bash
# Start với PM2
pm2 start ecosystem.config.cjs

# Lưu process list
pm2 save

# Xem status
pm2 status
```

## Bước 6: Cấu hình auto-start khi reboot

```bash
# Tạo startup script
pm2 startup

# Copy và chạy lệnh mà PM2 output ra
# Ví dụ: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Lưu lại process list
pm2 save
```

## Bước 7: Cấu hình Firewall (nếu cần)

```bash
# Mở port 2003
ufw allow 2003/tcp

# Hoặc chỉ cho phép từ IP cụ thể
ufw allow from 192.168.1.0/24 to any port 2003

# Enable firewall
ufw enable
```

## Bước 8: Kiểm tra ứng dụng

```bash
# Xem logs
pm2 logs clawx

# Monitor resources
pm2 monit

# Kiểm tra port
netstat -tulpn | grep 2003

# Test HTTP
curl http://localhost:2003/status
```

## Bước 9: Truy cập từ bên ngoài

### Cách 1: Truy cập trực tiếp qua IP

```
http://192.168.1.18:2003
```

### Cách 2: Dùng Nginx reverse proxy (Khuyên dùng)

```bash
# Cài Nginx
apt install -y nginx

# Tạo config
cat > /etc/nginx/sites-available/clawx << 'EOF'
server {
    listen 80;
    server_name clawbox02.veoforge.ggff.net;

    location / {
        proxy_pass http://localhost:2003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/clawx /etc/nginx/sites-enabled/

# Test config
nginx -t

# Restart Nginx
systemctl restart nginx
```

### Cách 3: Dùng Cloudflare Tunnel (Đã có sẵn trong app)

App đã tích hợp Cloudflare Tunnel, chỉ cần cấu hình đúng trong `.env`:

```env
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_TUNNEL_DOMAIN=veoforge.ggff.net
CLOUDFLARE_TUNNEL_SUBDOMAIN=clawbox02
```

Sau đó truy cập: `https://clawbox02.veoforge.ggff.net`

## Các lệnh quản lý hữu ích

```bash
# Xem logs realtime
pm2 logs clawx --lines 100

# Restart app
pm2 restart clawx

# Stop app
pm2 stop clawx

# Xem thông tin chi tiết
pm2 show clawx

# Monitor CPU/RAM
pm2 monit

# Xóa app khỏi PM2
pm2 delete clawx

# Xem tất cả process
pm2 list
```

## Update code mới

```bash
# Cách 1: Git pull
cd /opt/clawx
git pull
pnpm install --prod
pnpm build:server
pm2 restart clawx

# Cách 2: Upload từ local
# Trên máy local
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='.git' \
  /Users/hnam/Desktop/ClawX-Web/ \
  root@192.168.1.18:/opt/clawx/

# Trên VPS
cd /opt/clawx
pnpm install --prod
pnpm build:server
pm2 restart clawx
```

## Troubleshooting

### App không start được

```bash
# Xem logs lỗi
pm2 logs clawx --err

# Kiểm tra port đã bị chiếm chưa
lsof -i :2003

# Chạy trực tiếp để debug
node dist-server/index.js
```

### RAM không đủ khi build

```bash
# Build trên máy local rồi upload
# Trên local
pnpm build

# Upload
rsync -avz dist/ root@192.168.1.18:/opt/clawx/dist/
```

### PM2 không tự start sau reboot

```bash
# Chạy lại startup
pm2 unstartup
pm2 startup
pm2 save
```

### Kiểm tra disk space

```bash
df -h
du -sh /opt/clawx/*
```

## Tối ưu cho Armbian RAM thấp

### 1. Giảm memory limit

Sửa file `ecosystem.config.cjs`:

```javascript
max_memory_restart: '300M',  // Giảm từ 500M xuống 300M
```

### 2. Enable swap

```bash
# Tạo swap 1GB
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Auto mount khi reboot
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Kiểm tra
free -h
```

### 3. Giảm log size

```bash
# Cấu hình log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 3
```

## Backup & Restore

### Backup

```bash
# Backup code + data
cd /opt
tar -czf clawx-backup-$(date +%Y%m%d).tar.gz clawx/

# Upload backup lên nơi khác
scp clawx-backup-*.tar.gz user@backup-server:/backups/
```

### Restore

```bash
cd /opt
tar -xzf clawx-backup-20260225.tar.gz
cd clawx
pm2 restart clawx
```

## Monitoring

### Cài Netdata (tùy chọn)

```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
# Truy cập: http://192.168.1.18:19999
```

---

## Checklist hoàn thành

- [ ] SSH vào VPS thành công
- [ ] Cài Node.js 22+
- [ ] Cài pnpm và PM2
- [ ] Upload code lên VPS
- [ ] Tạo file .env với token đúng
- [ ] Build server thành công
- [ ] Start PM2 thành công
- [ ] Cấu hình auto-start
- [ ] Truy cập được qua browser
- [ ] Cloudflare Tunnel hoạt động (nếu dùng)

---

**Lưu ý quan trọng:**
- Thay `192.168.1.18` bằng IP VPS thật của bạn
- Thay token Cloudflare thật vào file `.env`
- Nếu RAM < 1GB, nên build frontend trên local rồi upload
- Backup thường xuyên folder `/opt/clawx/data`
