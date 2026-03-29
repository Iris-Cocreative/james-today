# CLAUDE.md — james.today

## What this is

A personal project management dashboard hosted on GitHub Pages with Supabase as the backend. Built for James Bolden (Iris Cocreative) to track tasks, time, and projects across client work, personal projects, house projects, and art projects.

**Live at:** james.today
**Repo:** github.com/Iris-Cocreative/james-today/

## Architecture

Static HTML/JS site — no build step, no framework. Two pages plus landing:

```
/index.html        → Landing page (public)
/login.html        → Supabase auth (email/password)
/dashboard.html    → Protected SPA with tab switching (Tasks, Time, Projects)
```

All data lives in Supabase. Auth uses `supabase-js` v2 via CDN. Session is stored in localStorage by the Supabase client. Protection is client-side (JS redirect if no session) — not server-side gating.

### Supabase project

- **URL:** `https://reoliysifzxuzpskywtm.supabase.co`
- **Auth:** Email/password provider, new-style publishable key (`sb_publishable_...`)
- **Secret key:** Never in frontend code. Only for server-side operations.

## Database schema

### Core tables

| Table | Purpose |
|-------|---------|
| `projects` | Client, personal, house, art, internal projects. Has `color`, `image_url`, `budget`, `hourly_rate`. |
| `tasks` | Action items. Optional `project_id` FK. Self-referencing `parent_task_id` for subtasks. |
| `goals` | Higher-level intentions with measurable targets (`target_value`, `current_value`, `unit`). |
| `people` | Contacts, clients, collaborators. Role field: client/collaborator/contact/vendor/other. |
| `time_sessions` | Clock-in/clock-out. Auto-computed `duration_min` (generated column). `is_billable`, `is_invoiced` flags. |

### Junction tables

| Table | Relationship |
|-------|-------------|
| `project_people` | Many-to-many: people ↔ projects with role |
| `goal_projects` | Many-to-many: goals ↔ projects |

### Tags system

| Table | Purpose |
|-------|---------|
| `tags` | Reusable labels with optional `color` |
| `entity_tags` | Polymorphic junction — links a tag to exactly one of: `task_id`, `project_id`, or `goal_id`. Enforced by CHECK constraint. |

### Status pipeline

Six statuses used across tasks and projects, matching the Architecture Map system:

```
idea → planning → scheduled → building → done → integrated
```

| Status | Color | Hex |
|--------|-------|-----|
| Idea | Light Blue | #add8e6 |
| Planning | Gold | #ffd700 |
| Scheduled | Orange | #ffa500 |
| Building | Green | #32cd32 |
| Done | Blue | #1e90ff |
| Integrated | Purple | #9370db |

Projects also support `paused` and `archived` statuses.

### RLS policy

All tables have Row Level Security enabled. Current policy: authenticated users get full read/write access. This is a single-user app — tighten with `user_id` checks when adding multi-user.

### Key conventions

- Deletes are soft — `is_archived = true` rather than hard delete.
- `updated_at` is auto-touched via trigger on people, projects, tasks, goals.
- `completed_at` is set when status changes to `done` or `integrated`.
- Time session `duration_min` is a generated column — never write to it directly.
- `hourly_rate` on a time session overrides the project-level rate.

## Design system

### Visual identity

Dark mode only. Matches the james.today landing page aesthetic:

```css
--bg: #0b0a0f
--bg-raised: #12111a
--text: #e8e4dc
--text-dim: #706b62
--text-bright: #f5f0e6
--accent: #c4956a (warm gold)
--line: rgba(196, 149, 106, 0.2)
```

### Typography

- **Headings / display:** Instrument Serif (400, italic for accents)
- **Body / UI:** DM Sans (300, 400, 500)
- Both loaded from Google Fonts

### UI patterns

- Film grain overlay via SVG noise filter (`body::after`)
- Cards use `rgba(255,255,255,0.025)` background with subtle border
- Status indicated by colored pips (9px circles)
- Modals: dark raised background, animate in with `translateY(12px)` → `0`
- Buttons: outlined by default, fill on hover
- Labels: uppercase, letter-spacing 1.5-2px, small font size (0.6-0.7rem)
- Loading: three-dot pulse animation

### Responsive

- Breakpoint at 600px for mobile
- Timeline columns shrink from 200px to 160px on mobile
- User email hidden on mobile
- Time entry grid collapses from 5 columns to 3

## Dashboard structure

Single HTML file with three tabs:

### Tasks tab
- **List view:** Tasks grouped by project, with quick-add inputs per group
- **Timeline view:** 14-day horizontal scroll with daily columns, Prev/Today/Next navigation
- Status legend chips act as filters (click to toggle)
- Completed tasks show with strikethrough at 50% opacity

### Time tab
- Large serif timer display (turns green when running)
- Project dropdown, description input, billable toggle
- Start/Stop/Discard controls
- Session log with duration, time range, billable badges
- Today's total in header

### Projects tab
- Card grid with status color bar, type badge, cover image, task counts
- Color picker and image URL in edit modal

## Working with this codebase

### Adding a new field to a table
1. Write an `ALTER TABLE` migration SQL
2. Run it in Supabase SQL Editor
3. Update the relevant modal HTML (add input)
4. Update the `openModal` function (populate on edit, reset on new)
5. Update the `save` function (include in payload)
6. Update the `render` function (display on card)

### Adding a new tab
1. Add `<button class="tab-btn" data-tab="newname">` to the tab bar
2. Add `<div class="tab-panel" id="panel-newname">` with content
3. Tab switching is handled by the existing event listener on `.tab-btn`

### Adding a new view to Tasks
1. Add a button to `#taskViewToggle`
2. Add a container div
3. Wire the toggle logic in the view-toggle event listener
4. Write a render function and call it from `renderAll()`

## Related systems

### Architecture Map (Holomovement)
A separate, more complex project management system built for the Holomovement platform. Uses the same 6-status pipeline. Has columnar Map view and weekly Timeline view with drag-and-drop. Uses MembershipCore for auth. Hosted at `lab.iriscocreative.com`. The james.today dashboard borrows its status pipeline and multi-view pattern but is simpler and standalone.

### Iris Portal
Internal project management system for Iris Cocreative, planned for a Supabase rebuild. The james.today dashboard may evolve into or inform this system.

## Migration history

| Migration | What it does |
|-----------|-------------|
| `james-today-schema.sql` | Base schema: all 9 tables, indexes, triggers, RLS |
| `migration-status-pipeline.sql` | Updates task/project statuses to 6-pipeline, adds `color` to projects |
| `migration-project-image.sql` | Adds `image_url` to projects |
