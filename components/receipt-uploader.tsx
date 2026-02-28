"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Camera, Receipt, Upload, X, Plus, CheckCircle, Loader2, Image } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ReceiptData {
  id: string
  businessId: string
  transactionId: string
  fileName: string
  fileUrl: string
  merchantName: string
  amount: number
  date: string
  notes: string
  createdAt: string
}

interface ReceiptUploaderProps {
  businessId: string
  receipts: ReceiptData[]
  onReceiptsUpdate: (receipts: ReceiptData[]) => void
}

export function ReceiptUploader({ businessId, receipts, onReceiptsUpdate }: ReceiptUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [merchantName, setMerchantName] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const { toast } = useToast()

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please upload an image or PDF of the receipt", variant: "destructive" })
      return
    }

    setSelectedFile(file)
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }
    setShowForm(true)
  }, [toast])

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("businessId", businessId)
      formData.append("merchantName", merchantName)
      formData.append("amount", amount)
      formData.append("date", date)
      formData.append("notes", notes)

      const res = await fetch("/api/receipts", { method: "POST", body: formData })
      const data = await res.json()

      if (data.success) {
        onReceiptsUpdate([...receipts, data.receipt])
        toast({ title: "Receipt Added", description: `$${amount || "0"} — ${merchantName || selectedFile.name}` })
        // Reset
        setShowForm(false)
        setSelectedFile(null)
        setPreviewUrl(null)
        setMerchantName("")
        setAmount("")
        setNotes("")
        setDate(new Date().toISOString().split("T")[0])
      } else {
        toast({ title: "Upload Failed", description: data.error, variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }, [selectedFile, businessId, merchantName, amount, date, notes, receipts, onReceiptsUpdate, toast])

  const handleRemove = useCallback((id: string) => {
    onReceiptsUpdate(receipts.filter(r => r.id !== id))
  }, [receipts, onReceiptsUpdate])

  const totalCash = receipts.reduce((sum, r) => sum + (r.amount || 0), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Cash Receipt Uploader
            </CardTitle>
            <CardDescription>
              Upload photos of receipts for cash transactions. {receipts.length > 0 && `${receipts.length} receipts totaling $${totalCash.toFixed(2)}`}
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Camera className="h-3 w-3 mr-1" />
            {receipts.length} Receipts
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload area */}
        {!showForm ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="p-3 bg-primary/10 rounded-full">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <span className="font-medium">Tap to take photo or upload receipt</span>
              <span className="text-sm">Supports JPG, PNG, PDF</span>
            </div>
            <input
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        ) : (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
            {/* Preview */}
            {previewUrl && (
              <div className="relative">
                <img src={previewUrl} alt="Receipt preview" className="w-full max-h-48 object-contain rounded-lg border" />
                <button
                  onClick={() => { setShowForm(false); setSelectedFile(null); setPreviewUrl(null) }}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {!previewUrl && selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <Receipt className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium">{selectedFile.name}</span>
                <button onClick={() => { setShowForm(false); setSelectedFile(null) }} className="ml-auto">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Form fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Merchant / Vendor</Label>
                <Input
                  placeholder="e.g. Sally Beauty Supply"
                  value={merchantName}
                  onChange={e => setMerchantName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  placeholder="e.g. Hair color supplies"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={isUploading} className="flex-1">
                {isUploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Add Receipt</>
                )}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setSelectedFile(null); setPreviewUrl(null) }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Receipts list */}
        {receipts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Uploaded Receipts</h4>
            {receipts.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                {r.fileUrl.startsWith("data:image") ? (
                  <img src={r.fileUrl} alt="Receipt" className="w-10 h-10 object-cover rounded border" />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center bg-muted rounded border">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.merchantName || r.fileName}</div>
                  <div className="text-xs text-muted-foreground">{r.date} {r.notes && `• ${r.notes}`}</div>
                </div>
                <span className="font-semibold text-sm">${(r.amount || 0).toFixed(2)}</span>
                <button onClick={() => handleRemove(r.id)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
