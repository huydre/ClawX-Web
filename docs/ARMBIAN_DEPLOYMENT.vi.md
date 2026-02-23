# Hướng dẫn triển khai ClawX Web trên Armbian

## Tổng quan

ClawX Web là giao diện web cho OpenClaw AI Agent, có thể chạy như một dịch vụ hệ thống trên Armbian (hoặc bất kỳ hệ thống Linux nào). Hướng dẫn này sẽ giúp bạn cài đặt và chạy ClawX Web trên thiết bị Armbian của bạn.

## Yêu cầu hệ thống

- **Hệ điều hành**: Armbian (hoặc bất kỳ distro Linux nào)
- **Node.js**: Phiên bản 18 trở lên
- **RAM**: Tối thiểu 4GB (khuyến nghị 8GB)
- **Dung lượng**: 1GB trống
- **Quyền**: Quyền sudo để cài đặt systemd service

## Bước 1: Cài đặt Node.js

Nếu chưa có Node.js, cài đặt bằng một trong các cách sau:

### Cách 1: Sử dụng NodeSource (Khuyến nghị)

```bash
# Cài đặt Node.js 22.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Kiểm tra phiên bản
node -v
npm -v
```

### Cách 2: Sử dụng nvm

```bash
# Cài đặt nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Tải lại shell
source ~/.bashrc

# Cài đặt Node.js
nvm install 22
nvm use 22
```

## Bước 2: Chuẩn bị mã nguồn

### Tùy chọn A: Build từ source (Khuyến nghị cho development)

```bash
# Clone repository
git clone https://github.com/ValueCell-ai/ClawX.git
cd ClawX

# Cài đặt pnpm nếu chưa có
npm install -g pnpm

# Cài đặt dependencies
pnpm install

# Build frontend
pnpm build

# Build server
pnpm build:server
```

### Tùy chọn B: Tải pre-built release

```bash
# Tải release mới nhất từ GitHub
# Giải nén và cd vào thư mục
```

## Bước 3: Chạy script cài đặt

Script `install.sh` sẽ tự động:
- Sao chép files vào `~/clawx-web`
- Tạo thư mục data tại `~/.clawx`
- Cài đặt systemd service
- Khởi động service

```bash
# Chạy script cài đặt
chmod +x install.sh
./install.sh
```

Script sẽ hiển thị output như sau:

```
ClawX Web Installation Script for Armbian
==========================================

Installing ClawX Web for user: your-username
Installation directory: /home/your-username/clawx-web

✓ Node.js v22.x.x detected

Copying files...
✓ Files copied

Creating data directory...
✓ Data directory created

Installing systemd service...
✓ Systemd service installed

Enabling and starting service...
✓ Service enabled and started

✓ ClawX Web is running!

Access the web interface at: http://127.0.0.1:2003

Useful commands:
  - Check status: sudo systemctl status clawx-web@your-username.service
  - View logs: sudo journalctl -u clawx-web@your-username.service -f
  - Restart: sudo systemctl restart clawx-web@your-username.service
  - Stop: sudo systemctl stop clawx-web@your-username.service
```

## Bước 4: Truy cập giao diện web

Sau khi cài đặt thành công, mở trình duyệt và truy cập:

```
http://127.0.0.1:2003
```

Hoặc từ máy khác trong cùng mạng:

```
http://<IP-của-thiết-bị-armbian>:2003
```

## Quản lý dịch vụ

### Kiểm tra trạng thái

```bash
sudo systemctl status clawx-web@$USER.service
```

### Xem logs

```bash
# Xem logs realtime
sudo journalctl -u clawx-web@$USER.service -f

# Xem 50 dòng logs gần nhất
sudo journalctl -u clawx-web@$USER.service -n 50

# Xem logs từ boot gần nhất
sudo journalctl -u clawx-web@$USER.service -b
```

### Khởi động lại service

```bash
sudo systemctl restart clawx-web@$USER.service
```

### Dừng service

```bash
sudo systemctl stop clawx-web@$USER.service
```

### Vô hiệu hóa auto-start

