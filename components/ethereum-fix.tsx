"use client"

import { useEffect } from "react"

/**
 * Some browser extensions or injected libraries define `window.ethereum`
 * with `configurable: false`, then other libraries try to redefine it,
 * causing: “Uncaught TypeError: Cannot redefine property: ethereum”.
 *
 * This component runs once on the client, makes the descriptor configurable,
 * and swallows any subsequent re-definition errors.
 */
export function EthereumFix() {
  useEffect(() => {
    if (typeof window === "undefined") return

    const win = window as any
    const desc = Object.getOwnPropertyDescriptor(win, "ethereum")

    if (desc && !desc.configurable) {
      try {
        // Preserve the existing value but make the property re-configurable.
        Object.defineProperty(win, "ethereum", {
          value: desc.value,
          writable: true,
          configurable: true,
          enumerable: desc.enumerable,
        })
      } catch {
        /* no-op – best-effort */
      }
    }

    // Last-chance global handler so the app keeps running even if another
    // script throws the same error before we can patch it.
    const handler = (e: ErrorEvent) => {
      if (e.message?.includes("Cannot redefine property: ethereum")) {
        e.preventDefault()
      }
    }
    window.addEventListener("error", handler)
    return () => window.removeEventListener("error", handler)
  }, [])

  return null
}
