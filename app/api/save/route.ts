import { type NextRequest, NextResponse } from "next/server"

// Actual save/load happens client-side via Supabase JS client
// because Vercel serverless may not have outbound network access
// This route is kept as a stub for backward compat

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Use client-side Supabase for save/load",
    supabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  })
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "Use client-side Supabase for save/load",
  })
}

