import { type NextRequest, NextResponse } from "next/server"

// Simple save/load using Supabase as backend storage
// No auth required — uses a single "default" row

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return { url, key }
}

async function supabaseFetch(path: string, options: RequestInit = {}) {
  const config = getSupabaseConfig()
  if (!config) return null

  const res = await fetch(`${config.url}/rest/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "apikey": config.key,
      "Authorization": `Bearer ${config.key}`,
      "Prefer": options.method === "PATCH" ? "return=representation" : "return=representation",
      ...((options.headers as Record<string, string>) || {}),
    },
  })
  return res
}

// GET — Load saved state
export async function GET() {
  try {
    const res = await supabaseFetch("/app_state?id=eq.default&select=data,updated_at")
    if (!res || !res.ok) {
      // Supabase not configured or table doesn't exist — return empty
      return NextResponse.json({ success: true, data: null, message: "No saved data (Supabase not configured)" })
    }

    const rows = await res.json()
    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: null, message: "No saved data" })
    }

    return NextResponse.json({
      success: true,
      data: rows[0].data,
      savedAt: rows[0].updated_at,
    })
  } catch (e: any) {
    console.error("[save/load] GET error:", e.message)
    return NextResponse.json({ success: true, data: null, message: "Load failed, using localStorage" })
  }
}

// POST — Save state
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businesses } = body

    if (!businesses) {
      return NextResponse.json({ error: "No data to save" }, { status: 400 })
    }

    const payload = {
      data: { businesses, savedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }

    // Try upsert via PATCH
    const res = await supabaseFetch("/app_state?id=eq.default", {
      method: "PATCH",
      body: JSON.stringify(payload),
    })

    if (!res || !res.ok) {
      // Try INSERT if PATCH fails (row doesn't exist)
      const insertRes = await supabaseFetch("/app_state", {
        method: "POST",
        body: JSON.stringify({ id: "default", ...payload }),
        headers: { "Prefer": "resolution=merge-duplicates" },
      })

      if (!insertRes || !insertRes.ok) {
        console.error("[save] Supabase save failed")
        return NextResponse.json({ success: false, message: "Supabase not configured. Data saved to localStorage only." })
      }
    }

    return NextResponse.json({
      success: true,
      message: "Saved to cloud",
      savedAt: payload.updated_at,
    })
  } catch (e: any) {
    console.error("[save] POST error:", e.message)
    return NextResponse.json({ success: false, message: e.message })
  }
}
