# Phase 7: Testing & Deployment

**Status**: Not Started
**Priority**: HIGH
**Effort**: 2 days
**Dependencies**: Phase 1-6 (All phases complete)

## Context

Final testing, deployment to Armbian device, and verification of all features.

**Target**: Armbian (RK3399, 4GB RAM, ARM64)

## Overview

Day 1: Local testing, build verification, integration tests
Day 2: Deploy to Armbian, test on device, verify auto-start

## Key Insights

- Port 2003 for web server
- Gateway port 18789
- Install location: ~/.openclaw
- Single user, LAN-only access
- Fresh installation (no data migration)

## Requirements

1. Test all API endpoints locally
2. Test WebSocket connection
3. Test file upload/download
4. Build production bundle
5. Deploy to Armbian device
6. Test on device
7. Verify auto-start on boot
8. Performance testing
9. Create deployment checklist

## Architecture

### Deployment Flow

```
Development Machine → Build → Transfer to Armbian → Install → Test → Verify
```

## Implementation Steps

### Day 1: Local Testing (8 hours)

#### Step 1.1: API Endpoint Testing (2 hours)

Create comprehensive test script:

**tests/api-test.sh**:

```bash
#!/bin/bash

set -e

BASE_URL="http://localhost:2003"
TOKEN="<your-token>"

echo "ClawX Web API Test Suite"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

function test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4

  test_count=$((test_count + 1))
  echo -n "Testing: $name... "

  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method \
      -H "Authorization: Bearer $TOKEN" \
      "$BASE_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$endpoint")
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    pass_count=$((pass_count + 1))
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
    echo "Response: $body"
    fail_count=$((fail_count + 1))
  fi
}

# Health check (no auth)
echo "=== Health Check ==="
test_endpoint "Health endpoint" "GET" "/health"
echo ""

# Gateway endpoints
echo "=== Gateway Endpoints ==="
test_endpoint "Gateway status" "GET" "/api/gateway/status"
test_endpoint "Gateway health" "GET" "/api/gateway/health"
echo ""

# Provider endpoints
echo "=== Provider Endpoints ==="
test_endpoint "List providers" "GET" "/api/providers"
test_endpoint "Get default provider" "GET" "/api/providers/default"
test_endpoint "Save provider" "POST" "/api/providers" \
  '{"config":{"id":"test","name":"Test","type":"openai","enabled":true},"apiKey":"sk-test"}'
test_endpoint "Get provider" "GET" "/api/providers/test"
test_endpoint "Set default" "POST" "/api/providers/default" '{"id":"test"}'
test_endpoint "Delete provider" "DELETE" "/api/providers/test"
echo ""

# Settings endpoints
echo "=== Settings Endpoints ==="
test_endpoint "Get all settings" "GET" "/api/settings"
test_endpoint "Get theme setting" "GET" "/api/settings/theme"
test_endpoint "Set theme" "POST" "/api/settings/theme" '{"value":"dark"}'
echo ""

# Summary
echo ""
echo "========================"
echo "Test Summary"
echo "========================"
echo "Total: $test_count"
echo -e "Passed: ${GREEN}$pass_count${NC}"
echo -e "Failed: ${RED}$fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi
```

Make executable:

```bash
chmod +x tests/api-test.sh
```

#### Step 1.2: WebSocket Testing (1 hour)

**tests/websocket-test.html**:

```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Test</title>
  <style>
    body { font-family: monospace; padding: 20px; }
    #log { border: 1px solid #ccc; padding: 10px; height: 400px; overflow-y: auto; }
    .event { margin: 5px 0; padding: 5px; background: #f0f0f0; }
    .connected { color: green; }
    .disconnected { color: red; }
    .message { color: blue; }
  </style>
</head>
<body>
  <h1>WebSocket Test</h1>
  <button onclick="connect()">Connect</button>
  <button onclick="disconnect()">Disconnect</button>
  <div id="log"></div>

  <script>
    const TOKEN = '<your-token>';
    let ws = null;

    function log(message, className = '') {
      const div = document.createElement('div');
      div.className = 'event ' + className;
      div.textContent = new Date().toISOString() + ' - ' + message;
      document.getElementById('log').appendChild(div);
      div.scrollIntoView();
    }

    function connect() {
      if (ws) {
        log('Already connected', 'message');
        return;
      }

      ws = new WebSocket(`ws://localhost:2003/ws?token=${TOKEN}`);

      ws.onopen = () => {
        log('Connected', 'connected');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        log(`Message: ${data.type}`, 'message');
        console.log('WebSocket message:', data);
      };

      ws.onclose = () => {
        log('Disconnected', 'disconnected');
        ws = null;
      };

      ws.onerror = (error) => {
        log('Error: ' + error, 'disconnected');
      };
    }

    function disconnect() {
      if (ws) {
        ws.close();
        ws = null;
      }
    }

    // Auto-connect on load
    connect();
  </script>
