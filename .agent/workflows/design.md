---
description: UI/UX design workflow — from research to implementation with design system compliance
---

# /design - Design & UI Implementation

Think hard to plan & start working on these tasks follow the Development Rules:
<tasks>$ARGUMENTS</tasks>

**IMPORTANT:** Activate `frontend-design` skill.
**IMPORTANT:** Analyze the skills catalog and intelligently activate the skills that are needed for the task during the process.
**Ensure token efficiency while maintaining high quality.**

---

## Workflow

### 1. Research
* Research about design style, trends, fonts, colors, border, spacing, elements' positions, etc.
* Study references from Dribbble, Behance, Awwwards, Mobbin, TheFWA for inspiration.
* Read `./docs/design-guidelines.md` for existing design system patterns.

### 2. Design & Implement
* Apply `frontend-specialist` agent expertise to implement the design step by step.
* If user doesn't specify framework, use the project's existing stack (Vite + React + TypeScript + Tailwind).
* Follow mobile-first approach with responsive breakpoints (320px, 768px, 1024px).
* Ensure WCAG 2.1 AA compliance:
  - Color contrast ratios (4.5:1 normal, 3:1 large text)
  - Touch targets ≥ 44x44px
  - Keyboard navigation
  - `prefers-reduced-motion` support
* Vietnamese font support (Google Fonts with Vietnamese charset: ă, â, đ, ê, ô, ơ, ư).

### 3. Visual Assets
* Use `generate_image` tool to create image assets when needed.
* Always verify generated assets meet quality requirements.
* Use image editing tools for background removal, cropping, resizing as needed.

### 4. Review & Report
* Report back to user with a summary of the changes, ask user to review and approve.
* If user approves, update the `./docs/design-guidelines.md` docs if needed.

---

## Important Design Rules
- **ALWAYS REMEMBER** that you have the skills of a top-tier UI/UX Designer — Dribbble, Behance, Awwwards level quality.
- Create storytelling designs, immersive experiences, micro-interactions, and interactive interfaces.
- No generic SaaS templates without personality.
- No missing hover/focus states.
- No hard-coded colors — use design tokens.
- No placeholder images in production.
- Maintain and update `./docs/design-guidelines.md` with new patterns.

---

## Usage Examples
```
/design landing page for product showcase
/design dark mode toggle for dashboard
/design responsive data table for device list
/design immersive 3D hero section
/design improve the login page UX
```
