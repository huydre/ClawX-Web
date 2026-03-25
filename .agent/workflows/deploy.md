---
description: Deploy application to production or staging environment with pre-deploy checks
---

# /deploy - Deploy Application

$ARGUMENTS

---

## Pre-Deploy Checklist

### 1. Code Quality
// turbo
- Run typecheck: `npx tsc --noEmit`
- Run linting: `npm run lint`
- Verify no TODO/FIXME items in production code

### 2. Tests
// turbo
- Run full test suite: `npm test`
- All tests must pass — no exceptions

### 3. Security
- Check for exposed secrets: `git diff --cached | grep -iE "(api[_-]?key|token|password|secret)"`
- Run `npm audit` for dependency vulnerabilities
- Review CORS and security headers

### 4. Build
// turbo
- Production build: `npm run build`
- Verify build succeeds without errors

### 5. Deploy
- Follow project-specific deployment process
- Monitor for errors after deployment
- Verify core functionality works

### 6. Post-Deploy
- Update `./docs/project-roadmap.md` if milestone reached
- Commit deployment notes
- Report back with deployment status

---

## Usage Examples
```
/deploy to staging
/deploy to production
/deploy verify pre-deploy checks only
```