</body>
</html>
```

#### Step 1.3: Integration Testing (2 hours)

**tests/integration-test.sh**:

```bash
#!/bin/bash

set -e

echo "ClawX Web Integration Test"
echo "==========================="
echo ""

# Start server in background
echo "Starting server..."
pnpm dev:server &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Check if server is running
if ! curl -s http://localhost:2003/health > /dev/null; then
  echo "Error: Server failed to start"
  kill $SERVER_PID
  exit 1
fi

echo "✓ Server started"

# Run API tests
echo ""
echo "Running API tests..."
./tests/api-test.sh

# Stop server
echo ""
echo "Stopping server..."
kill $SERVER_PID

echo ""
echo "✓ Integration tests complete"
```

#### Step 1.4: Build Production Bundle (1 hour)

```bash
# Clean previous builds
rm -rf dist dist-server

# Build frontend
pnpm build

# Build backend
pnpm build:server

# Verify builds
ls -lh dist/
ls -lh dist-server/

# Test production build locally
NODE_ENV=production node dist-server/index.js &
sleep 3
curl http://localhost:2003/health
kill %1
```

#### Step 1.5: Create Deployment Package (2 hours)

**scripts/create-package.sh**:

```bash
#!/bin/bash

set -e

VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME="clawx-web-${VERSION}-linux-arm64"

echo "Creating deployment package: $PACKAGE_NAME"
echo ""

# Create package directory
mkdir -p "packages/$PACKAGE_NAME"

# Copy files
echo "Copying files..."
cp -r dist "packages/$PACKAGE_NAME/"
cp -r dist-server "packages/$PACKAGE_NAME/"
cp package.json "packages/$PACKAGE_NAME/"
cp -r scripts "packages/$PACKAGE_NAME/"

# Copy only production dependencies
echo "Installing production dependencies..."
cd "packages/$PACKAGE_NAME"
npm install --production --ignore-scripts
cd ../..

# Create archive
echo "Creating archive..."
cd packages
tar -czf "${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"
cd ..

echo ""
echo "✓ Package created: packages/${PACKAGE_NAME}.tar.gz"
echo "Size: $(du -h packages/${PACKAGE_NAME}.tar.gz | cut -f1)"
```

Make executable:

```bash
chmod +x scripts/create-package.sh
```

### Day 2: Deployment to Armbian (8 hours)

#### Step 2.1: Transfer Package to Armbian (1 hour)

```bash
# Build package
./scripts/create-package.sh

# Transfer to Armbian
scp packages/clawx-web-*.tar.gz user@armbian-ip:~/

# SSH to Armbian
ssh user@armbian-ip
```

#### Step 2.2: Install on Armbian (2 hours)

On Armbian device:

```bash
# Extract package
tar -xzf clawx-web-*.tar.gz
cd clawx-web-*

# Verify Node.js
node -v  # Should be 20+

# Run installation script
./scripts/install-service.sh

# Check service status
systemctl --user status clawx-web

# View logs
journalctl --user -u clawx-web -f
```

#### Step 2.3: Test on Device (2 hours)

**On Armbian device**:

```bash
# Test health endpoint
curl http://localhost:2003/health

# Test from another device on LAN
# Find Armbian IP
ip addr show | grep inet

# From another device:
curl http://<armbian-ip>:2003/health
```

**Test checklist**:

```bash
# 1. Gateway operations
curl -H "Authorization: Bearer <token>" http://localhost:2003/api/gateway/status

# 2. Provider management
curl -H "Authorization: Bearer <token>" http://localhost:2003/api/providers

# 3. Settings
curl -H "Authorization: Bearer <token>" http://localhost:2003/api/settings

# 4. WebSocket (use browser)
# Open: http://<armbian-ip>:2003
# Check browser console for WebSocket connection

# 5. File upload (use browser)
# Upload a file via chat interface
```

#### Step 2.4: Test Auto-start (1 hour)

```bash
# Reboot device
sudo reboot

# After reboot, SSH back in
ssh user@armbian-ip

# Check if service started automatically
systemctl --user status clawx-web

# Check logs
journalctl --user -u clawx-web -n 50

# Test health endpoint
curl http://localhost:2003/health
```

#### Step 2.5: Performance Testing (2 hours)

**tests/performance-test.sh**:

```bash
#!/bin/bash

echo "ClawX Web Performance Test"
echo "=========================="
echo ""

# Memory usage
echo "Memory Usage:"
systemctl --user status clawx-web | grep Memory

# CPU usage
echo ""
echo "CPU Usage:"
top -b -n 1 | grep node

# Response time
echo ""
echo "Response Time Test (100 requests):"
ab -n 100 -c 10 -H "Authorization: Bearer <token>" \
  http://localhost:2003/api/gateway/status

