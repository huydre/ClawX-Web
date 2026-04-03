# GoClaw Features Analysis - What to bring into ClawX

> Date: 2026-03-31
> Purpose: So sanh GoClaw repo va ClawX-Web, xac dinh features hay co the tich hop vao ClawX.

---

## 1. Tong quan

### GoClaw

- **Repo:** `C:\Users\Admin\Desktop\techla-project\goclaw`
- **Mo ta:** Production-grade, multi-tenant AI agent gateway viet bang Go
- **Backend:** Go 1.26 (~25MB static binary, sub-second startup)
- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 + Radix UI + Zustand
- **Database:** PostgreSQL 18 (primary) / SQLite 3 (desktop)
- **Protocols:** REST API + WebSocket RPC v3
- **Quy mo:** ~780 Go files, 474 TS/React files, 140+ tool implementations
- **License:** CC BY-NC 4.0

### ClawX-Web

- **Repo:** `C:\Users\Admin\Desktop\techla-project\ClawX-Web`
- **Mo ta:** Desktop app (Electron) lam GUI cho OpenClaw AI agents
- **Runtime:** Electron 40+ / Express backend (web mode)
- **Frontend:** React 19 + Vite 7 + Tailwind CSS 3.4 + shadcn/ui + Zustand
- **Database:** lowdb (JSON) / electron-store
- **Quy mo:** ~474 TS files
- **License:** MIT

---

## 2. Features ClawX da co

| Feature | Trang thai |
|---------|-----------|
| Chat interface (streaming, thinking toggle, tool visualization) | Done |
| Multi-channel management (12+ platforms) | Done |
| Cron task scheduling | Done |
| Skills marketplace & installation | Done |
| Dashboard (system monitoring, charts) | Done |
| Setup wizard (6 steps) | Done |
| Settings (theme, language, providers, auth, tunnel, updates) | Done |
| i18n (EN, VI, JA, ZH-CN, ZH-TW) | Done |
| Cloudflare tunnel | Done |
| Auto-update system | Done |
| System tray integration | Done |
| Keychain secure storage | Done |

---

## 3. Features hay tu GoClaw co the them vao ClawX

### 3.1 Agent Management (UU TIEN CAO)

**GoClaw co:**
- Agent CRUD (create, read, update, delete)
- Agent types: `open` (per-user context) va `predefined` (shared context)
- Context files editor (SOUL.md, IDENTITY.md, USER.md per user)
- Workspace sharing giua agents
- Agent delegation (sync/async inter-agent requests)
- Permission links (outbound/inbound/bidirectional) voi concurrency limits
- Subagent spawning voi dedicated lanes

**ClawX thieu:**
- Khong co trang quan ly agents
- Khong co CRUD agent
- Khong co context file editor

**De xuat:**
- Them trang `/agents` voi danh sach agents
- Agent editor: name, model, system prompt, context files
- Agent sharing/delegation UI
- Subagent spawning controls

**Files tham khao GoClaw:**
- `ui/web/src/pages/agents/` - React components
- `internal/agent/` - 47 files, agent loop logic
- `internal/store/agents.go` - Store interface

---

### 3.2 Memory Browser (UU TIEN CAO)

**GoClaw co:**
- Long-term memory voi pgvector + FTS5 hybrid search
- BM25 + embedding combined ranking
- Auto-flush khi >6000 tokens hoac on finalize
- Memory document CRUD qua API/web UI
- Chunk visualization trong admin dashboard
- `memory_search` tool (FTS5 + pgvector)
- `memory_get` tool

**ClawX thieu:**
- Khong co memory browser UI
- Khong co cach xem/search memory cua agents

**De xuat:**
- Them trang `/memory` voi search bar (keyword + semantic)
- Memory document list voi metadata (agent, timestamp, tokens)
- Chunk viewer voi highlight
- Delete/edit memory entries
- Memory usage stats

**Files tham khao GoClaw:**
- `ui/web/src/pages/memory/` - React components
- `internal/memory/` - Memory logic
- `internal/store/memory.go` - Store interface
- `internal/tools/memory_search.go` - Search tool

---

### 3.3 MCP Servers Management (UU TIEN CAO)

**GoClaw co:**
- MCP server config UI (add/edit/delete servers)
- Multiple transports: stdio, SSE, streamable-http
- Tool discovery tu MCP servers
- Per-agent grants (tool availability by agent)
- Per-user grants (tool access by user)
- BM25 indexing cua MCP tools
- Lazy loading (connect on first use)
- MCP bridge (server proxy/stdio adapter)

