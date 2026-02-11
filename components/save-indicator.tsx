"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Save, Cloud, CloudOff, Loader2, Check, HardDrive } from "lucide-react"

type SaveStatus = "idle" | "saving" | "saved" | "error" | "unsaved"

interface SaveIndicatorProps {
  businesses: any[]
  onLoad?: (data: any) => void
}

// Get Supabase config — tries env vars first, falls back to hardcoded
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://doohzrogvbfphqgpurnu.supabase.co"
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  
  // If no key from env, try to find it in the page
  if (!key) {
    // The key needs to be provided — check localStorage for cached config
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("_supabase_key")
      if (cached) return { url, key: cached }
    }
    return null
  }
  return { url, key }
}

async function supabaseFetch(path: string, options: RequestInit = {}) {
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
  } catch { return null }
}

export function SaveIndicator({ businesses, onLoad }: SaveIndicatorProps) {
  const [status, setStatus] = useState<SaveStatus>("idle")
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [supabaseAvailable, setSupabaseAvailable] = useState(false)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyInput, setKeyInput] = useState("")
  const prevDataRef = useRef<string>("")
  const loadedRef = useRef(false)

  useEffect(() => {
    if (businesses.length === 0) return
    const dataStr = JSON.stringify(businesses)
    if (prevDataRef.current && prevDataRef.current !== dataStr) {
      setStatus("unsaved")
    }
    prevDataRef.current = dataStr
  }, [businesses])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadFromCloud()
  }, [])

  const loadFromCloud = useCallback(async () => {
    try {
      const res = await supabaseFetch("/app_state?id=eq.default&select=data,updated_at")
      if (res && res.ok) {
        const rows = await res.json()
        if (rows.length > 0 && rows[0].data?.businesses) {
          setSupabaseAvailable(true)
          onLoad?.(rows[0].data.businesses)
          setLastSaved(rows[0].updated_at || rows[0].data.savedAt)
          setStatus("saved")
          return
        }
        if (rows.length > 0) {
          setSupabaseAvailable(true)
          return
        }
      }
    } catch {}
    setSupabaseAvailable(false)
    setStatus("idle")
  }, [onLoad])

  const saveToCloud = useCallback(async () => {
    if (businesses.length === 0) return
    setStatus("saving")

    // Always save localStorage
    try { localStorage.setItem("businesses", JSON.stringify(businesses)) } catch {}

    // Try Supabase
    try {
      const payload = {
        data: { businesses, savedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }

      const res = await supabaseFetch("/app_state?id=eq.default", {
        method: "PATCH",
        body: JSON.stringify(payload),
      })

      if (res && res.ok) {
        const result = await res.json()
        if (Array.isArray(result) && result.length === 0) {
          // No row — INSERT
          const insertRes = await supabaseFetch("/app_state", {
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
    } catch {}

    // Supabase failed — show saved locally
    setSupabaseAvailable(false)
    setStatus("saved")
    setLastSaved(new Date().toISOString())
    setTimeout(() => setStatus(prev => prev === "saved" ? "idle" : prev), 3000)
  }, [businesses])

  const handleKeySubmit = useCallback(() => {
    if (keyInput.trim()) {
      localStorage.setItem("_supabase_key", keyInput.trim())
      setShowKeyInput(false)
      setKeyInput("")
      // Retry connection
      loadFromCloud()
    }
  }, [keyInput, loadFromCloud])

  const dotColor = {
    idle: "bg-gray-400", saving: "bg-yellow-400 animate-pulse",
    saved: "bg-green-500", error: "bg-red-500", unsaved: "bg-yellow-400",
  }[status]

  const statusText = {
    idle: lastSaved ? `Saved ${new Date(lastSaved).toLocaleTimeString()}` : "Ready",
    saving: "Saving...",
    saved: supabaseAvailable ? "Cloud ✓" : "Local ✓",
    error: "Failed", unsaved: "Unsaved",
  }[status]

  const icon = {
    idle: supabaseAvailable ? <Cloud className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />,
    saving: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    saved: <Check className="h-3.5 w-3.5 text-green-600" />,
    error: <CloudOff className="h-3.5 w-3.5 text-red-500" />,
    unsaved: <Save className="h-3.5 w-3.5 text-yellow-600" />,
  }[status]

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline" size="sm"
        onClick={saveToCloud}
        disabled={status === "saving" || businesses.length === 0}
        className={`h-8 gap-1.5 text-xs transition-all ${
          status === "saved" ? "border-green-300 bg-green-50 text-green-700" :
          status === "unsaved" ? "border-yellow-300 bg-yellow-50 text-yellow-700" :
          status === "error" ? "border-red-300 bg-red-50 text-red-700" : ""
        }`}
      >
        <span className={`h-2 w-2 rounded-full transition-colors duration-500 ${dotColor}`} />
        {icon}
        <span className="hidden sm:inline">{statusText}</span>
      </Button>

      {!supabaseAvailable && status !== "saving" && (
        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
          onClick={() => setShowKeyInput(!showKeyInput)}>
          <Cloud className="h-3 w-3 mr-1" /> Connect
        </Button>
      )}

      {showKeyInput && (
        <div className="flex items-center gap-1">
          <input
            type="password"
            placeholder="Paste Supabase anon key..."
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            className="h-8 text-xs border rounded px-2 w-64"
            onKeyDown={e => e.key === "Enter" && handleKeySubmit()}
          />
          <Button size="sm" className="h-8 text-xs" onClick={handleKeySubmit}>Save</Button>
        </div>
      )}
    </div>
  )
}