```bash
sudo systemctl disable clawx-web@$USER.service
```

### Kích hoạt lại auto-start

```bash
sudo systemctl enable clawx-web@$USER.service
```

## Cấu hình nâng cao

### Thay đổi port

Mặc định service chạy trên port 2003. Để thay đổi:

1. Chỉnh sửa service file:

```bash
sudo nano /etc/systemd/system/clawx-web@.service
```

2. Thay đổi dòng:

```ini
Environment="PORT=2003"
```

Thành port mong muốn, ví dụ:

```ini
Environment="PORT=8080"
```

3. Reload và restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart clawx-web@$USER.service
```

### Cấu hình biến môi trường

Thêm các biến môi trường khác vào service file:

```ini
Environment="NODE_ENV=production"
Environment="PORT=2003"
Environment="LOG_LEVEL=info"
```

### Cấu hình OpenClaw Gateway

File cấu hình gateway nằm tại `~/.clawx/config.json`. Bạn có thể chỉnh sửa trực tiếp hoặc qua giao diện web (Settings → Advanced → Developer Mode).

## Gỡ lỗi

### Service không khởi động

1. Kiểm tra logs:

```bash
sudo journalctl -u clawx-web@$USER.service -n 100
```

2. Kiểm tra Node.js version:

```bash
node -v  # Phải >= 18
```

3. Kiểm tra quyền truy cập files:

```bash
ls -la ~/clawx-web
ls -la ~/.clawx
```

### Port đã được sử dụng

Kiểm tra process nào đang dùng port 2003:

```bash
sudo lsof -i :2003
```

Hoặc thay đổi port như hướng dẫn ở trên.

### Không thể kết nối từ máy khác

1. Kiểm tra firewall:

```bash
# UFW
sudo ufw allow 2003/tcp

# iptables
sudo iptables -A INPUT -p tcp --dport 2003 -j ACCEPT
```

2. Kiểm tra server có bind đúng interface không:

```bash
sudo netstat -tlnp | grep 2003
```

Nếu chỉ thấy `127.0.0.1:2003`, server chỉ lắng nghe localhost. Cần cấu hình để bind `0.0.0.0`.

## Gỡ cài đặt

Để gỡ bỏ hoàn toàn ClawX Web:

```bash
# Chạy script gỡ cài đặt
chmod +x uninstall.sh
./uninstall.sh
```

Hoặc thực hiện thủ công:

```bash
# Dừng và vô hiệu hóa service
sudo systemctl stop clawx-web@$USER.service
sudo systemctl disable clawx-web@$USER.service

# Xóa service file
sudo rm /etc/systemd/system/clawx-web@.service
sudo systemctl daemon-reload

# Xóa files cài đặt
rm -rf ~/clawx-web

# Xóa data (tùy chọn - sẽ mất cấu hình và dữ liệu)
rm -rf ~/.clawx
```

## Cập nhật

Để cập nhật lên phiên bản mới:

```bash
# Dừng service
sudo systemctl stop clawx-web@$USER.service

# Pull code mới (nếu dùng git)
cd ClawX
git pull
pnpm install
pnpm build
pnpm build:server

# Chạy lại install script
./install.sh

# Service sẽ tự động khởi động lại
```

## Tối ưu hóa cho thiết bị nhúng

### Giảm memory footprint

Thêm vào service file:

```ini
Environment="NODE_OPTIONS=--max-old-space-size=512"
```

### Giảm CPU usage

Cấu hình OpenClaw để sử dụng model nhẹ hơn hoặc giảm số concurrent requests.

### Sử dụng swap

Nếu RAM hạn chế:

```bash
# Tạo 2GB swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Tự động mount khi boot
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Hỗ trợ

- **GitHub Issues**: https://github.com/ValueCell-ai/ClawX/issues
- **Discord**: https://discord.com/invite/84Kex3GGAh
- **Documentation**: https://github.com/ValueCell-ai/ClawX/tree/main/docs

## License

MIT License - Xem file LICENSE để biết thêm chi tiết.
