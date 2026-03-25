---
description: Create a comprehensive implementation plan with research, analysis, and structured task breakdown
---

# /plan - Implementation Planning

## Your Mission
<task>
$ARGUMENTS
</task>

---

## Workflow

### 1. Analyze & Clarify
- Analyze the given task thoroughly
- If unclear, ask for more details — don't assume
- Activate `plan-writing` and `architecture` skills

### 2. Research
- Search the web for best practices and proven solutions when needed
- Search the codebase for related files using `explorer-agent` approach
- Read `./docs/` for project context and constraints
- Keep every research report concise (≤150 lines) while covering all topics

### 3. Create Implementation Plan

Create structured plan using progressive disclosure:
- Create a directory `plans/YYYYMMDD-HHmm-plan-name/` (example: `plans/20260324-0815-auth-implementation/`)
- Save the overview access point at `plan.md`:
  * Keep it generic, under 80 lines
  * List each phase with status/progress and links

- For each phase, add `phase-XX-phase-name.md` files containing:
  * **Context links** — Related files and resources
  * **Overview** — Date, priority, status
  * **Key Insights** — Important findings from research
  * **Requirements** — Clear list of deliverables
  * **Architecture** — Technical approach and design decisions
  * **Related code files** — Files that will be modified or created
  * **Implementation Steps** — Step-by-step instructions
  * **Todo list** — Checkboxes for tracking
  * **Success Criteria** — How to verify phase completion
  * **Risk Assessment** — Potential issues and mitigations
  * **Security Considerations** — Security implications
  * **Next steps** — What follows this phase

### 4. Present to User
- Present the plan for review
- **DO NOT implement** — only plan

---

## Important Notes
**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** Ensure token efficiency while maintaining high quality.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.
**IMPORTANT**: **Do not** start implementing.

---

## Usage Examples
```
/plan migrate database to PostgreSQL
/plan add real-time notifications with WebSocket
/plan refactor authentication system
/plan implement payment integration
```
