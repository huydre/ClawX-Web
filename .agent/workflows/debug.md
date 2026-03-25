---
description: Systematic debugging with root cause analysis. Use when encountering errors, performance issues, or unexpected behavior.
---

# /debug - Debug Issues

**Reported Issues**:
 $ARGUMENTS

Apply `debugger` agent approach (4-phase: Reproduce → Isolate → Understand → Fix) to find the root cause of the issues, then analyze and explain the reports to the user.

**IMPORTANT**: **Do not** implement the fix automatically — only investigate and report.
**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing outputs.

---

## Workflow

### 1. Reproduce
- Get exact reproduction steps
- Determine rate (100%? intermittent?)
- Document expected vs actual behavior
- Check for recent changes (`git log --oneline -10`)

### 2. Isolate
- When did it start? What changed?
- Which component is responsible?
- Create minimal reproduction case
- Use binary search (git bisect if needed)

### 3. Root Cause Analysis
- Apply "5 Whys" technique
- Trace data flow through the system
- Check logs: server logs, browser console, CI/CD
- Query database if relevant (`psql`)
- Identify the **actual** bug, not the symptom
- Apply `systematic-debugging` skill to break complex problems into sequential thought steps

### 4. Report
Present findings to user:
- Root cause identified with evidence
- Affected files and components
- Recommended fix approach (2-3 options with pros/cons)
- Risk assessment for each approach
- **Do NOT implement** — only report

---

## Quick Reference

| Error Type        | Starting Point                        |
| ----------------- | ------------------------------------- |
| Server 500        | Check server logs → trace to handler |
| Client crash      | Browser console → React error       |
| Slow response     | Profile → identify bottleneck        |
| Data mismatch     | Trace: DB → API → UI                |
| Test failure      | Read error message → find assertion  |

---

## Usage Examples
```
/debug API returns 500 on login endpoint
/debug page freezes when loading treatment list
/debug WebSocket connection drops intermittently
/debug CI pipeline failing on test step
```
