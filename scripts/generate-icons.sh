#!/bin/bash

# Icon Generation Script
# Generates app icons for macOS, Windows, and Linux from SVG source
#
# Prerequisites:
#   - macOS: brew install imagemagick librsvg
#   - Linux: apt install imagemagick librsvg2-bin
#   - Windows: Install ImageMagick
#
# Usage: ./scripts/generate-icons.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$PROJECT_DIR/resources/icons"
SVG_SOURCE="$ICONS_DIR/icon.svg"

echo "🎨 Generating ClawX icons..."

# Check if SVG source exists
if [ ! -f "$SVG_SOURCE" ]; then
    echo "❌ SVG source not found: $SVG_SOURCE"
    exit 1
fi

# Check for required tools
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found. Please install it:"
    echo "   macOS: brew install imagemagick"
    echo "   Linux: apt install imagemagick"
    exit 1
fi

if ! command -v rsvg-convert &> /dev/null; then
    echo "❌ rsvg-convert not found. Please install it:"
    echo "   macOS: brew install librsvg"
    echo "   Linux: apt install librsvg2-bin"
    exit 1
fi

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "📁 Using temp directory: $TEMP_DIR"

# Generate PNG files at various sizes
SIZES=(16 32 64 128 256 512 1024)

for SIZE in "${SIZES[@]}"; do
    echo "  Generating ${SIZE}x${SIZE} PNG..."
    rsvg-convert -w $SIZE -h $SIZE "$SVG_SOURCE" -o "$TEMP_DIR/icon_${SIZE}.png"
done

# ============ macOS (.icns) ============
echo "🍎 Generating macOS .icns..."

ICONSET_DIR="$TEMP_DIR/ClawX.iconset"
mkdir -p "$ICONSET_DIR"

# macOS iconset requires specific file names
cp "$TEMP_DIR/icon_16.png" "$ICONSET_DIR/icon_16x16.png"
cp "$TEMP_DIR/icon_32.png" "$ICONSET_DIR/icon_16x16@2x.png"
cp "$TEMP_DIR/icon_32.png" "$ICONSET_DIR/icon_32x32.png"
cp "$TEMP_DIR/icon_64.png" "$ICONSET_DIR/icon_32x32@2x.png"
cp "$TEMP_DIR/icon_128.png" "$ICONSET_DIR/icon_128x128.png"
cp "$TEMP_DIR/icon_256.png" "$ICONSET_DIR/icon_128x128@2x.png"
cp "$TEMP_DIR/icon_256.png" "$ICONSET_DIR/icon_256x256.png"
cp "$TEMP_DIR/icon_512.png" "$ICONSET_DIR/icon_256x256@2x.png"
cp "$TEMP_DIR/icon_512.png" "$ICONSET_DIR/icon_512x512.png"
cp "$TEMP_DIR/icon_1024.png" "$ICONSET_DIR/icon_512x512@2x.png"

if command -v iconutil &> /dev/null; then
    iconutil -c icns -o "$ICONS_DIR/icon.icns" "$ICONSET_DIR"
    echo "  ✅ Created icon.icns"
else
    echo "  ⚠️ iconutil not found (macOS only). Skipping .icns generation."
fi

# ============ Windows (.ico) ============
echo "🪟 Generating Windows .ico..."

# Windows ICO typically includes 16, 32, 48, 64, 128, 256
convert "$TEMP_DIR/icon_16.png" \
        "$TEMP_DIR/icon_32.png" \
        "$TEMP_DIR/icon_64.png" \
        "$TEMP_DIR/icon_128.png" \
        "$TEMP_DIR/icon_256.png" \
        "$ICONS_DIR/icon.ico"
echo "  ✅ Created icon.ico"

# ============ Linux (PNG set) ============
echo "🐧 Generating Linux PNG icons..."

LINUX_SIZES=(16 32 48 64 128 256 512)
for SIZE in "${LINUX_SIZES[@]}"; do
    cp "$TEMP_DIR/icon_${SIZE}.png" "$ICONS_DIR/${SIZE}x${SIZE}.png" 2>/dev/null || \
    rsvg-convert -w $SIZE -h $SIZE "$SVG_SOURCE" -o "$ICONS_DIR/${SIZE}x${SIZE}.png"
done
echo "  ✅ Created Linux PNG icons"

# ============ Copy main icon ============
cp "$TEMP_DIR/icon_512.png" "$ICONS_DIR/icon.png"
echo "  ✅ Created icon.png (512x512)"

echo ""
echo "✅ Icon generation complete!"
echo "   Generated files in: $ICONS_DIR"
ls -la "$ICONS_DIR"
