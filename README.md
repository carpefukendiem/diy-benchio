# DIY Books — Tax-Optimized Bookkeeping

Free Bench.io alternative for California self-employed businesses. AI-powered transaction categorization mapped to Schedule C.

## New in v2.0 (Engine Files)

Added backend engines that integrate with the existing v0 UI:

- `lib/parsers/wellsfargo-pdf.ts` — Parses Wells Fargo PDF statements
- `lib/parsers/csv-parser.ts` — Generic CSV parser
- `lib/categorization/rules-engine.ts` — 80+ pre-built rules for your vendors
- `lib/categorization/ai-engine.ts` — Claude AI fallback for unknowns
- `lib/tax/calculator.ts` — Schedule C + SE tax calculator
- `lib/supabase/` — Database client setup
- `app/api/upload/route.ts` — PDF/CSV processing API endpoint
- `types/index.ts` — TypeScript type definitions
- `scripts/supabase-complete-setup.sql` — One-file database setup

## Supabase Setup

1. Create project at supabase.com
2. SQL Editor → paste `scripts/supabase-complete-setup.sql` → Run
3. Copy URL + keys to `.env.local`

## Deploy

\`\`\`bash
cp .env.local.example .env.local  # Fill in your keys
pnpm install
pnpm dev
\`\`\`

## Disclaimer
For bookkeeping purposes only. Consult a CPA before filing.
