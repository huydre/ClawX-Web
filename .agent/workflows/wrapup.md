---
description: Review recent changes and provide a summary of current branch status
---

# /wrapup - Review & Wrap Up

$ARGUMENTS

---

## Workflow

### 1. Review Changes
// turbo
```bash
git log --oneline -10
```

// turbo
```bash
git diff --stat HEAD~5..HEAD 2>/dev/null || git diff --stat
```

### 2. Analyze
- Summarize what was modified, added, or removed
- Assess overall impact and quality
- Identify any loose ends or TODOs

### 3. Report
- Summary of all changes
- Quality assessment
- Remaining work or suggestions
- Ask if user wants to commit/push

**DO NOT implement anything — only review and report.**

---

## Usage Examples
```
/wrapup
/wrapup what did we change today
```
