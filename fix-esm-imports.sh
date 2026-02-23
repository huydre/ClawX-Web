#!/bin/bash
# Add .js extension to all relative imports in server directory
find server -name "*.ts" -type f -exec sed -i.bak \
  -e "s|from '\./\([^']*\)'|from './\1.js'|g" \
  -e "s|from \"\./\([^\"]*\)\"|from \"./\1.js\"|g" \
  -e "s|from '\.\./\([^']*\)'|from '../\1.js'|g" \
  -e "s|from \"\.\./\([^\"]*\)\"|from \"../\1.js\"|g" \
  {} \;
# Remove backup files
find server -name "*.bak" -delete
echo "Fixed ESM imports in server directory"