# WebSocket connections
echo ""
echo "WebSocket Connection Test:"
# Test multiple concurrent connections
for i in {1..10}; do
  wscat -c "ws://localhost:2003/ws?token=<token>" &
done
sleep 5
killall wscat

echo ""
echo "✓ Performance tests complete"
```

## Todo List

### Day 1: Local Testing
- [ ] Create API test script
- [ ] Create WebSocket test page
- [ ] Create integration test script
- [ ] Run all tests locally
- [ ] Build production bundle
- [ ] Verify build output
- [ ] Create deployment package
- [ ] Test package locally

### Day 2: Deployment
- [ ] Transfer package to Armbian
- [ ] Install Node.js on Armbian (if needed)
- [ ] Extract package
- [ ] Run installation script
- [ ] Verify service started
- [ ] Test health endpoint
- [ ] Test from LAN device
- [ ] Test all API endpoints
- [ ] Test WebSocket connection
- [ ] Test file upload
- [ ] Reboot device
- [ ] Verify auto-start
- [ ] Run performance tests
- [ ] Document deployment

## Success Criteria

- [ ] All API tests passing
- [ ] WebSocket connection working
- [ ] File upload working
- [ ] Production build successful
- [ ] Package created successfully
- [ ] Deployed to Armbian
- [ ] Service running on Armbian
- [ ] Accessible from LAN
- [ ] Auto-starts on boot
- [ ] Memory usage < 300MB
- [ ] Response time < 100ms
- [ ] No errors in logs

## Deployment Checklist

### Pre-deployment
- [ ] All phases 1-6 complete
- [ ] All tests passing locally
- [ ] Production build successful
- [ ] Package created

### Deployment
- [ ] Node.js 20+ installed on Armbian
- [ ] Package transferred to device
- [ ] Package extracted
- [ ] Installation script executed
- [ ] Service enabled
- [ ] Service started

### Verification
- [ ] Health endpoint responding
- [ ] Gateway operations working
- [ ] Provider management working
- [ ] Settings working
- [ ] File upload working
- [ ] WebSocket events working
- [ ] Accessible from LAN
- [ ] Auto-starts on boot
- [ ] Logs clean (no errors)
- [ ] Performance acceptable

### Post-deployment
- [ ] Document server token
- [ ] Document access URL
- [ ] Create backup of db.json
- [ ] Set up monitoring (optional)
- [ ] Document troubleshooting steps

## Performance Benchmarks

### Expected Performance (RK3399, 4GB RAM)

| Metric | Target | Acceptable |
|--------|--------|------------|
| Memory usage | < 200MB | < 300MB |
| CPU usage (idle) | < 5% | < 10% |
| Response time | < 50ms | < 100ms |
| WebSocket latency | < 10ms | < 50ms |
| File upload (10MB) | < 2s | < 5s |
| Boot time | < 15s | < 30s |

## Troubleshooting Guide

### Service won't start
```bash
# Check logs
journalctl --user -u clawx-web -n 100

# Check Node.js version
node -v

# Check port availability
lsof -i :2003

# Restart service
systemctl --user restart clawx-web
```

### Can't access from LAN
```bash
# Check firewall
sudo ufw status

# Allow port 2003
sudo ufw allow 2003/tcp

# Check if listening on correct interface
netstat -tlnp | grep 2003
```

### High memory usage
```bash
# Check memory
systemctl --user status clawx-web

# Restart service
systemctl --user restart clawx-web

# Check for memory leaks in logs
journalctl --user -u clawx-web | grep -i memory
```

### Gateway connection issues
```bash
# Check Gateway status
curl -H "Authorization: Bearer <token>" \
  http://localhost:2003/api/gateway/status

# Check Gateway logs
journalctl --user -u clawx-web | grep -i gateway

# Restart Gateway
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:2003/api/gateway/restart
```

## Risk Assessment

**Low Risk**: Deployment process
- Mitigation: Test locally first, create rollback plan

**Medium Risk**: Performance on ARM device
- Mitigation: Monitor resource usage, optimize if needed

**Low Risk**: Network configuration
- Mitigation: Document firewall rules, test from LAN

## Security Considerations

- Service runs as non-root user
- Localhost binding (127.0.0.1) for security
- Token authentication required
- Firewall rules documented
- Logs don't contain sensitive data

## Next Steps

After successful deployment:
1. Document server token and access URL
2. Create user guide
3. Set up monitoring (optional)
4. Plan for updates/maintenance
5. Consider Phase 2 security improvements (from codebase review plan)

## Final Deliverables

- [ ] Working web application on Armbian
- [ ] Auto-start configured
- [ ] Deployment documentation
- [ ] Troubleshooting guide
- [ ] Performance benchmarks
- [ ] User access instructions
