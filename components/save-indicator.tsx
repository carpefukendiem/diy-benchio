"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Save, Cloud, CloudOff, Loader2, Check, HardDrive } from "lucide-react"

type SaveStatus = "idle" | "saving" | "saved" | "error" | "unsaved"

interface SaveIndicatorProps {
  businesses: any[]
  onLoad?: (data: any) => void
}

// Client-side Supabase REST calls (runs in browser — no Vercel network restrictions)
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return { url, key }
}

async function supabaseClientFetch(path: string, options: RequestInit = {}) {
  const config = getSupabaseConfig()
  if (!config) return null

  try {
    const res = await fetch(`${config.url}/rest/v1${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "apikey": config.key,
        "Authorization": `Bearer ${config.key}`,
        "Prefer": "return=representation",
        ...((options.headers as Record<string, string>) || {}),
      },
    })
    return res
  } catch {
    return null
  }
}

export function SaveIndicator({ businesses, onLoad }: SaveIndicatorProps) {
  const [status, setStatus] = useState<SaveStatus>("idle")
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [supabaseAvailable, setSupabaseAvailable] = useState(false)
  const prevDataRef = useRef<string>("")
  const loadedRef = useRef(false)

  // Track changes
  useEffect(() => {
    if (businesses.length === 0) return
    const dataStr = JSON.stringify(businesses)
    if (prevDataRef.current && prevDataRef.current !== dataStr) {
      setStatus("unsaved")
    }
    prevDataRef.current = dataStr
  }, [businesses])

  // Auto-load on mount
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadFromCloud()
  }, [])

  const loadFromCloud = useCallback(async () => {
    const config = getSupabaseConfig()
    if (!config) {
      setSupabaseAvailable(false)
      setStatus("idle")
      return
    }

    try {
      const res = await supabaseClientFetch("/app_state?id=eq.default&select=data,updated_at")
      if (res && res.ok) {
        const rows = await res.json()
        if (rows.length > 0 && rows[0].data?.businesses) {
          setSupabaseAvailable(true)
          onLoad?.(rows[0].data.businesses)
          setLastSaved(rows[0].updated_at || rows[0].data.savedAt)
          setStatus("saved")
          return
        }
        setSupabaseAvailable(true)
        return
      }
    } catch {
      // silent
    }

    setSupabaseAvailable(false)
    setStatus("idle")
  }, [onLoad])

  const saveToCloud = useCallback(async () => {
    if (businesses.length === 0) return
    setStatus("saving")

    // Always save to localStorage (instant, reliable)
    try {
      localStorage.setItem("businesses", JSON.stringify(businesses))
    } catch {}

    // Try Supabase from browser
    const config = getSupabaseConfig()
    if (config) {
      try {
        const payload = {
          data: { businesses, savedAt: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }

        // Try PATCH (update existing row)
        const res = await supabaseClientFetch("/app_state?id=eq.default", {
          method: "PATCH",
          body: JSON.stringify(payload),
        })

        if (res && res.ok) {
          const result = await res.json()
          if (Array.isArray(result) && result.length === 0) {
            // No row existed — INSERT
            const insertRes = await supabaseClientFetch("/app_state", {
              method: "POST",
              body: JSON.stringify({ id: "default", ...payload }),
              headers: { "Prefer": "return=representation,resolution=merge-duplicates" } as any,
            })
            if (insertRes && insertRes.ok) {
              setSupabaseAvailable(true)
              setStatus("saved")
              setLastSaved(new Date().toISOString())
              setTimeout(() => setStatus(prev => prev === "saved" ? "idle" : prev), 3000)
              return
            }
          } else {
            setSupabaseAvailable(true)
            setStatus("saved")
            setLastSaved(new Date().toISOString())
            setTimeout(() => setStatus(prev => prev === "saved" ? "idle" : prev), 3000)
            return
          }
        }
      } catch {
        // Supabase failed
      }
    }

    // Supabase unavailable — localStorage only
    setSupabaseAvailable(false)
    setStatus("saved")
    setLastSaved(new Date().toISOString())
    setTimeout(() => setStatus(prev => prev === "saved" ? "idle" : prev), 3000)
  }, [businesses])

  const dotColor = {
    idle: "bg-gray-400",
    saving: "bg-yellow-400 animate-pulse",
    saved: "bg-green-500",
    error: "bg-red-500",
    unsaved: "bg-yellow-400",
  }[status]

  const statusText = {
    idle: lastSaved ? `Saved ${new Date(lastSaved).toLocaleTimeString()}` : "Ready",
    saving: "Saving...",
    saved: supabaseAvailable ? "Saved to cloud ✓" : "Saved locally ✓",
    error: "Save failed",
    unsaved: "Unsaved changes",
  }[status]

  const icon = {
    idle: supabaseAvailable ? <Cloud className="h-4 w-4" /> : <HardDrive className="h-4 w-4" />,
    saving: <Loader2 className="h-4 w-4 animate-spin" />,
    saved: <Check className="h-4 w-4 text-green-600" />,
    error: <CloudOff className="h-4 w-4 text-red-500" />,
    unsaved: <Save className="h-4 w-4 text-yellow-600" />,
  }[status]

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={saveToCloud}
      disabled={status === "saving" || businesses.length === 0}
      className={`h-8 gap-2 transition-all ${
        status === "saved" ? "border-green-300 bg-green-50 text-green-700" :
        status === "unsaved" ? "border-yellow-300 bg-yellow-50 text-yellow-700" :
        status === "error" ? "border-red-300 bg-red-50 text-red-700" :
        ""
      }`}
    >
      <span className={`h-2 w-2 rounded-full transition-colors duration-500 ${dotColor}`} />
      {icon}
      <span className="text-xs hidden sm:inline">{statusText}</span>
    </Button>
  )
}
