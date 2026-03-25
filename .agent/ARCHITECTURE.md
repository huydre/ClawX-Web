# ClawX-Web Agent Architecture

## 📋 Overview
Agent system for ClawX-Web, consisting of:

- **19 Specialist Agents** — Role-based AI personas
- **22 Workflows** — Slash command procedures
- **36 Skills** — Domain-specific knowledge (global `~/.gemini/antigravity/skills/`)

---

## 🏗️ Directory Structure
```plaintext
.agent/
├── ARCHITECTURE.md          # This file
├── rules/
│   └── GEMINI.md            # Global rules & routing
├── agents/                  # 19 Specialist Agents
│   ├── orchestrator.md
│   ├── project-planner.md
│   ├── frontend-specialist.md
│   ├── backend-specialist.md
│   ├── fullstack-developer.md
│   ├── database-architect.md
│   ├── debugger.md
│   ├── test-engineer.md
│   ├── code-reviewer.md
│   ├── code-simplifier.md
│   ├── documentation-writer.md
│   ├── git-manager.md
│   ├── security-auditor.md
│   ├── performance-optimizer.md
│   ├── researcher.md
│   ├── brainstormer.md
│   ├── copywriter.md
│   ├── journal-writer.md
│   └── explorer-agent.md
└── workflows/               # 22 Slash Commands
    ├── ask.md               # Technical consultation
    ├── bootstrap.md         # New project setup
    ├── brainstorm.md        # Socratic discovery
    ├── commit.md            # Git commit + push
    ├── content.md           # Marketing copy & content
    ├── cook.md              # Full lifecycle build
    ├── create.md            # Full lifecycle build (alias)
    ├── debug.md             # Root cause analysis
    ├── deploy.md            # Pre-deploy + deploy
    ├── design.md            # UI/UX design workflow
    ├── docs.md              # Documentation management
    ├── enhance.md           # Improve from plan
    ├── fix.md               # Auto-detect fix
    ├── journal.md           # Dev journal entries
    ├── plan.md              # Task planning
    ├── pr.md                # Pull request
    ├── preview.md           # Dev server
    ├── review.md            # Codebase review
    ├── scout.md             # Codebase file discovery
    ├── status.md            # Project status
    ├── test.md              # Tests + coverage
    └── wrapup.md            # Review recent changes
```

---

## 🤖 Agents (19)
Specialist AI personas for different domains.

| Agent                    | Focus                      | Skills Used                                    |
| ------------------------ | -------------------------- | ---------------------------------------------- |
| `orchestrator`           | Multi-agent coordination   | behavioral-modes                               |
| `project-planner`        | Research, planning         | plan-writing, architecture, brainstorming      |
| `frontend-specialist`    | Web UI/UX, React, Vite     | frontend-design, react-best-practices, tailwind|
| `backend-specialist`     | API, Express, Node.js      | api-patterns, nodejs-best-practices            |
| `fullstack-developer`    | Full-stack implementation  | react-best-practices, api-patterns, nodejs     |
| `database-architect`     | Schema, SQL                | database-design                                |
| `debugger`               | Root cause analysis        | systematic-debugging                           |
| `test-engineer`          | Testing, QA                | testing-patterns, tdd-workflow, webapp-testing  |
| `code-reviewer`          | Code quality, security     | code-review-checklist, clean-code              |
| `code-simplifier`        | Code refinement, clarity   | clean-code                                     |
| `documentation-writer`   | Docs management            | documentation-templates                        |
| `git-manager`            | Git operations             | —                                              |
| `security-auditor`       | Security compliance        | vulnerability-scanner, red-team-tactics         |
| `performance-optimizer`  | Speed, optimization        | performance-profiling                          |
| `researcher`             | Technical research         | —                                              |
| `brainstormer`           | Creative ideation          | brainstorming                                  |
| `copywriter`             | Marketing copy             | —                                              |
| `journal-writer`         | Dev journals, decisions    | —                                              |
| `explorer-agent`         | Codebase search            | —                                              |

---

## 🔄 Workflows (22)
Slash command procedures. Invoke with `/command`.

