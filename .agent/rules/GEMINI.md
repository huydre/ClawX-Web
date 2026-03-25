# GEMINI.md - ClawX-Web Agent System

> This file defines how the AI behaves in this workspace.

---

## CRITICAL: AGENT & SKILL PROTOCOL (START HERE)

> **MANDATORY:** You MUST read the appropriate agent file and its skills BEFORE performing any implementation. This is the highest priority rule.

### 1. Modular Skill Loading Protocol

```
User Request → Classify → Select Agent(s) → Load Skills → Execute
```

- Agents live in `.agent/agents/`
- Skills live in `.agent/skills/` (project) or `~/.gemini/antigravity/skills/` (global)
- Workflows live in `.agent/workflows/`
- When a skill has `scripts/` or `references/`, read them too

### 2. Enforcement Protocol

```
❌ WRONG: Read agent file → Start coding
✅ CORRECT: Read → Understand WHY → Apply PRINCIPLES → Code
```

**Before coding, answer:**
1. What is the GOAL of this agent/skill?
2. What PRINCIPLES must I apply?
3. How does this DIFFER from generic output?

---

## 📥 REQUEST CLASSIFIER (STEP 1)

**Before ANY action, classify the request:**

| Request Type     | Trigger Keywords                           | Action                      |
| ---------------- | ------------------------------------------ | --------------------------- |
| **QUESTION**     | "what is", "how does", "explain"           | Text Response               |
| **SURVEY/INTEL** | "analyze", "list files", "overview"        | Codebase Analysis           |
| **SIMPLE CODE**  | "fix", "add", "change" (single file)       | Inline Edit                 |
| **COMPLEX CODE** | "build", "create", "implement", "refactor" | Plan Required → Implement   |
| **DESIGN/UI**    | "design", "UI", "page", "dashboard"        | Design Process → Implement  |
| **SLASH CMD**    | /create, /debug, /plan, etc.               | Workflow-specific flow      |

---

## 🤖 INTELLIGENT AGENT ROUTING (STEP 2 - AUTO)

**ALWAYS ACTIVE: Before responding to ANY request, automatically analyze and select the best agent(s).**

### Auto-Selection Protocol

| User Request Domain    | Primary Agent            | Supporting Skills                                   |
| ---------------------- | ------------------------ | --------------------------------------------------- |
| Frontend/UI/UX         | `frontend-specialist`    | frontend-design, react-best-practices               |
| Backend/API/Server     | `backend-specialist`     | api-patterns, nodejs-best-practices                 |
| Full-Stack Features    | `fullstack-developer`    | react-best-practices, api-patterns, nodejs           |
| Database/Schema        | `database-architect`     | database-design                                     |
| Bug/Error/Issue        | `debugger`               | systematic-debugging                                |
| Testing                | `test-engineer`          | testing-patterns, tdd-workflow, webapp-testing       |
| Security               | `security-auditor`       | vulnerability-scanner, red-team-tactics              |
| Performance            | `performance-optimizer`  | performance-profiling                                |
| Documentation          | `documentation-writer`   | documentation-templates                              |
| Planning/Architecture  | `project-planner`        | plan-writing, architecture, brainstorming            |
| Brainstorming/Ideation | `brainstormer`           | brainstorming                                        |
| Code Review            | `code-reviewer`          | code-review-checklist, clean-code                    |
| Code Simplification    | `code-simplifier`        | clean-code                                           |
| Git/Version Control    | `git-manager`            | —                                                    |
| Research               | `researcher`             | —                                                    |
| Marketing/Copy         | `copywriter`             | —                                                    |
| Dev Journals           | `journal-writer`         | —                                                    |
| Codebase Search        | `explorer-agent`         | —                                                    |
| Multi-agent Tasks      | `orchestrator`           | behavioral-modes                                     |

### Response Format (MANDATORY)

When applying an agent, inform the user:
```
🤖 Applying @agent-name expertise...
```

---

## TIER 0: UNIVERSAL RULES (Always Active)

### 🌐 Language Handling
When user's prompt is NOT in English:
1. **Internally translate** for better comprehension
2. **Respond in user's language** — match their communication
3. **Code comments/variables** remain in English

### 🧹 Clean Code (Global Mandatory)

**ALL code MUST follow clean-code principles. No exceptions.**

- **Code**: Concise, direct, no over-engineering. Self-documenting.
- **Principles**: YAGNI, KISS, DRY — the holy trinity.
- **File Naming**: kebab-case with descriptive names.
- **File Size**: Keep under 200 lines. Split if larger.
- **Error Handling**: try-catch everywhere. Cover edge cases.
- **Security**: Never expose secrets, API keys, or credentials.

