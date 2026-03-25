---
description: Check project status, progress tracking, and roadmap updates
---

# /status - Project Status

$ARGUMENTS

---

## Workflow

### 1. Read Plans
- Scan `./plans/` directory for active implementation plans
- Read `plan.md` overview files for each active plan
- Check phase statuses and completion percentages

### 2. Check Codebase
- Review recent git history: `git log --oneline -20`
- Check for uncommitted changes: `git status`
- Look for TODO/FIXME items in code

### 3. Documentation Status
- Read `./docs/project-roadmap.md` if it exists
- Check if documentation is current with implementation

### 4. Report
Provide concise status:
- **Active Plans**: List with completion %
- **Recent Changes**: Last 5-10 commits
- **Blockers**: Any unresolved issues
- **Next Steps**: Prioritized recommendations

---

## Usage Examples
```
/status
/status of authentication plan
/status what's left to do
```
