# Phase 3: Performance Optimizations

**Status**: Not Started
**Priority**: MEDIUM
**Effort**: 1 week
**Start Date**: TBD
**Owner**: TBD

## Context

The application loads all routes and components eagerly. With 9 page components (Dashboard, Chat, Channels, Skills, Cron, Settings, Setup) and complex stores (chat.ts is 1438 lines), initial load time can be optimized through code splitting and lazy loading. Current bundle size is not optimized for initial load.

**Related Files**:
- `/Users/hnam/Desktop/ClawX-Web/src/App.tsx` - Main app with eager route imports
- `/Users/hnam/Desktop/ClawX-Web/vite.config.ts` - Build configuration (no optimization)
- `/Users/hnam/Desktop/ClawX-Web/src/stores/chat.ts` - Large store (1438 lines)
- `/Users/hnam/Desktop/ClawX-Web/src/pages/` - All page components

## Overview

Implement route-based code splitting, lazy load heavy components, and optimize Vite build configuration. Target 30%+ improvement in initial load time and 40%+ reduction in initial bundle size.

**Dependencies**: Phase 1 (tests to validate performance changes)
**Blocks**: None

## Key Insights

- React 19 and React Router DOM 7 support lazy loading
- Vite build system supports dynamic imports and code splitting
- No lazy loading currently implemented in `src/App.tsx`
- Large dependencies: react-markdown, framer-motion, lucide-react
- Chat store (1438 lines) could benefit from splitting
- No bundle size monitoring in CI

## Requirements

1. Implement route-based code splitting for all pages
2. Lazy load heavy components (markdown renderer, dialogs)
3. Optimize Vite build configuration (minification, chunking)
4. Add loading states for lazy-loaded components
5. Measure and improve initial load time by 30%+
6. Reduce initial bundle size by 40%+
7. Add bundle size monitoring to CI

## Architecture

### Code Splitting Strategy

```typescript
// Before: Eager loading
import Dashboard from '@/pages/Dashboard';
import Chat from '@/pages/Chat';
import Channels from '@/pages/Channels';

// After: Lazy loading
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Chat = lazy(() => import('@/pages/Chat'));
const Channels = lazy(() => import('@/pages/Channels'));
```

### Vite Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'esbuild',
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['framer-motion', 'lucide-react'],
          'markdown': ['react-markdown', 'remark-gfm'],
          'zustand': ['zustand'],
        },
      },
    },
  },
});
```

## Implementation Steps

### Step 1: Route-Based Code Splitting (2 days)

**Tasks**:
- [ ] Convert all route imports to React.lazy()
- [ ] Add Suspense boundaries with loading states
- [ ] Implement error boundaries for lazy load failures
- [ ] Test route transitions and loading states
- [ ] Measure bundle size before/after

**Files to Modify**:
- `src/App.tsx` - Convert to lazy imports
- `src/components/common/LoadingSpinner.tsx` - Enhance for Suspense

**Example Implementation**:
```typescript
// src/App.tsx (refactored)
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import MainLayout from '@/components/layout/MainLayout';

// Lazy load all pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Chat = lazy(() => import('@/pages/Chat'));
const Channels = lazy(() => import('@/pages/Channels'));
const Skills = lazy(() => import('@/pages/Skills'));
const Cron = lazy(() => import('@/pages/Cron'));
const Settings = lazy(() => import('@/pages/Settings'));
const Setup = lazy(() => import('@/pages/Setup'));

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/setup" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <Setup />
          </Suspense>
        } />
        <Route element={<MainLayout />}>
          <Route path="/" element={
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <Dashboard />
            </Suspense>
          } />
          <Route path="/chat" element={
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <Chat />
            </Suspense>
          } />
          <Route path="/channels" element={
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <Channels />
            </Suspense>
          } />
          <Route path="/skills" element={
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <Skills />
            </Suspense>
          } />
          <Route path="/cron" element={
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <Cron />
            </Suspense>
          } />
          <Route path="/settings" element={
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <Settings />
            </Suspense>
          } />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
```

### Step 2: Component Lazy Loading (2 days)

**Tasks**:
- [ ] Lazy load react-markdown and remark-gfm
- [ ] Lazy load heavy dialogs and modals
- [ ] Add skeleton loaders for lazy components
- [ ] Optimize component bundle sizes
- [ ] Test component loading states

**Files to Modify**:
- `src/pages/Chat/ChatMessage.tsx` - Lazy load markdown renderer
- `src/pages/Skills/index.tsx` - Lazy load skill detail dialog
- `src/pages/Channels/index.tsx` - Lazy load channel config dialog

**Example Implementation**:
```typescript
// src/pages/Chat/ChatMessage.tsx (optimized)
import { lazy, Suspense, memo } from 'react';

// Lazy load markdown renderer
const ReactMarkdown = lazy(() => import('react-markdown'));
const remarkGfm = lazy(() => import('remark-gfm').then(m => ({ default: m.default })));

