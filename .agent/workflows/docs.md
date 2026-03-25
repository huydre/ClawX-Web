---
description: Initialize, update, or summarize project documentation in ./docs/
---

# /docs - Documentation Management

$ARGUMENTS

---

## Sub-commands

### /docs init
Initialize documentation structure:
- `./docs/code-standards.md` — Codebase structure and standards
- `./docs/system-architecture.md` — System architecture
- `./docs/project-roadmap.md` — Project roadmap
- `./docs/design-guidelines.md` — UI/UX design guidelines
- `./docs/deployment-guide.md` — Deployment procedures

### /docs update
- Scan recent git changes: `git log --oneline -20`
- Identify which docs need updating
- Update affected documentation
- Verify accuracy against codebase

### /docs summarize
- Generate `./docs/codebase-summary.md`
- Include file structure, key patterns, dependencies
- Keep concise and developer-friendly

---

## Automatic Update Triggers
Documentation should be updated when:
- Major features are implemented
- System architecture changes
- New API endpoints are added
- Deployment process changes
- Breaking changes occur

---

## Usage Examples
```
/docs init
/docs update
/docs summarize
/docs update the API documentation
```
