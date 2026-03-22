"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Camera, Receipt, X, Loader2, CheckCircle, AlertTriangle, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export interface ReceiptData {
  id: string
  businessId: string
  transactionId: string
  fileName: string
  fileUrl: string
  merchantName: string
  amount: number
  date: string
  notes: string
  category?: string
  extractedBy?: "ai" | "heuristic" | "manual"
  extractionConfidence?: number
  processingNote?: string
  includeInLedger?: boolean
  createdAt: string
}

interface ReceiptUploaderProps {
  businessId: string
  receipts: ReceiptData[]
  onReceiptsUpdate: (receipts: ReceiptData[]) => void
}

interface FileProgress {
  fileName: string
  status: "pending" | "uploading" | "done" | "error"
  error?: string
}

async function readUploadErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  const trimmed = text.trim()
  if (!trimmed) {
    if (response.status === 413) return "File too large — try a smaller photo or lower camera resolution."
    return `Request failed (HTTP ${response.status})`
  }
  try {
    const j = JSON.parse(trimmed) as { error?: string }
    if (typeof j.error === "string") return j.error
  } catch {
    /* ignore */
  }
  return trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** Shrink very large JPEG/PNG before upload (Vercel body limits). */
async function compressImageIfNeeded(file: File, maxBytes = 3_500_000): Promise<File> {
  if (file.size <= maxBytes || !file.type.startsWith("image/")) return file
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement("canvas")
      let w = img.naturalWidth
      let h = img.naturalHeight
      const maxDim = 2200
      if (w > maxDim || h > maxDim) {
        const s = Math.min(maxDim / w, maxDim / h)
        w = Math.round(w * s)
        h = Math.round(h * s)
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const out = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" })
          resolve(out.size < file.size ? out : file)
        },
        "image/jpeg",
        0.82,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

export function ReceiptUploader({ businessId, receipts, onReceiptsUpdate }: ReceiptUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([])
  const { toast } = useToast()

  const patchReceipt = useCallback(
    (id: string, patch: Partial<ReceiptData>) => {
      onReceiptsUpdate(receipts.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    },
    [receipts, onReceiptsUpdate],
  )

  const handleBatchSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files
      if (!list || list.length === 0) return

      const files = Array.from(list).filter((f) => {
        const ok =
          f.type.startsWith("image/") ||
          f.type === "application/pdf" ||
          f.name.toLowerCase().endsWith(".pdf")
        if (!ok) {
          toast({ title: "Skipped", description: `${f.name} is not an image or PDF`, variant: "destructive" })
        }
        return ok
      })

      if (files.length === 0) {
        e.target.value = ""
        return
      }

      setIsUploading(true)
      setFileProgress(files.map((f) => ({ fileName: f.name, status: "pending" })))
      await nextFrame()

      toast({
        title: `Uploading ${files.length} receipt${files.length === 1 ? "" : "s"}`,
        description: "Reading images on the server (AI when configured). Keep this tab open.",
      })

      let merged: ReceiptData[] = [...receipts]
      let failCount = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setFileProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: "uploading" } : p)))
        await nextFrame()

        try {
          const toSend = file.type.startsWith("image/") ? await compressImageIfNeeded(file) : file

          const formData = new FormData()
          formData.append("file", toSend, toSend.name)
          formData.append("businessId", businessId)
          formData.append("autoExtract", "true")

          const res = await fetch("/api/receipts", { method: "POST", body: formData })
          if (!res.ok) {
            failCount++
            const msg = await readUploadErrorMessage(res)
            setFileProgress((prev) =>
              prev.map((p, idx) => (idx === i ? { ...p, status: "error", error: msg } : p)),
            )
            continue
          }
          const data = await res.json()
          if (data.success && data.receipt) {
            merged = [...merged, data.receipt as ReceiptData]
            onReceiptsUpdate(merged)
            setFileProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: "done" } : p)))
          } else {
            failCount++
            setFileProgress((prev) =>
              prev.map((p, idx) =>
                idx === i ? { ...p, status: "error", error: data.error || "Unknown error" } : p,
              ),
            )
          }
        } catch (err: unknown) {
          failCount++
          const msg = err instanceof Error ? err.message : "Upload failed"
          setFileProgress((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: "error", error: msg } : p)))
        }
      }

      setIsUploading(false)
      e.target.value = ""

      const doneCount = merged.length - receipts.length
      if (doneCount > 0 || failCount > 0) {
        toast({
          title: doneCount > 0 ? "Receipts processed" : "Some uploads failed",
          description:
            doneCount > 0
              ? `${doneCount} added${failCount > 0 ? ` · ${failCount} failed` : ""}. Verify amounts below.`
              : `${failCount} failed — check file size (try smaller photos) or format.`,
          ...(doneCount === 0 && failCount > 0 ? { variant: "destructive" as const } : {}),
        })
      }
      window.setTimeout(() => setFileProgress([]), 2800)
    },
    [businessId, onReceiptsUpdate, receipts, toast],
  )

  const handleRemove = useCallback(
    (id: string) => {
      onReceiptsUpdate(receipts.filter((r) => r.id !== id))
    },
    [receipts, onReceiptsUpdate],
  )

  const totalCash = receipts.reduce((sum, r) => sum + (r.amount || 0), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Receipt & cash expense images
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Upload many photos or PDFs at once (drag a folder or multi-select). We read totals and merchant names on the
              server when{" "}
              <span className="font-medium text-foreground">ANTHROPIC_API_KEY</span> is set; PDFs use text extraction.
              Approved items sync into your <span className="font-medium">Transactions</span> tab as cash expenses.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shrink-0">
            <Camera className="h-3 w-3 mr-1" />
            {receipts.length} saved
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
          <label className="cursor-pointer flex flex-col items-center gap-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <span className="font-medium">Tap to take a photo or choose multiple files</span>
            <span className="text-sm text-muted-foreground">JPG, PNG, WebP, GIF, or PDF · batch upload supported</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              disabled={isUploading}
              onChange={handleBatchSelect}
            />
          </label>
        </div>

        {fileProgress.length > 0 && (
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
              Processing files
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {fileProgress.map((fp, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                  <span className="truncate flex-1">{fp.fileName}</span>
                  {fp.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  {fp.status === "done" && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                  {fp.status === "error" && <span className="text-xs text-destructive max-w-[55%]">{fp.error}</span>}
                  {fp.status === "pending" && <span className="text-xs text-muted-foreground">Queued</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {receipts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-semibold">Saved receipts</h4>
              <span className="text-sm text-muted-foreground">Cash total: ${totalCash.toFixed(2)}</span>
            </div>
            {receipts.map((r) => (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row gap-3 p-3 border rounded-lg hover:bg-muted/20 transition-colors"
              >
                <div className="shrink-0">
                  {r.fileUrl.startsWith("data:image") ? (
                    <img src={r.fileUrl} alt="" className="w-20 h-20 object-cover rounded border" />
                  ) : (
                    <div className="w-20 h-20 flex items-center justify-center bg-muted rounded border text-xs text-center p-1">
                      PDF
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.extractedBy === "ai" && (
                      <Badge variant="secondary" className="text-xs">
                        AI read
                      </Badge>
                    )}
                    {r.extractedBy === "heuristic" && (
                      <Badge variant="secondary" className="text-xs">
                        PDF text
                      </Badge>
                    )}
                    {r.extractedBy === "manual" && (
                      <Badge variant="outline" className="text-xs">
                        Manual
                      </Badge>
                    )}
                    {typeof r.extractionConfidence === "number" && (
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(r.extractionConfidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Merchant</Label>
                      <Input
                        className="h-8 text-sm"
                        value={r.merchantName}
                        onChange={(e) => patchReceipt(r.id, { merchantName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Amount ($)</Label>
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        step="0.01"
                        value={r.amount || ""}
                        onChange={(e) => patchReceipt(r.id, { amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Date</Label>
                      <Input
                        className="h-8 text-sm"
                        type="date"
                        value={r.date?.slice(0, 10) || ""}
                        onChange={(e) => patchReceipt(r.id, { date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Category (tax)</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="e.g. Office Supplies"
                        value={r.category || ""}
                        onChange={(e) => patchReceipt(r.id, { category: e.target.value })}
                      />
                    </div>
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                  {r.processingNote && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      {r.processingNote}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id={`ledger-${r.id}`}
                      checked={r.includeInLedger !== false}
                      onCheckedChange={(c) => patchReceipt(r.id, { includeInLedger: c === true })}
                    />
                    <label htmlFor={`ledger-${r.id}`} className="text-xs text-muted-foreground cursor-pointer">
                      Include in Transactions tab (tax ledger)
                    </label>
                  </div>
                </div>
                <div className="flex sm:flex-col items-end gap-2">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemove(r.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
