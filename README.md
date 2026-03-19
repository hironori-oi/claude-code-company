# claude-code-company

Claude Code Plugin for AI-powered organization management.

Virtual company structure with CEO, PM, Dev, Research, Marketing, Review, and Web Operations departments that work together to deliver web application projects.

## Quick Install

```bash
# Clone or copy the plugin to your desired location
git clone <repository-url> ~/claude-code-company

# Install the plugin
node ~/claude-code-company/scripts/install.mjs

# Restart Claude Code
```

## Manual Install

Add the plugin path to `~/.claude/settings.json`:

```json
{
  "plugins": {
    "company@local": "/path/to/claude-code-company"
  }
}
```

Then restart Claude Code.

## Uninstall

```bash
node ~/claude-code-company/scripts/install.mjs --remove
```

## Commands

| Command | Department | Purpose |
|---------|-----------|---------|
| `/company:ceo {instruction}` | CEO | Delegate tasks to departments, integrate reports |
| `/company:new-project {details}` | Secretary | Register a new client project |
| `/company:secretary {instruction}` | Secretary | Intake, records, scheduling |
| `/company:pm {instruction}` | PM | Project planning, task management |
| `/company:research {instruction}` | Research | Technology research, analysis |
| `/company:dev {instruction}` | Dev | Architecture, implementation, testing |
| `/company:marketing {instruction}` | Marketing | Proposals, market analysis, pricing |
| `/company:review {instruction}` | Review | Quality assurance, code review |
| `/company:web-ops {instruction}` | Web Ops | Company website, portfolio |
| `/company:status {project-id?}` | - | Show project status |
| `/company:report {weekly\|monthly}` | - | Generate management report |

## Usage Examples

```
# Register a new client project
/company:new-project E-commerce site renewal for Company A. Budget 3M JPY, 3 months.

# CEO delegates research
/company:ceo Start the research phase for PRJ-001

# Technology research
/company:research Investigate the best tech stack for PRJ-001's e-commerce requirements

# Create project plan
/company:pm Create WBS for PRJ-001

# Check all project statuses
/company:status

# Check specific project
/company:status PRJ-001

# Generate weekly report
/company:report weekly
```

## Project Structure

```
claude-code-company/
├── .plugin/plugin.json          # Plugin metadata
├── hooks/
│   ├── hooks.json               # Hook definitions
│   └── inject-org-context.mjs   # Session start context injection
├── skills/                      # Department skills (slash commands)
│   ├── ceo/SKILL.md
│   ├── secretary/SKILL.md
│   ├── pm/SKILL.md
│   ├── research/SKILL.md
│   ├── dev/SKILL.md
│   ├── marketing/SKILL.md
│   ├── review/SKILL.md
│   ├── web-ops/SKILL.md
│   ├── new-project/SKILL.md
│   ├── status/SKILL.md
│   └── report/SKILL.md
├── organization/                # Organization definitions
│   ├── roles/                   # Role definitions per department
│   ├── rules/                   # Organizational rules & policies
│   └── templates/               # Document templates
├── projects/                    # Project tracking data
│   └── COMPANY-WEBSITE/         # Company website project
├── dashboard/                   # Management dashboard
│   ├── active-projects.md
│   ├── pipeline.md
│   └── kpi.md
├── org-context.md               # Context injected at session start
└── scripts/
    └── install.mjs              # Plugin installer
```

## Setup on a New PC

1. Clone this repository
2. Run `node scripts/install.mjs`
3. Restart Claude Code
4. All `/company:*` commands are now available in any project

## Standard Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js (App Router) + TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| DB | Supabase (PostgreSQL) / Neon (free tier) |
| Auth | Supabase Auth |
| Deploy | Vercel (GitHub auto-deploy) |
| Icons | Heroicons |

## License

MIT
