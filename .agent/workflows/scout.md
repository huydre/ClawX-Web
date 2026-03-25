---
description: Quickly scout and locate relevant files across the codebase for a specific task
---

# /scout - Codebase Scout

$ARGUMENTS

---

## Purpose

Search the codebase for files needed to complete the task using a fast, token-efficient approach.

---

## Workflow

### 1. Analyze the Search Request
- Understand what files are needed to complete the task
- Identify key directories: `src/`, `server/`, `electron/`, `tests/`, `docs/`
- Consider project structure from `./docs/codebase-summary.md` if available

### 2. Intelligent Directory Division
- Divide the codebase into logical sections for searching
- Prioritize high-value directories based on the task
- Ensure complete coverage of relevant areas

### 3. Execute Search
- Use file search and grep tools to locate relevant files
- Search for specific patterns, function names, imports, types
- Cross-reference file relationships and dependencies

### 4. Synthesize Results
- Deduplicate file paths
- Organize files by category or directory structure
- Present a clean, organized list

### 5. Report
- Save report to `plans/<plan-name>/reports/scout-report.md` if within a plan
- **IMPORTANT:** Sacrifice grammar for concision
- **IMPORTANT:** List unresolved questions at the end

---

## Quality Standards
- **Speed**: Complete searches within 3-5 minutes
- **Accuracy**: Only files directly relevant to the task
- **Coverage**: All likely directories searched
- **Clarity**: Organized, actionable format

---

## Usage Examples
```
/scout find all authentication-related files
/scout locate payment processing endpoints
/scout files related to WebSocket communication
/scout database migration files
```
