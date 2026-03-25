---
description: Analyze and fix issues — auto-detects complexity and applies appropriate investigation depth
---

# /fix - Fix Issues

$ARGUMENTS

---

## Auto-Detect Complexity

Analyze the issues and decide the approach:

| Criteria            | Simple (Fast)           | Complex (Hard)                |
| ------------------- | ----------------------- | ----------------------------- |
| Files affected      | 1-3 files               | 4+ files                      |
| Root cause          | Obvious                 | Needs investigation           |
| Risk                | Low (UI, text, styling) | High (logic, data, security)  |
| Approach            | Direct fix              | Plan → fix → test → review   |

---

## Fast Fix Workflow

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.

1. If the user provides screenshots or videos, analyze and describe the issue in detail to predict root causes.
2. Apply `debugger` agent approach (4-phase: Reproduce → Isolate → Understand → Fix) to find the root cause.
3. Apply `systematic-debugging` skill to tackle the issues.
4. Start implementing the fix based on the analysis.
5. Run tests to verify the fix works.
6. If there are issues or failed tests, repeat from step 2.
7. After finishing, respond back to user with a summary of the changes and explain everything briefly, guide user to get started and suggest the next steps.

---

## Hard Fix Workflow

**Ultrathink** to plan & start fixing these issues follow the Development Rules:

**IMPORTANT:** Use `systematic-debugging` skill to break complex problems into sequential thought steps.

1. Apply `debugger` agent approach to find the root cause of the issues and create a diagnostic report.
2. Research about the root causes on the internet (if needed) using web search.
3. Create a focused implementation plan based on the reports in `plans/YYYYMMDD-HHmm-fix-name/`.
4. Implement the plan step by step.
5. Write test cases and run the tests, make sure they work.
6. If there are issues or failed tests, find the root cause and fix all issues.
7. Repeat the process until all tests pass or no more issues are reported.
8. After finishing, apply `code-reviewer` agent approach to review code.
   If there are critical issues, improve the code and test everything again.
   Report back to user with a summary of the changes, ask user to review and approve.
9. Project Management & Documentation:
   **If user approves the changes:**
     * Update the project progress and task status in the given plan file.
     * Update the docs in `./docs` directory if needed.
     * Update project roadmap at `./docs/project-roadmap.md` file.
     * **IMPORTANT:** Sacrifice grammar for the sake of concision when writing outputs.
   **If user rejects the changes:** Ask user to explain the issues, fix all of them and repeat the process.
10. Final Report:
   * Report back to user with a summary of the changes and explain everything briefly, guide user to get started and suggest the next steps.
   * Ask the user if they want to commit and push to git repository, if yes, apply `git-manager` agent workflow.
   - **IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
   - **IMPORTANT:** In reports, list any unresolved questions at the end, if any.

**REMEMBER**:
- You can always generate images with `generate_image` tool on the fly for visual assets.
- Always verify the generated assets meet requirements.
- For image editing (removing background, adjusting, cropping), use available image tools as needed.

---

## Usage Examples
```
/fix login page shows blank on mobile
/fix TypeScript errors in server/routes/wifi.ts
/fix CI pipeline failing on build step
/fix API returns 500 on payment endpoint
```
