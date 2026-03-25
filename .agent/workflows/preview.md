---
description: Preview the application locally by starting the development server
---

# /preview - Preview Application

$ARGUMENTS

---

## Workflow

### 1. Check Environment
// turbo
- Verify dependencies: `ls node_modules/.package-lock.json 2>/dev/null || echo "Run npm install first"`

### 2. Start Development Server
- Start frontend: `npm run dev`
- Start backend (if needed): check `package.json` for server scripts
- Present URL to user

### 3. Verify
- Confirm server is running
- Report any startup errors
- Provide the local URL for preview

---

## Usage Examples
```
/preview
/preview start both frontend and backend
```
