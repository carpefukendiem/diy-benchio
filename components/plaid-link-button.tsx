"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, CreditCard, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PlaidLinkButtonProps {
  onSuccess: (publicToken: string, metadata: any) => void
  isLoading?: boolean
  userId?: string
}

declare global {
  interface Window {
    Plaid: {
      create: (config: any) => {
        open: () => void
        exit: () => void
        destroy: () => void
      }
    }
  }
}

export function PlaidLinkButton({ onSuccess, isLoading, userId = "user_main" }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [plaidReady, setPlaidReady] = useState(false)
  const [linkHandler, setLinkHandler] = useState<any>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const { toast } = useToast()

  // Load Plaid Link script
  useEffect(() => {
    if (document.querySelector('script[src*="plaid.com/link"]')) {
      setPlaidReady(true)
      return
    }

    const script = document.createElement("script")
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js"
    script.async = true
    script.onload = () => {
      console.log("Plaid Link script loaded successfully")
      setPlaidReady(true)
    }
    script.onerror = (error) => {
      console.error("Failed to load Plaid Link script:", error)
      setInitError("Failed to load Plaid Link")
      toast({
        title: "Connection Error",
        description: "Failed to load Plaid Link. Please check your internet connection and try again.",
        variant: "destructive",
      })
    }
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [toast])

  // Create link token
  useEffect(() => {
    if (!plaidReady) return

    const createLinkToken = async () => {
      try {
        console.log("Creating link token for user:", userId)
        const response = await fetch("/api/plaid/create-link-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.details || `HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        console.log("Link token created:", data.link_token)
        setLinkToken(data.link_token)
      } catch (error) {
        console.error("Error creating link token:", error)
        setInitError("Failed to initialize connection")
        toast({
          title: "Initialization Error",
          description: "Failed to initialize Plaid Link. Please check your Plaid configuration.",
          variant: "destructive",
        })
      }
    }

    createLinkToken()
  }, [plaidReady, userId, toast])

  // Initialize Plaid Link when ready
  useEffect(() => {
    if (!plaidReady || !linkToken || !window.Plaid || linkHandler) return

    try {
      console.log("Initializing Plaid Link with token:", linkToken)
      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: (publicToken: string, metadata: any) => {
          console.log("Plaid Link Success:", { publicToken, metadata })
          onSuccess(publicToken, metadata)
          toast({
            title: "Account Connected! 🎉",
            description: `Successfully connected ${metadata.institution?.name || "your account"}`,
          })
        },
        onExit: (err: any, metadata: any) => {
          console.log("Plaid Link Exit:", { err, metadata })
          if (err) {
            console.error("Plaid Link Error:", err)
            toast({
              title: "Connection Failed",
              description: err.display_message || "Failed to connect account. Please try again.",
              variant: "destructive",
            })
          } else {
            // User closed the modal without connecting
            console.log("User exited Plaid Link without connecting")
          }
        },
        onEvent: (eventName: string, metadata: any) => {
          console.log("Plaid Link Event:", eventName, metadata)
        },
        onLoad: () => {
          console.log("Plaid Link loaded successfully")
        },
      })

      setLinkHandler(handler)
      console.log("Plaid Link handler created successfully")
    } catch (error) {
      console.error("Error initializing Plaid Link:", error)
      setInitError("Failed to initialize Plaid Link")
      toast({
        title: "Initialization Error",
        description: "Failed to initialize Plaid Link. Please refresh the page and try again.",
        variant: "destructive",
      })
    }
  }, [plaidReady, linkToken, onSuccess, toast, linkHandler])

  const handlePlaidLink = useCallback(() => {
    if (!linkHandler) {
      console.error("Plaid Link handler not ready")
      toast({
        title: "Not Ready",
        description: "Plaid Link is still initializing. Please wait a moment and try again.",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("Opening Plaid Link")
      linkHandler.open()
    } catch (error) {
      console.error("Error opening Plaid Link:", error)
      toast({
        title: "Connection Error",
        description: "Failed to open Plaid Link. Please try again.",
        variant: "destructive",
      })
    }
  }, [linkHandler, toast])

  if (initError) {
    return (
      <Button variant="destructive" disabled className="w-full">
        <AlertCircle className="mr-2 h-4 w-4" />
        {initError}
      </Button>
    )
  }

  const isReady = plaidReady && linkToken && linkHandler && !isLoading

  return (
    <Button onClick={handlePlaidLink} disabled={!isReady} className="w-full">
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : !plaidReady ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading Plaid...
        </>
      ) : !linkToken ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Initializing...
        </>
      ) : !linkHandler ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Setting up connection...
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          Connect Bank Account
        </>
      )}
    </Button>
  )
}