**ClawX thieu:**
- Khong co MCP management UI

**De xuat:**
- Them trang `/mcp-servers`
- Server list voi status (connected/disconnected)
- Add server dialog (name, transport type, command/URL)
- Tool browser per server
- Grants management (assign tools to agents)

**Files tham khao GoClaw:**
- `ui/web/src/pages/mcp/` - React components
- `internal/mcp/` - 13 files
- `internal/store/mcp_servers.go` - Store interface

---

### 3.4 Knowledge Graph (UU TIEN TRUNG BINH)

**GoClaw co:**
- LLM-powered entity extraction tu conversation
- Relationship storage (PostgreSQL + pgvector)
- Graph traversal (follow entity relationships)
- Force-directed visualization (D3.js interactive graph)
- Semantic similarity (vector-based lookups)
- `knowledge_graph_search` tool cho agents

**ClawX thieu:**
- Hoan toan chua co

**De xuat:**
- Them trang `/knowledge-graph`
- Interactive graph visualization (dung D3.js hoac react-force-graph)
- Entity search bar
- Entity detail panel (relationships, sources)
- Graph filtering by entity type

**Files tham khao GoClaw:**
- `ui/web/src/pages/knowledge-graph/` - React components
- `internal/knowledgegraph/` - 5 files
- `internal/store/knowledge_graph.go` - Store interface

---

### 3.5 Traces / LLM Observability (UU TIEN TRUNG BINH)

**GoClaw co:**
- LLM call tracing voi request/response details
- Span timeline (visual timeline cua tool calls)
- Prompt cache metrics (hit/miss/write counts)
- Token counting chi tiet (input/output/cache tokens)
- Cost estimation
- Optional OpenTelemetry/Jaeger export

**ClawX co:**
- System monitor co ban (CPU, RAM, disk, network)
- Thieu LLM-specific tracing

**De xuat:**
- Them trang `/traces`
- Trace list voi filters (agent, model, time range)
- Trace detail: timeline spans, token breakdown
- Prompt cache dashboard (hit rate, savings)
- Token usage charts (Recharts)
- Cost per agent/model breakdown

**Files tham khao GoClaw:**
- `ui/web/src/pages/traces/` - React components
- `internal/store/tracing_store.go` - Store interface

---

### 3.6 Teams & Kanban (UU TIEN TRUNG BINH)

**GoClaw co:**
- Team creation voi member roles
- Task board (kanban style: create, claim, complete, search)
- Team mailbox (send, broadcast, read messages)
- Team reminders
- Cross-team communication

**ClawX thieu:**
- Khong co team management
- Khong co task board

**De xuat:**
- Them trang `/teams`
- Team CRUD (name, members, roles)
- Kanban board (dung dnd-kit cho drag-drop)
- Task cards: title, assignee, status, priority
- Team mailbox/chat

**Files tham khao GoClaw:**
- `ui/web/src/pages/teams/` - React components
- `internal/store/teams.go` - Store interface

---

### 3.7 Sessions Browser (UU TIEN TRUNG BINH)

**GoClaw co:**
- Active session list voi metadata
- Session history audit trail
- Cross-session messaging
- Session spawning
- Auto-summarization khi >85% context tokens

**ClawX co:**
- Chat session selector (basic)
- Thieu session browser/history detail

**De xuat:**
- Them trang `/sessions` hoac nang cap session panel
- Session list voi: agent, user, channel, duration, token count
- Session history viewer (full conversation replay)
- Session search/filter
- Auto-summarization indicator

**Files tham khao GoClaw:**
- `ui/web/src/pages/sessions/` - React components

---

### 3.8 Usage & Token Analytics (UU TIEN TRUNG BINH)

**GoClaw co:**
- Token usage per agent/model/user
- Cost tracking va quotas
- Usage charts (Recharts)
- Daily/weekly/monthly breakdowns

**ClawX co:**
- Basic analytics service (message counts)
- Thieu token-level analytics

**De xuat:**
- Them trang `/usage` hoac section trong Dashboard
- Token usage breakdown (input/output/cache)
- Cost estimation per provider
- Usage trends (daily/weekly charts)
- Top agents by token consumption
- Quota management UI

---

### 3.9 Approval Workflows (UU TIEN THAP)