| Command       | Description                                    | Source (.claude)              |
| ------------- | ---------------------------------------------- | -----------------------------|
| `/ask`        | Technical & architectural consultation         | commands/ask.md              |
| `/bootstrap`  | New project from scratch (full setup)          | commands/bootstrap.md        |
| `/brainstorm` | Socratic discovery and solution exploration    | commands/brainstorm.md       |
| `/commit`     | Stage, commit, push with secret scanning       | commands/git/cm + git/cp     |
| `/content`    | Marketing copy & creative content              | commands/content/*           |
| `/cook`       | Full lifecycle: plan → implement → test → ship | commands/cook.md             |
| `/create`     | Full lifecycle (alias for /cook)               | commands/cook.md             |
| `/debug`      | Systematic debugging with root cause analysis  | commands/debug.md            |
| `/deploy`     | Pre-deploy checks and deployment               | —                            |
| `/design`     | UI/UX design from research to implementation   | commands/design/*            |
| `/docs`       | Documentation init, update, summarize          | commands/docs/*              |
| `/enhance`    | Improve existing code from a plan              | commands/code.md             |
| `/fix`        | Auto-detect complexity fix                     | commands/fix.md + fix/*      |
| `/journal`    | Development journal entries                    | commands/journal.md          |
| `/plan`       | Structured task breakdown and planning         | commands/plan.md             |
| `/pr`         | Create pull request via GitHub CLI             | commands/git/pr.md           |
| `/preview`    | Start development server for preview           | —                            |
| `/review`     | Codebase quality & security scan               | commands/review/codebase.md  |
| `/scout`      | Fast codebase file discovery                   | commands/scout.md            |
| `/status`     | Check project status and progress              | commands/watzup.md (partial) |
| `/test`       | Run tests, coverage, build validation          | commands/test.md             |
| `/wrapup`     | Review recent changes and summarize            | commands/watzup.md           |

---

## 🎯 Skill Loading Protocol
```
User Request → Skill Description Match → Load SKILL.md
                                            ↓
                                    Read references/
                                            ↓
                                    Read scripts/
```

Skills are loaded from `~/.gemini/antigravity/skills/` (global) automatically based on task context.

---

## 📊 Statistics

| Category  | Count |
| --------- | ----- |
| Agents    | 19    |
| Workflows | 22    |
| Skills    | 36    |
| Rules     | 1     |
| **Total** | **43 files** |

---

## 🔗 Quick Reference

### Key Paths
- Project Root: `/Users/hnam/Documents/ClawX-Web`
- Frontend: `src/` (Vite + React + TypeScript)
- Backend: `server/` (Express + TypeScript)
- Electron: `electron/`
- Tests: `tests/`
- Docs: `docs/`
- Plans: `plans/`

### Auto-Routing
Agent selection is automatic — no need to mention agents explicitly.
The system analyzes your request and selects the best specialist(s).

---

## 📍 Mapping: .claude → .agent

### Agents Mapping
| .claude Agent       | .agent Agent             | Notes                    |
| ------------------- | ------------------------ | ------------------------ |
| `planner`           | `project-planner`        | Renamed                  |
| `brainstormer`      | `brainstormer`           | Direct port              |
| `code-reviewer`     | `code-reviewer`          | Direct port              |
| `copywriter`        | `copywriter`             | Direct port              |
| `database-admin`    | `database-architect`     | Renamed                  |
| `debugger`          | `debugger`               | Direct port              |
| `docs-manager`      | `documentation-writer`   | Renamed                  |
| `git-manager`       | `git-manager`            | Direct port              |
| `project-manager`   | `orchestrator`           | Expanded role            |
| `researcher`        | `researcher`             | Direct port              |
| `scout`             | `explorer-agent`         | Renamed                  |
| `scout-external`    | `explorer-agent`         | Merged into explorer     |
| `tester`            | `test-engineer`          | Renamed                  |
| `ui-ux-designer`    | `frontend-specialist`    | Expanded role            |
| `journal-writer`    | `journal-writer`         | Direct port              |
| `mcp-manager`       | —                        | N/A in Antigravity       |
| —                   | `backend-specialist`     | NEW                      |
| —                   | `fullstack-developer`    | NEW                      |
| —                   | `code-simplifier`        | NEW                      |
| —                   | `security-auditor`       | NEW                      |
| —                   | `performance-optimizer`  | NEW                      |

### Not Ported (by design)
- **hooks/** — Antigravity doesn't support hooks
- **skills/** (32 project-local dirs) — Antigravity uses global skills (36 available)
- **settings.json** — No equivalent in Antigravity
- **mcp-manager** — Claude MCP integration specific
