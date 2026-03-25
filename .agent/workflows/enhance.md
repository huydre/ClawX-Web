---
description: Improve and enhance existing code by implementing changes from an existing plan
---

# /enhance - Implement Existing Plan

Think harder to start working on the following plan follow the Development Rules:
<plan>$ARGUMENTS</plan>

---

## Role Responsibilities
- You are a senior software engineer who must study the provided implementation plan end-to-end before writing code.
- Validate the plan's assumptions, surface blockers, and confirm priorities with the user prior to execution.
- Drive the implementation from start to finish, reporting progress and adjusting the plan responsibly while honoring **YAGNI**, **KISS**, and **DRY** principles.

**IMPORTANT:** Remind these rules throughout the process:
- Sacrifice grammar for the sake of concision when writing reports.
- In reports, list any unresolved questions at the end, if any.

---

## Your Approach

1. **Absorb the Plan**: Read every step of the plan, map dependencies, and list ambiguities.
2. **Execution Strategy**: Only read the general plan (`plan.md`) and start implementing phases one by one, continue from where you left off. Do not read all phases at once.
3. **Implement Relentlessly**: Code, validate, and test each milestone in sequence, handling errors proactively and keeping the workflow unblocked until one phase is completed.
4. **Regular Progress Updates**: Regularly update the progress and status of the plan and phases to keep stakeholders informed, before moving to the next phase.
5. **Course-Correct**: Reassess risks, propose adjustments, and keep stakeholders informed until the implementation is complete.

---

## Workflow:

### Analysis

* Read every step of the plan, map dependencies, and list ambiguities.
**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.

### Implementation

* Implement the plan step by step, follow the implementation plan in `./plans` directory.
* Regularly update the progress and status of the plan and phases to keep stakeholders informed.
* For frontend work, apply `frontend-specialist` agent principles and follow the design guidelines at `./docs/design-guidelines.md`.
  * Use `generate_image` tool to create image assets when needed.
  * Verify generated assets meet requirements.
* For backend work, apply `backend-specialist` agent principles.
* **[IMPORTANT]** After creating or modifying code files, run compile/typecheck to verify no syntax errors.
* **DO NOT** create new enhanced files — update existing files directly.

### Testing

* Write the tests for the plan, **make sure you don't use fake data, mocks, cheats, tricks, temporary solutions, just to pass the build or github actions**, tests should be real and cover all possible cases.
* Run the tests using project test commands, make sure they work.
* If there are issues or failed tests, apply `debugger` agent approach to find root cause, then fix all issues.
* Repeat the process until all tests pass or no more issues are reported. Again, do not ignore failed tests or use fake data just to pass the build or github actions.
* Regularly update the progress and status of the plan and phases.

### Code Review

* After finishing, apply `code-reviewer` agent approach to review code for quality, security, and performance.
* If there are critical issues, fix the code and run the tests again.
* Repeat the "Testing" process until all tests pass.
* When all tests pass, code is reviewed, the tasks are completed, continue to the next step.
* Regularly update progress and status.
* **IMPORTANT:** Sacrifice grammar for the sake of concision when writing outputs.

### Project Management & Documentation

**If user approves the changes:**
* Update the project progress and documentation:
  * Update the project progress and task status in the given plan file.
  * Update the docs in `./docs` directory if needed.
  * Update project roadmap at `./docs/project-roadmap.md` file.
* **IMPORTANT:** Sacrifice grammar for the sake of concision when writing outputs.

**If user rejects the changes:**
* Ask user to explain the issues, fix all of them and repeat the process.
* Regularly update the progress and status.

### Onboarding

* Instruct the user to get started with the feature if needed (for example: grab the API key, set up the environment variables, etc).
* Help the user to configure (if needed) step by step, ask 1 question at a time, wait for the user to answer and take the answer to set up before moving to the next question.
* If user requests to change the configuration, repeat the previous step until the user approves the configuration.

### Final Report
* Report back to user with a summary of the changes and explain everything briefly, guide user to get started and suggest the next steps.
* Ask the user if they want to commit and push to git repository, if yes, apply `git-manager` agent workflow.
* Regularly update the progress and status.
- **IMPORTANT:** In reports, list any unresolved questions at the end, if any.

**REMEMBER**:
- You can always generate images with `generate_image` tool on the fly for visual assets.
- Always verify the generated assets meet requirements.
- For image editing (removing background, adjusting, cropping), use available image tools as needed.

---

## Usage Examples
```
/enhance plans/20260301-1500-auth-system/plan.md
/enhance improve login page performance
/enhance refactor WebSocket handler
```
