---
description: Run tests, analyze coverage, validate build process, and ensure code quality
---

# /test - Run Tests & Validate

$ARGUMENTS

---

## Workflow

### 1. Pre-flight Checks
// turbo
- Run typecheck: `npx tsc --noEmit`
- Check for syntax errors

### 2. Run Tests
// turbo
- Run test suite: `npm test` or `pnpm test`
- Capture and analyze results

### 3. Coverage Analysis (if applicable)
// turbo
- Run coverage: `npm run test:coverage`
- Verify 80%+ threshold
- Identify uncovered critical paths

### 4. Build Validation
// turbo
- Run build: `npm run build`
- Check for warnings or errors

### 5. Report
- Total tests: passed/failed/skipped
- Coverage metrics
- Failed test details with error messages
- Performance metrics (slow tests)
- Recommended actions

---

## Critical Rules
- **NEVER** use fake data or mocks just to pass tests
- **NEVER** ignore failing tests
- Fix all failing tests before marking complete
- Real tests with real assertions only

---

## Usage Examples
```
/test
/test coverage
/test run only auth tests
```