### 📁 File Dependency Awareness
**Before modifying ANY file:**
1. Check `ARCHITECTURE.md` and `docs/` for context
2. Identify dependent files
3. Update ALL affected files together

### 🗺️ System Map Read
> 🔴 **MANDATORY:** Read `ARCHITECTURE.md` at session start to understand the project.

**Path Awareness:**
- Agents: `.agent/agents/` (Project)
- Skills: `.agent/skills/` (Project) or `~/.gemini/antigravity/skills/` (Global)
- Workflows: `.agent/workflows/`
- Project Docs: `./docs/`
- Plans: `./plans/`

---

## TIER 1: CODE RULES (When Writing Code)

### 📱 Project Type Routing

| Project Type             | Primary Agent            | Skills                          |
| ------------------------ | ------------------------ | ------------------------------- |
| **FRONTEND** (Vite/React)| `frontend-specialist`    | frontend-design, tailwind       |
| **BACKEND** (Express/TS) | `backend-specialist`     | api-patterns, nodejs            |
| **ELECTRON** (Desktop)   | `backend-specialist`     | nodejs-best-practices           |
| **FULL-STACK**           | `fullstack-developer`    | Coordinate front + back         |

### 🛑 Socratic Gate

**For complex requests, STOP and ASK first:**

| Request Type            | Strategy       | Required Action                                     |
| ----------------------- | -------------- | --------------------------------------------------- |
| **New Feature / Build** | Deep Discovery | ASK minimum 3 strategic questions                   |
| **Code Edit / Bug Fix** | Context Check  | Confirm understanding + ask impact questions        |
| **Vague / Simple**      | Clarification  | Ask Purpose, Users, and Scope                       |
| **Full Orchestration**  | Gatekeeper     | STOP until user confirms plan                       |

**Protocol:**
1. **Never Assume:** If even 1% is unclear, ASK.
2. **Wait:** Do NOT write code until the user clears the Gate.
3. **Edge Cases:** Ask about trade-offs and edge cases even after answers.

### 🏁 Final Checklist Protocol

**Before marking any task as complete:**
1. Run type checking / compile to verify no syntax errors
2. Run tests if applicable
3. Verify all TODO items are completed
4. Check for no leaked secrets or credentials
5. Ensure documentation is updated if needed

### Development Rules

- **[IMPORTANT]** Follow the codebase structure and code standards in `./docs/` during implementation.
- **[IMPORTANT]** Do not just simulate or mock — always implement real code.
- **[IMPORTANT]** DO NOT create new enhanced files — update existing files directly.
- **[IMPORTANT]** After creating or modifying code files, run compile/typecheck to verify.
- Use `gh` CLI to interact with GitHub features if needed.
- Use `psql` to query PostgreSQL if needed.

### Pre-commit/Push Rules

- Run linting before commit
- Run tests before push (DO NOT ignore failed tests)
- Keep commits focused on actual code changes
- **DO NOT** commit confidential information (dotenv, API keys, credentials)
- Use conventional commit format, NO AI attribution

---

## TIER 2: DESIGN RULES (Reference)

When working on UI/UX:
1. Read `./docs/design-guidelines.md` if it exists
2. Apply `frontend-specialist` agent principles
3. Mobile-first approach
4. WCAG 2.1 AA minimum for accessibility
5. Vietnamese font support (Google Fonts with Vietnamese charset)
6. Touch targets minimum 44x44px

---

## 📁 QUICK REFERENCE

### Agents (19)
| Agent                    | Focus                      |
| ------------------------ | -------------------------- |
| `orchestrator`           | Multi-task coordination    |
| `project-planner`        | Research, planning         |
| `frontend-specialist`    | Web UI/UX, React, Vite     |
| `backend-specialist`     | API, Express, Node.js      |
| `fullstack-developer`    | Full-stack implementation  |
| `database-architect`     | Schema, SQL                |
| `debugger`               | Root cause analysis        |
| `test-engineer`          | Testing, QA                |
| `code-reviewer`          | Code quality, security     |
| `code-simplifier`        | Code refinement, clarity   |
| `documentation-writer`   | Docs management            |
| `git-manager`            | Git operations             |
| `security-auditor`       | Security compliance        |
| `performance-optimizer`  | Speed, optimization        |
| `researcher`             | Technical research         |
| `brainstormer`           | Creative ideation          |
| `copywriter`             | Marketing copy             |
| `journal-writer`         | Dev journals, decisions    |
| `explorer-agent`         | Codebase search            |

### Key Paths
- Project Root: `/Users/hnam/Documents/ClawX-Web`
- Frontend: `src/` (Vite + React + TypeScript)
- Backend: `server/` (Express + TypeScript)
- Electron: `electron/`
- Tests: `tests/`
- Docs: `docs/`
- Plans: `plans/`
