<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Skill Routing — sudirja-next

**`mnn-skill/` is NOT used in this project.** The workspace-level mnn-skill routing
rules do not apply to work under `sudirja-next/`. Do not read or route tasks through
`../mnn-skill/` when working here.

Instead, all development work in this project MUST go through the following
globally installed skills (in `~/.agents/skills/`). Load the relevant skill with the
`skill` tool before writing code, and follow its instructions.

## Mandatory skills

| # | Skill | Use for |
|---|-------|---------|
| 1 | `nextjs-app-router-patterns` | ANY work on pages, layouts, route handlers, loading/error boundaries, streaming, parallel/intercepting routes, or data fetching under `src/app/`. |
| 2 | `vercel-react-best-practices` | Writing, reviewing, or refactoring ANY React component, client/server boundary, hook, or bundle-affecting change. |
| 3 | `frontend-design` | Building or reshaping any UI — visual direction, typography, layout choices that avoid templated defaults. |
| 4 | `seo-coach` | SEO work on public pages: metadata, Open Graph/Twitter cards, sitemap, robots, structured data, SEO audits. |
| 5 | `database-schema-designer` | Designing or altering database schemas: tables, relations, normalization, indexes, constraints, migrations. |
| 6 | `api-design-principles` | Designing, reviewing, or optimizing API endpoints (route handlers): REST conventions, versioning, pagination, error shape. |
| 7 | `api-and-interface-design` | Defining type contracts, module boundaries, or frontend–backend interfaces. |

## Routing rules

1. **Page/route work** → load `nextjs-app-router-patterns` first; chain
   `vercel-react-best-practices` when components are involved; chain
   `frontend-design` when the UI is new or being reshaped.
2. **Component-only work** → `vercel-react-best-practices` (+ `frontend-design` if visual).
3. **SEO work on public pages** → load `seo-coach`; chain `nextjs-app-router-patterns`
   for metadata API / sitemap / robots implementation.
4. **Database schema work** → load `database-schema-designer` first; chain
   `api-design-principles` when endpoints expose the changed data.
5. **API endpoint work** → load `api-design-principles` first; chain
   `api-and-interface-design` when defining request/response type contracts; chain
   `nextjs-app-router-patterns` for route handler conventions.
6. **Next.js 16 wins on conflict.** These skills target Next 14–15 conventions.
   Wherever they conflict with the bundled Next 16 docs in
   `node_modules/next/dist/docs/`, follow the bundled docs (see the
   nextjs-agent-rules block above) and treat the skill as general guidance.
7. Never skip the skill load "because the change is small" — the skills are
   workflows, not suggestions.