const ChatMessage = memo(({ message }: { message: Message }) => {
  if (message.role === 'assistant' && message.content) {
    return (
      <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </Suspense>
    );
  }

  return <div>{message.content}</div>;
});
```

### Step 3: Build Optimization (2 days)

**Tasks**:
- [ ] Configure Vite manual chunks for optimal splitting
- [ ] Enable tree shaking for unused exports
- [ ] Add minification configuration
- [ ] Configure source maps for production
- [ ] Analyze bundle size with rollup-plugin-visualizer
- [ ] Set up bundle size monitoring in CI

**Files to Modify**:
- `vite.config.ts` - Add optimization config
- `package.json` - Add bundle analysis script
- `.github/workflows/check.yml` - Add bundle size check

**Example Configuration**:
```typescript
// vite.config.ts (optimized)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron', 'ws', 'electron-store'],
            },
          },
        },
      },
      {
        entry: 'electron/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
          },
        },
      },
    ]),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    target: 'es2022',
    sourcemap: 'hidden', // Generate but don't expose
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // UI libraries
          'ui-vendor': ['framer-motion', 'lucide-react'],

          // Markdown rendering
          'markdown': ['react-markdown', 'remark-gfm'],

          // State management
          'zustand': ['zustand'],

          // i18n
          'i18n': ['i18next', 'react-i18next'],

          // Utilities
          'utils': ['clsx', 'tailwind-merge', 'date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Warn if chunk > 1MB
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'i18next',
      'react-i18next',
    ],
  },
});
```

**Bundle Analysis Script**:
```json
// package.json
{
  "scripts": {
    "analyze": "vite build && open dist/stats.html",
    "build:analyze": "ANALYZE=true vite build"
  }
}
```

**CI Bundle Size Check**:
```yaml
# .github/workflows/check.yml
jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - name: Check bundle size
        run: |
          BUNDLE_SIZE=$(du -sb dist | cut -f1)
          MAX_SIZE=$((5 * 1024 * 1024)) # 5MB limit
          if [ $BUNDLE_SIZE -gt $MAX_SIZE ]; then
            echo "Bundle size $BUNDLE_SIZE exceeds limit $MAX_SIZE"
            exit 1
          fi
          echo "Bundle size: $(numfmt --to=iec-i --suffix=B $BUNDLE_SIZE)"
      - uses: actions/upload-artifact@v4
        with:
          name: bundle-stats
          path: dist/stats.html
```

### Step 4: Performance Monitoring (1 day)

**Tasks**:
- [ ] Add performance metrics collection
- [ ] Measure initial load time before/after
- [ ] Monitor bundle sizes in CI
- [ ] Create performance dashboard
- [ ] Document performance improvements

**Files to Create**:
- `src/lib/performance.ts` - Performance metrics
- `docs/performance.md` - Performance documentation

**Example Implementation**:
```typescript
// src/lib/performance.ts
export function measurePerformance() {
  if (typeof window === 'undefined') return;

  // Measure initial load time
  window.addEventListener('load', () => {
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    const metrics = {
      dns: perfData.domainLookupEnd - perfData.domainLookupStart,
      tcp: perfData.connectEnd - perfData.connectStart,
      ttfb: perfData.responseStart - perfData.requestStart,
      download: perfData.responseEnd - perfData.responseStart,
      domInteractive: perfData.domInteractive - perfData.fetchStart,
      domComplete: perfData.domComplete - perfData.fetchStart,
      loadComplete: perfData.loadEventEnd - perfData.fetchStart,
    };

    console.log('Performance Metrics:', metrics);

    // Send to analytics (optional)
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('analytics:performance', metrics);
    }
  });

  // Measure route transitions
  let routeStartTime = Date.now();
  window.addEventListener('popstate', () => {
    const duration = Date.now() - routeStartTime;
    console.log('Route transition:', duration, 'ms');
    routeStartTime = Date.now();
  });
}
```

## Todo List

- [ ] Implement React.lazy() for all page routes
- [ ] Add Suspense boundaries with loading states
- [ ] Lazy load react-markdown and heavy dependencies
- [ ] Lazy load dialogs and modals
- [ ] Configure Vite for optimal code splitting
- [ ] Add bundle size analysis to build process
- [ ] Implement skeleton loaders for lazy components
- [ ] Add performance metrics collection
- [ ] Set up bundle size monitoring in CI
- [ ] Document performance improvements
- [ ] Create before/after performance comparison

## Success Criteria

- [ ] Initial bundle size reduced by 40%+ (from ~2MB to ~1.2MB)
- [ ] Initial load time improved by 30%+ (from ~3s to ~2s)
- [ ] All routes lazy loaded successfully
- [ ] No performance regressions in CI
- [ ] Bundle size monitoring in place
- [ ] Performance metrics documented
- [ ] Lighthouse score improved to 90+

## Risk Assessment

**Low Risk**: React.lazy() is stable and well-supported
- **Mitigation**: Comprehensive testing of lazy loading edge cases

**Low Risk**: Vite handles code splitting automatically
- **Mitigation**: Test build output and verify chunk sizes

**Low Risk**: Loading states may cause UI flicker
- **Mitigation**: Use skeleton loaders for smooth transitions

## Security Considerations

- Ensure lazy-loaded chunks are integrity-checked
- No sensitive data in initial bundle
- Source maps hidden in production (sourcemap: 'hidden')

## Next Steps

1. Measure current performance baseline
2. Implement route-based code splitting
3. Add component lazy loading
4. Configure Vite optimization
5. Measure performance improvements
6. Set up CI monitoring
7. Document performance gains

**After Completion**: The application will load faster and use less memory, improving user experience especially on slower machines. Initial bundle size reduced by 40%+, load time improved by 30%+.