**GoClaw co:**
- Pending exec approvals queue
- Khi agent chay shell command nguy hiem → can user approval
- Approval/deny controls voi timeout

**ClawX thieu:**
- Khong co approval system

**De xuat:**
- Them trang `/approvals` hoac notification panel
- Pending approval list voi command details
- Approve/Deny buttons voi timeout countdown
- History cua past approvals

**Files tham khao GoClaw:**
- `ui/web/src/pages/approvals/`

---

### 3.10 Heartbeat System (UU TIEN THAP)

**GoClaw co:**
- Periodic agent check-ins qua HEARTBEAT.md checklists
- Suppress-on-OK (skip notification neu tat ca checks pass)
- Active hours (chi chay trong time windows)
- Retry logic voi backoff
- Channel delivery (gui updates toi Telegram/Discord/Slack)

**ClawX thieu:**
- Khong co heartbeat/health check system

**De xuat:**
- Heartbeat config per agent
- Health status dashboard
- Alert rules khi agent khong responsive

---

### 3.11 Import/Export (UU TIEN THAP)

**GoClaw co:**
- Agent import/export (JSON/YAML)
- Team import/export
- Backup/restore functionality

**ClawX thieu:**
- Khong co import/export

**De xuat:**
- Export button cho agents, channels, skills, cron configs
- Import dialog voi validation
- Full backup/restore

---

### 3.12 Extended Thinking Config (UU TIEN THAP)

**GoClaw co:**
- Budget tokens config per provider (Anthropic)
- Reasoning effort levels (OpenAI)
- Thinking budget (DashScope)
- Per-agent thinking config
- Thinking token usage tracking trong traces

**ClawX co:**
- Thinking toggle (show/hide) trong chat
- Thieu config chi tiet

**De xuat:**
- Thinking config trong Agent settings
- Budget tokens slider
- Reasoning effort dropdown
- Thinking usage stats

---

## 4. Bang tom tat uu tien

| # | Feature | Uu tien | Do kho | Impact |
|---|---------|---------|--------|--------|
| 1 | Agent Management | CAO | Trung binh | Rat cao - core feature |
| 2 | Memory Browser | CAO | Trung binh | Cao - debug/manage context |
| 3 | MCP Servers UI | CAO | Thap-TB | Cao - MCP dang la trend |
| 4 | Knowledge Graph | TRUNG BINH | Cao | Cao - wow factor |
| 5 | Traces / Observability | TRUNG BINH | Trung binh | Cao - debug LLM calls |
| 6 | Teams & Kanban | TRUNG BINH | Trung binh | Trung binh |
| 7 | Sessions Browser | TRUNG BINH | Thap | Trung binh |
| 8 | Usage Analytics | TRUNG BINH | Thap | Trung binh |
| 9 | Approval Workflows | THAP | Thap | Thap-TB |
| 10 | Heartbeat System | THAP | Trung binh | Thap |
| 11 | Import/Export | THAP | Thap | Thap |
| 12 | Extended Thinking Config | THAP | Thap | Thap |

---

## 5. Tech notes

### GoClaw UI stack (de tham khao khi implement)
- React 19 + TypeScript 6
- Tailwind CSS 4 + Radix UI
- Zustand (state management)
- React Router 7
- Recharts (charts)
- dnd-kit (drag & drop - dung cho kanban)
- React Markdown
- i18next
- D3.js (knowledge graph visualization)
- TanStack React Table (data tables)

### ClawX UI stack (hien tai)
- React 19 + TypeScript 5.9
- Tailwind CSS 3.4 + shadcn/ui (Radix UI)
- Zustand 5.0
- React Router
- Recharts 3.8
- Framer Motion 12.34
- react-markdown 10.1
- i18next 25.8
- Lucide React (icons)

### Tuong thich tot
- Ca 2 deu dung React 19, Zustand, Radix UI, Recharts, i18next
- Co the port GoClaw React components sang ClawX voi minimal changes
- Chi can adjust: Tailwind version (4 vs 3.4), API layer (GoClaw REST vs ClawX IPC/Express)

---

## 6. Next steps

1. Chon feature(s) de implement truoc
2. Review GoClaw source code cua feature do chi tiet
3. Thiet ke API endpoints moi (neu can) trong ClawX Express backend
4. Port/adapt React components tu GoClaw sang ClawX
5. Them i18n translations (EN, VI)
6. Test va polish UI
