#!/bin/bash
echo "=== Checking helmet config in source ==="
grep -A5 "helmet({" server/app.ts

echo ""
echo "=== Checking helmet config in compiled output ==="
grep -A5 "helmet({" dist-server/app.js

echo ""
echo "=== Testing server response ==="
curl -v http://localhost:2003/ 2>&1 | grep -i "strict-transport"
