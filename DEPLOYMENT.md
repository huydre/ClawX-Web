# ClawX Web - Armbian Deployment Guide

## Yêu cầu hệ thống

- Armbian (hoặc Debian/Ubuntu)
- Node.js 18+
- OpenClaw Gateway đang chạy trên port 18789
- RAM: tối thiểu 512MB
- Disk: tối thiểu 1GB trống

## Cài đặt lần đầu

### 1. Cài đặt dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git

# Install PM2
npm install -g pm2

# Verify
node --version
npm --version
```

### 2. Clone và build project

```bash
cd ~
git clone <repository-url> ClawX-Web
cd ClawX-Web
git checkout features/web-ui

# Install dependencies
npm install

# Build
npm run build
npm run build:server
```

### 3. Khởi động với PM2

```bash
# Make scripts executable
chmod +x deploy.sh clawx.sh

# Start application
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup auto-start on boot
pm2 startup systemd
# Chạy lệnh mà PM2 output ra
```

### 4. Truy cập

Mở trình duyệt và truy cập:
```
http://192.168.1.18:2003
```

## Quản lý ứng dụng

### Sử dụng script quản lý

```bash
# Start
./clawx.sh start

# Stop
./clawx.sh stop

# Restart
./clawx.sh restart

# View status
./clawx.sh status

# View logs
./clawx.sh logs

# Monitor
./clawx.sh monitor
```

### Sử dụng PM2 trực tiếp

```bash
# View status
pm2 status

# View logs
pm2 logs clawx-web

# Restart
pm2 restart clawx-web

# Stop
pm2 stop clawx-web

# Monitor
pm2 monit
```

## Update code mới

```bash
cd ~/ClawX-Web
./deploy.sh
```

Script sẽ tự động:
1. Pull code mới từ Git
2. Install dependencies
3. Build frontend và server
4. Restart ứng dụng

## Cấu hình Nginx (Optional)

Nếu muốn chạy trên port 80:

```bash
# Install Nginx
apt install -y nginx

# Copy config
cp nginx.conf /etc/nginx/sites-available/clawx

# Enable site
ln -s /etc/nginx/sites-available/clawx /etc/nginx/sites-enabled/

# Test config
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx
```

Sau đó truy cập qua:
```
http://192.168.1.18
```

## Troubleshooting

### Kiểm tra logs

```bash
# PM2 logs
pm2 logs clawx-web

# System logs
journalctl -u pm2-root -f
```

### Kiểm tra port

```bash
# Check if port 2003 is listening
netstat -tulpn | grep 2003

# Check if OpenClaw Gateway is running
netstat -tulpn | grep 18789
```

### Restart toàn bộ

```bash
pm2 restart clawx-web
```

### Xóa và cài lại

```bash
pm2 delete clawx-web
pm2 start ecosystem.config.js
pm2 save
```

## Cấu hình nâng cao

### Thay đổi port

Sửa file `ecosystem.config.js`:
```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3000  // Thay đổi port ở đây
}
```

Sau đó restart:
```bash
pm2 restart clawx-web
```

### Tăng memory limit

Sửa file `ecosystem.config.js`:
```javascript
max_memory_restart: '1G'  // Tăng lên 1GB
```

## Bảo mật

### Firewall

```bash
# Allow port 2003
ufw allow 2003/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

### SSL/HTTPS (với Nginx)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate (nếu có domain)
certbot --nginx -d yourdomain.com
```

## Monitoring

### CPU và Memory usage

```bash
pm2 monit
```

### Logs real-time

```bash
pm2 logs clawx-web --lines 100
```

## Backup

### Backup data

```bash
# Backup storage directory
tar -czf clawx-backup-$(date +%Y%m%d).tar.gz ~/.clawx-web
```

### Restore

```bash
tar -xzf clawx-backup-YYYYMMDD.tar.gz -C ~/
```

## Liên hệ

- Issues: GitHub Issues
- Documentation: ./docs/
