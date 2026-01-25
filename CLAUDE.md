# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Reference AGENTS.md for additional instructions.

## Commands

```bash
npm run dev         # Start dev server (http://localhost:3000)
npm run build       # Production build
npm run lint        # Run ESLint
npm run init-db     # Initialize SQLite database with migrations
```

No testing framework is currently configured.

## Architecture

**Stack:** Next.js 14 (App Router), React 18, TypeScript, SQLite (better-sqlite3), Tailwind CSS v4, Radix UI

### Directory Structure

- `/app` - Next.js App Router pages and API routes
  - `/api/*` - 22+ RESTful API endpoints (route handlers)
  - `/cash`, `/cashflow`, `/portfolio`, `/spending`, `/settings` - Feature pages
- `/components` - React components organized by feature
  - `/ui` - Radix UI wrapper components (button, card, dialog, etc.)
  - `/layout` - Sidebar, page container
- `/lib` - Core utilities and business logic
  - `/db` - SQLite connection and migrations
  - `/services` - Business logic (cash-health, rebalancing, returns, spending-analysis, rsu-advisor)
  - `/types` - TypeScript type definitions
  - `/csv` - CSV parsing utilities
- `/scripts` - Database initialization script
- `/data` - SQLite database files (gitignored)

### Key Patterns

**Database Access:**

```typescript
import { getDb } from '@/lib/db'
const db = getDb()
const result = db.prepare('SELECT...').all()
```

**API Routes:** All use Next.js route handlers at `/app/api/[resource]/route.ts` returning JSON.

**Client Components:** Marked with `'use client'`, fetch data from `/api/*` endpoints.

**Styling:** Tailwind utility classes with CSS variable-based theming (dark mode default). Theme stored in localStorage key `'theme'`.

**Financial Calculations:** Use `decimal.js` for precise money calculations.

### Database

SQLite with WAL mode and foreign keys enabled. Migrations in `/lib/db/migrations/`. Key tables: accounts, holdings, securities, asset_classes, account_types, cash_balances, credit_card_spending, cash_flows, fixed_expenses.

### Configuration

- `next.config.js` - Marks better-sqlite3 as server external package
- Path alias `@/*` maps to project root

## Task Management

**Use Beads exclusively** for all task tracking. Do NOT use TodoWrite or TaskCreate tools.

```bash
bd ready              # Find available work
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id>
bd sync               # Sync at session end
```
