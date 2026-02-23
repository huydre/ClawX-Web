#!/bin/bash
echo "=== Checking service logs ==="
sudo journalctl -u clawx-web-root.service -n 50 --no-pager
echo ""
echo "=== Checking if dist-server exists ==="
ls -la /root/clawx-web/dist-server/index.js
echo ""
echo "=== Checking Node.js path ==="
which node
echo ""
echo "=== Testing manual start ==="
cd /root/clawx-web && NODE_ENV=production PORT=2003 HOST=0.0.0.0 node dist-server/index.js &
sleep 3
echo ""
echo "=== Checking if process started ==="
ps aux | grep "node.*dist-server" | grep -v grep
echo ""
echo "=== Checking port binding ==="
sudo netstat -tlnp | grep 2003
echo ""
echo "=== Killing test process ==="
pkill -f "node.*dist-server"
