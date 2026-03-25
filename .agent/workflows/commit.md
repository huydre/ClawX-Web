---
description: Stage all files, create a conventional commit, and optionally push. Includes secret scanning.
---

# /commit - Git Commit & Push

$ARGUMENTS

---

## Workflow

### 1. Stage & Security Check
// turbo
```bash
git add -A && git diff --cached --stat
```

### 2. Secret Scan
// turbo
```bash
git diff --cached | grep -c -iE "(api[_-]?key|token|password|secret|private[_-]?key|credential)" || true
```
**If secrets found → STOP. Show matched lines. Do NOT commit.**

### 3. Generate Commit Message
- Analyze staged changes
- Create conventional commit: `type(scope): description`
- < 72 chars, present tense, imperative mood
- NO AI attribution

### 4. Commit
```bash
git commit -m "type(scope): description"
```

### 5. Push (only if user explicitly requests)
```bash
git push
```

---

## Usage Examples
```
/commit
/commit and push
/commit feat: add WiFi configuration endpoint
```
