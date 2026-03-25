---
description: Write development journal entries documenting challenges, failures, and decisions with emotional honesty
---

# /journal - Development Journal

$ARGUMENTS

---

## Workflow

Apply `journal-writer` agent expertise to explore recent code changes and challenges, then write journal entries.

### 1. Explore Context
- Review recent git history: `git log --oneline -20`
- Check for recent test failures, bugs, or challenges
- Read any related plans or documentation

### 2. Write Journal Entry
- Create entry in `./docs/journals/YYMMDDHHmm-title.md`
- Follow the journal entry structure from `journal-writer` agent
- Be brutally honest about what happened
- Include technical details and emotional reality
- Extract actionable lessons

### 3. Report
- Present the journal entry to user for review

**IMPORTANT:** DO NOT implement anything — only document and reflect.

---

## Usage Examples
```
/journal
/journal about the database migration failure today
/journal document the auth refactoring decision
```
