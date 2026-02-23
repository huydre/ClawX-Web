# Phase 4: Developer Experience

**Status**: Not Started
**Priority**: MEDIUM
**Effort**: 1 week
**Start Date**: TBD
**Owner**: TBD

## Context

No pre-commit hooks detected (no .husky directory). The CI pipeline runs linting and type checking, but catching issues earlier in the development cycle improves productivity. The project has good tooling (ESLint, TypeScript, Prettier) but lacks automation to enforce code quality before commits.

**Related Files**:
- `/Users/hnam/Desktop/ClawX-Web/eslint.config.mjs` - ESLint configuration
- `/Users/hnam/Desktop/ClawX-Web/.prettierrc` - Prettier configuration
- `/Users/hnam/Desktop/ClawX-Web/.github/workflows/check.yml` - CI pipeline
- `/Users/hnam/Desktop/ClawX-Web/package.json` - Scripts and dependencies

## Overview

Set up pre-commit hooks with Husky, enforce conventional commit messages, add pre-push hooks for tests, and optimize CI pipeline with caching. Improve developer productivity by catching issues early.

**Dependencies**: Phase 1 (tests needed for pre-push hooks)
**Blocks**: None

## Key Insights

- ESLint configured with TypeScript and React rules
- Prettier configured (semi, single quotes, 2 spaces)
- No pre-commit hooks to enforce code quality
- CI runs lint/typecheck but developers can commit broken code
- No commit message linting
- CI pipeline lacks dependency caching

## Requirements

1. Set up pre-commit hooks with Husky + lint-staged
2. Run linting, formatting, and type checking before commits
3. Enforce conventional commit messages with commitlint
4. Add pre-push hooks for running tests
5. Optimize CI pipeline with caching (30%+ faster)
6. Document git hooks and bypass procedures

## Architecture

### Git Hooks Strategy

```
Pre-commit (fast, <10s):
  - lint-staged: ESLint + Prettier on staged files only
  - Type check staged files

Commit-msg:
  - commitlint: Enforce conventional commits

Pre-push:
  - Run unit tests (skip E2E for speed)
  - Verify build succeeds
```

### CI Optimization

```yaml
Cache Strategy:
  - pnpm store cache (node_modules)
  - Vite build cache (.vite)
  - TypeScript build cache (.tsbuildinfo)
  - Playwright browsers cache

Parallelization:
  - Lint, typecheck, test in parallel jobs
  - Matrix strategy for E2E tests (macOS, Windows, Linux)
```

## Implementation Steps

### Step 1: Pre-commit Hooks Setup (2 days)

**Tasks**:
- [ ] Install Husky and lint-staged
- [ ] Configure pre-commit hook for linting/formatting
- [ ] Configure lint-staged for staged files only
- [ ] Add pre-commit hook for type checking
- [ ] Test hook performance (<10s target)
- [ ] Document hook bypass procedures

**Files to Create**:
- `.husky/pre-commit` - Pre-commit hook script
- `.lintstagedrc.json` - lint-staged configuration

**Example Implementation**:
```bash
# Install dependencies
pnpm add -D husky lint-staged

# Initialize Husky
pnpm exec husky init

# Create pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
EOF

chmod +x .husky/pre-commit
```

```json
// .lintstagedrc.json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ],
  "*.ts?(x)": [
    "bash -c 'pnpm typecheck'"
  ]
}
```

**package.json scripts**:
```json
{
  "scripts": {
    "prepare": "husky",
    "lint": "eslint . --fix",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit"
  }
}
```

### Step 2: Commit Message Linting (1 day)

**Tasks**:
- [ ] Install commitlint and conventional commits config
- [ ] Configure commit-msg hook
- [ ] Add commitlint configuration file
- [ ] Document commit message conventions
- [ ] Test commit message validation

**Files to Create**:
- `.husky/commit-msg` - Commit message hook
- `.commitlintrc.json` - commitlint configuration
- `docs/contributing/commit-conventions.md` - Documentation

**Example Implementation**:
```bash
# Install dependencies
pnpm add -D @commitlint/cli @commitlint/config-conventional

# Create commit-msg hook
cat > .husky/commit-msg << 'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm commitlint --edit $1
EOF

chmod +x .husky/commit-msg
```

```json
// .commitlintrc.json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert"
      ]
    ],
    "subject-case": [2, "never", ["upper-case"]],
    "subject-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 100]
  }
}
```

