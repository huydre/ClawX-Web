# ClawX

> Graphical AI Assistant based on OpenClaw

ClawX is a modern desktop application that provides a beautiful graphical interface for OpenClaw, making AI assistants accessible to everyone without command-line knowledge.

## Features

- 🎯 **Zero CLI Required** - Complete all installation, configuration, and usage through GUI
- 🎨 **Modern UI** - Beautiful, intuitive desktop application interface
- 📦 **Ready to Use** - Pre-installed skill bundles, ready immediately
- 🖥️ **Cross-Platform** - Unified experience on macOS / Windows / Linux
- 🔄 **Seamless Integration** - Fully compatible with OpenClaw ecosystem

## Tech Stack

- **Runtime**: Electron 33+
- **Frontend**: React 19 + TypeScript
- **UI Components**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand
- **Build Tools**: Vite + electron-builder
- **Testing**: Vitest + Playwright

## Development

### Prerequisites

- Node.js 22+
- pnpm (recommended) or npm

### Setup

```bash
# Clone the repository
git clone https://github.com/ValueCell-ai/ClawX.git
cd clawx

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Available Commands

```bash
# Development
pnpm dev           # Start development server with hot reload
pnpm build         # Build for production

# Testing
pnpm test          # Run unit tests
pnpm test:e2e      # Run E2E tests
pnpm test:coverage # Generate coverage report

# Code Quality
pnpm lint          # Run ESLint
pnpm lint:fix      # Fix linting issues
pnpm typecheck     # TypeScript type checking

# Packaging
pnpm package       # Package for current platform
pnpm package:mac   # Package for macOS
pnpm package:win   # Package for Windows
pnpm package:linux # Package for Linux
```

## Project Structure

```
clawx/
├── electron/           # Electron main process
│   ├── main/          # Main process entry and handlers
│   ├── gateway/       # Gateway process management
│   ├── preload/       # Preload scripts
│   └── utils/         # Utilities
├── src/               # React renderer process
│   ├── components/    # React components
│   ├── pages/         # Page components
│   ├── stores/        # Zustand state stores
│   ├── hooks/         # Custom React hooks
│   ├── types/         # TypeScript types
│   └── styles/        # Global styles
├── resources/         # Static resources
├── tests/             # Test files
└── build_process/     # Build documentation
```

## Architecture

ClawX follows a dual-port architecture:

- **Port 23333**: ClawX GUI (default interface)
- **Port 18789**: OpenClaw Gateway (native management)

```
┌─────────────────────────────────┐
│         ClawX App               │
│  ┌───────────────────────────┐  │
│  │ Electron Main Process     │  │
│  │ - Window management       │  │
│  │ - Gateway lifecycle       │  │
│  │ - System integration      │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ React Renderer Process    │  │
│  │ - Modern UI               │  │
│  │ - WebSocket communication │  │
│  └───────────────────────────┘  │
└───────────────┬─────────────────┘
                │ WebSocket (JSON-RPC)
                ▼
┌─────────────────────────────────┐
│      OpenClaw Gateway           │
│ - Message channel management    │
│ - AI Agent runtime              │
│ - Skills/plugins system         │
└─────────────────────────────────┘
```

## License

MIT
