# AI Organization Management System

Webアプリ開発組織のAI運営システム。ユーザー（オーナー）がCEOに指示を出し、各部署のAIエージェントが専門的な視点で業務を遂行する。

## Organization Structure

```
Owner (User)
  └── CEO (/company:ceo) - Decision making, delegation
        ├── Secretary (/company:secretary) - Intake, records, scheduling
        ├── PM (/company:pm) - Project planning, task management, progress tracking
        ├── Research (/company:research) - Tech research, competitive analysis, feasibility
        ├── Dev (/company:dev) - Architecture, implementation, testing, deployment
        ├── Marketing (/company:marketing) - Proposals, market analysis, pricing
        ├── Review (/company:review) - Quality assurance, code review, security check
        └── Web Ops (/company:web-ops) - Company website, portfolio, branding
```

## Available Commands

| Command | Purpose |
|---------|---------|
| `/company:ceo {instruction}` | CEO: delegate tasks to departments |
| `/company:new-project {details}` | Register a new client project |
| `/company:secretary {instruction}` | Secretary: intake, records, scheduling |
| `/company:pm {instruction}` | PM: project planning, task management |
| `/company:research {instruction}` | Research: tech investigation, analysis |
| `/company:dev {instruction}` | Dev: architecture, implementation, testing |
| `/company:marketing {instruction}` | Marketing: proposals, market analysis |
| `/company:review {instruction}` | Review: quality assurance, code review |
| `/company:web-ops {instruction}` | Web Ops: company website, portfolio |
| `/company:status {project-id?}` | Show project status (all or specific) |
| `/company:report {type}` | Generate management report (weekly/monthly) |

## Key Rules

### Communication Protocol
- **Top-down**: Owner -> CEO -> Departments
- **Bottom-up**: Departments -> CEO -> Owner (summary)
- Departments never report directly to the Owner
- Cross-department collaboration results must also be reported to CEO

### Project Lifecycle
```
Intake -> Research -> Planning -> Approval -> Design -> Development -> Review -> Delivery
```

### Quality Gates
Each phase transition requires quality gate clearance. Critical checkpoints:
- Intake->Research: Brief complete with all required fields
- Planning->Approval: Proposal + estimate + schedule ready (3-tier pricing)
- Design->Dev: Tech spec reviewed and approved
- Dev->Review: All tests passing
- Review->Delivery: Zero critical issues, security/accessibility checked

### Project Management
- Project ID format: `PRJ-XXX` (sequential)
- All projects tracked in `dashboard/active-projects.md`
- Company website managed as `COMPANY-WEBSITE` project
- Deliverables stored in `projects/{project-id}/`

### Standard Tech Stack
| Category | Technology |
|----------|-----------|
| Framework | Next.js (App Router) + TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Theme | Dark/Light toggle (next-themes) |
| Font | Geist Sans + Geist Mono |
| DB | Supabase (PostgreSQL) / Neon (free tier) |
| Auth | Supabase Auth |
| Storage | Supabase Storage / Vercel Blob |
| Deploy | Vercel (GitHub auto-deploy) |
| AI | AI SDK + OpenAI / Ollama |
| Icons | Heroicons (@heroicons/react) - NO emoji in UI |
| Test | Vitest + Playwright |

### Business Model
- Target: SMB (Small-Medium Business)
- Strengths: Speed, AI utilization, cost performance, flexibility
- Pricing: Project fixed-price or monthly contract
- 3-tier proposals (Basic/Standard/Premium)
- Client communication: Email, bi-weekly progress reports
- Post-delivery warranty: 30 days

### Design Principles
- Clean design without "AI feel"
- Dark/Light mode switching (default: system)
- Neutral colors (zinc) + single accent color
- Mobile-first responsive design
- No emoji in UI - use Heroicons

### Git Workflow (Feature Branch Flow)
- `main` (production) -> Vercel production auto-deploy
- `develop` (integration) -> Vercel preview auto-deploy
- `feature/{name}` / `fix/{name}` -> merge into develop
- `hotfix/{name}` -> merge into main + develop
- Commit format: `{type}: {description}` (feat/fix/docs/style/refactor/test/chore)

## Organization Files

Detailed role definitions, rules, and templates are in the plugin directory:
- Roles: `organization/roles/`
- Rules: `organization/rules/`
- Templates: `organization/templates/`
- Projects: `projects/`
- Dashboard: `dashboard/`