**Commit Convention Documentation**:
```markdown
# Commit Message Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/).

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Build system changes
- **ci**: CI/CD changes
- **chore**: Other changes (dependencies, config)

## Examples

```
feat(chat): add file upload support

Implement drag-and-drop file upload in chat interface.
Supports images, PDFs, and text files up to 10MB.

Closes #123
```

## Bypass Hooks

In emergencies, bypass hooks with:
```bash
git commit --no-verify -m "emergency fix"
```
```

### Step 3: Pre-push Hooks (1 day)

**Tasks**:
- [ ] Add pre-push hook for unit tests
- [ ] Configure test timeout for pre-push
- [ ] Add option to skip hooks when needed
- [ ] Document hook bypass procedures
- [ ] Test pre-push hook performance

**Files to Create**:
- `.husky/pre-push` - Pre-push hook script

**Example Implementation**:
```bash
# Create pre-push hook
cat > .husky/pre-push << 'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "Running tests before push..."
pnpm test --run --reporter=verbose

if [ $? -ne 0 ]; then
  echo "Tests failed. Push aborted."
  echo "To skip this check, use: git push --no-verify"
  exit 1
fi

echo "All tests passed. Proceeding with push."
EOF

chmod +x .husky/pre-push
```

### Step 4: CI Pipeline Improvements (3 days)

**Tasks**:
- [ ] Add dependency caching to check.yml
- [ ] Parallelize lint, typecheck, and test jobs
- [ ] Add build caching
- [ ] Optimize Playwright browser caching
- [ ] Add CI performance monitoring
- [ ] Document CI optimization

**Files to Modify**:
- `.github/workflows/check.yml` - Add caching and parallelization

**Example Implementation**:
```yaml
# .github/workflows/check.yml (optimized)
name: Check

on:
  pull_request:
  push:
    branches: [main, features/*]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ~/.pnpm-store
          key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-

      - run: pnpm install --frozen-lockfile

      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      - name: Cache TypeScript build
        uses: actions/cache@v4
        with:
          path: |
            **/.tsbuildinfo
            **/tsconfig.tsbuildinfo
          key: ${{ runner.os }}-tsc-${{ hashFiles('**/tsconfig.json') }}

      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm test -- --coverage

      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          token: ${{ secrets.CODECOV_TOKEN }}

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      - name: Cache Vite build
        uses: actions/cache@v4
        with:
          path: |
            node_modules/.vite
            dist
          key: ${{ runner.os }}-vite-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ hashFiles('src/**') }}

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  e2e:
    needs: build
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-playwright-${{ hashFiles('**/pnpm-lock.yaml') }}

      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps

      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - run: pnpm test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results-${{ matrix.os }}
          path: test-results/
```

## Todo List

- [ ] Install and configure Husky
- [ ] Set up lint-staged for pre-commit
- [ ] Configure commitlint with conventional commits
- [ ] Add pre-push hook for unit tests
- [ ] Optimize CI pipeline with caching
- [ ] Parallelize CI jobs
- [ ] Add CI performance monitoring
- [ ] Document git hooks and bypass procedures
- [ ] Add developer onboarding documentation
- [ ] Create CONTRIBUTING.md

## Success Criteria

- [ ] Pre-commit hooks run in <10 seconds
- [ ] 100% of commits follow conventional format
- [ ] CI pipeline runs 30% faster with caching
- [ ] Zero broken commits pushed to main
- [ ] Developer documentation updated
- [ ] All team members onboarded with new workflow

## Risk Assessment

**Low Risk**: Husky is widely adopted and stable
- **Mitigation**: Clear documentation on hook bypass for emergencies

**Low Risk**: Hooks can be bypassed if needed (--no-verify)
- **Mitigation**: Document when bypass is appropriate

**Low Risk**: Pre-commit hooks may slow down commits
- **Mitigation**: Optimize to run in <10s, only check staged files

## Security Considerations

- Ensure hooks don't expose sensitive data in logs
- Validate hook scripts are not tampered with
- Use signed commits for additional security (optional)

## Next Steps

1. Install Husky and lint-staged
2. Configure pre-commit hooks
3. Set up commitlint
4. Add pre-push hooks
5. Optimize CI pipeline
6. Document workflow
7. Onboard team

**After Completion**: Code quality will be enforced automatically, reducing review time and catching issues earlier. CI pipeline will run 30% faster with caching.
