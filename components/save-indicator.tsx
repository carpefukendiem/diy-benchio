"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Save, Cloud, CloudOff, Loader2, Check } from "lucide-react"

type SaveStatus = "idle" | "saving" | "saved" | "error" | "unsaved"

interface SaveIndicatorProps {
  businesses: any[]
  onLoad?: (data: any) => void
}

export function SaveIndicator({ businesses, onLoad }: SaveIndicatorProps) {
  const [status, setStatus] = useState<SaveStatus>("idle")
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const prevDataRef = useRef<string>("")

  // Track changes
  useEffect(() => {
    if (businesses.length === 0) return
    const dataStr = JSON.stringify(businesses)
    if (prevDataRef.current && prevDataRef.current !== dataStr) {
      setHasUnsavedChanges(true)
      setStatus("unsaved")
    }
    prevDataRef.current = dataStr
  }, [businesses])

  // Auto-load on mount
  useEffect(() => {
    loadFromCloud()
  }, [])

  const loadFromCloud = useCallback(async () => {
    try {
      const res = await fetch("/api/save")
      const data = await res.json()
      if (data.success && data.data?.businesses) {
        onLoad?.(data.data.businesses)
        setLastSaved(data.savedAt || data.data.savedAt)
        setStatus("saved")
        setHasUnsavedChanges(false)
      }
    } catch {
      // Silent fail — localStorage is the fallback
    }
  }, [onLoad])

  const saveToCloud = useCallback(async () => {
    if (businesses.length === 0) return

    setStatus("saving")
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businesses }),
      })
      const data = await res.json()

      if (data.success) {
        setStatus("saved")
        setLastSaved(data.savedAt || new Date().toISOString())
        setHasUnsavedChanges(false)
        // Reset to idle after 3s
        setTimeout(() => setStatus(prev => prev === "saved" ? "idle" : prev), 3000)
      } else {
        setStatus("error")
        setTimeout(() => setStatus("unsaved"), 3000)
      }
    } catch {
      setStatus("error")
      setTimeout(() => setStatus("unsaved"), 3000)
    }
  }, [businesses])

  const dotColor = {
    idle: "bg-gray-400",
    saving: "bg-yellow-400 animate-pulse",
    saved: "bg-green-500",
    error: "bg-red-500",
    unsaved: "bg-yellow-400",
  }[status]

  const statusText = {
    idle: lastSaved ? `Last saved ${new Date(lastSaved).toLocaleTimeString()}` : "Not saved",
    saving: "Saving...",
    saved: "Saved to cloud",
    error: "Save failed",
    unsaved: "Unsaved changes",
  }[status]

  const icon = {
    idle: <Cloud className="h-4 w-4" />,
    saving: <Loader2 className="h-4 w-4 animate-spin" />,
    saved: <Check className="h-4 w-4 text-green-600" />,
    error: <CloudOff className="h-4 w-4 text-red-500" />,
    unsaved: <Save className="h-4 w-4 text-yellow-600" />,
  }[status]

  return (
    <div className="flex items-center gap-2">
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
    </div>
  )
}
