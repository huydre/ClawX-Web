---
description: Create a pull request from current branch to target branch using GitHub CLI
---

# /pr - Create Pull Request

$ARGUMENTS

---

## Workflow

### 1. Check Prerequisites
// turbo
```bash
gh --version 2>/dev/null || echo "ERROR: Install GitHub CLI first: brew install gh && gh auth login"
```

### 2. Check Current State
// turbo
```bash
git status && echo "---" && git log --oneline -5
```

### 3. Create PR
- Default: current branch → `main`
- Include summary of changes from recent commits
- Use descriptive title in conventional format

```bash
gh pr create --base main --title "type(scope): description" --body "## Changes\n- ..."
```

---

## Usage Examples
```
/pr
/pr to develop
/pr to main from feature/auth
```
