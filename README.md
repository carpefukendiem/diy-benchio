# DIY Books — Tax-Optimized Bookkeeping

Free Bench.io alternative built for California self-employed businesses. AI-powered transaction categorization mapped directly to Schedule C line items.

## What's New (v2.0)

### Backend Engines
- **Wells Fargo PDF Parser** (`lib/parsers/wellsfargo-pdf.ts`) — Parses your exact WF Business Checking statement format
- **CSV Parser** (`lib/parsers/csv-parser.ts`) — Handles Wells Fargo, Chase, and generic CSV exports  
- **Rule-Based Categorization** (`lib/categorization/rules-engine.ts`) — 80+ rules pre-built for your vendors
- **Claude AI Categorization** (`lib/categorization/ai-engine.ts`) — Handles unknown transactions via Anthropic API
- **Tax Calculator** (`lib/tax/calculator.ts`) — Schedule C, SE tax, deduction opportunities
- **Supabase Integration** (`lib/supabase/`) — PostgreSQL with Row Level Security

### New Pages
- `/dashboard` — Overview with charts
- `/upload` — Drag-and-drop statement upload
- `/transactions` — Filterable transaction table
- `/reports/tax` — Schedule C breakdown + deduction finder
- `/settings` — Business config, accounts, API keys

### Database
- `scripts/schema.sql` — Full Supabase schema
- `scripts/seed-categories.sql` — 35+ categories mapped to Schedule C

## Quick Start

1. Create a Supabase project → run `scripts/schema.sql` then `scripts/seed-categories.sql`
2. `cp .env.local.example .env.local` and fill in your keys
3. `pnpm install && pnpm dev`
4. Upload your Wells Fargo PDF statements at `/upload`

## Disclaimer
For bookkeeping purposes only. Consult a licensed CPA before filing.
