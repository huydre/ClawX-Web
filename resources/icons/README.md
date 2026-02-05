# ClawX Application Icons

This directory contains the application icons for all supported platforms.

## Required Files

| File | Platform | Description |
|------|----------|-------------|
| `icon.svg` | Source | Vector source for all icons |
| `icon.icns` | macOS | Apple Icon Image format |
| `icon.ico` | Windows | Windows ICO format |
| `icon.png` | All | 512x512 PNG fallback |
| `16x16.png` - `512x512.png` | Linux | PNG set for Linux |

## Generating Icons

### Using the Script

```bash
# Make the script executable
chmod +x scripts/generate-icons.sh

# Run icon generation
./scripts/generate-icons.sh
```

### Prerequisites

**macOS:**
```bash
brew install imagemagick librsvg
```

**Linux:**
```bash
apt install imagemagick librsvg2-bin
```

**Windows:**
Install ImageMagick from https://imagemagick.org/

### Manual Generation

If you prefer to generate icons manually:

1. **macOS (.icns)**
   - Create a `.iconset` folder with properly named PNGs
   - Run: `iconutil -c icns -o icon.icns ClawX.iconset`

2. **Windows (.ico)**
   - Use ImageMagick: `convert icon_16.png icon_32.png icon_64.png icon_128.png icon_256.png icon.ico`

3. **Linux (PNGs)**
   - Generate PNGs at: 16, 32, 48, 64, 128, 256, 512 pixels

## Design Guidelines

- **Background**: Gradient from #6366f1 to #8b5cf6 (Indigo to Violet)
- **Corner Radius**: ~20% of width (200px on 1024px canvas)
- **Foreground**: White claw symbol with "X" accent
- **Safe Area**: Keep 10% margin from edges

## Updating the Icon

1. Edit `icon.svg` with your vector editor (Figma, Illustrator, Inkscape)
2. Run `./scripts/generate-icons.sh`
3. Verify generated icons look correct
4. Commit all generated files
