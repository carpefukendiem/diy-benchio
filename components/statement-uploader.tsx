"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, FileText, CheckCircle, XCircle, Calendar, X, Loader2, ArrowRight, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TransactionReview } from "@/components/transaction-review"

interface UploadedStatement {
  id: string
  accountName: string
  accountType: "bank" | "credit_card"
  month: string
  year: string
  fileName: string
  uploadDate: string
  transactions: any[]
  status: "processed" | "error"
}

interface StatementUploaderProps {
  onStatementsUpdate: (statements: UploadedStatement[]) => void
  existingStatements: UploadedStatement[]
  onContinue?: () => void
}

interface FileProgress {
  fileName: string
  status: "pending" | "uploading" | "parsed" | "error"
  transactionCount: number
  error?: string
  month?: string
  year?: string
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function StatementUploader({ onStatementsUpdate, existingStatements, onContinue }: StatementUploaderProps) {
  const [accountName, setAccountName] = useState("")
  const [accountType, setAccountType] = useState<"bank" | "credit_card">("bank")
  const [isUploading, setIsUploading] = useState(false)
  const [savedAccountNames, setSavedAccountNames] = useState<string[]>([])
  const [isComboboxOpen, setIsComboboxOpen] = useState(false)
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([])
  const [allParsedTransactions, setAllParsedTransactions] = useState<any[]>([])
  const [showReview, setShowReview] = useState(false)
  const [processedFiles, setProcessedFiles] = useState<Array<{ fileName: string; month: string; year: string; transactions: any[] }>>([])
  const { toast } = useToast()

  useEffect(() => {
    const saved = localStorage.getItem("savedAccountNames")
    if (saved) {
      try { setSavedAccountNames(JSON.parse(saved)) } catch {}
    }
  }, [])

  const saveAccountName = (name: string) => {
    if (name && !savedAccountNames.includes(name)) {
      const updated = [...savedAccountNames, name]
      setSavedAccountNames(updated)
      localStorage.setItem("savedAccountNames", JSON.stringify(updated))
    }
  }

  const removeAccountName = (name: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const updated = savedAccountNames.filter((n) => n !== name)
    setSavedAccountNames(updated)
    localStorage.setItem("savedAccountNames", JSON.stringify(updated))
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (!accountName) {
      toast({ title: "Missing Account Name", description: "Please enter an account name before uploading", variant: "destructive" })
      return
    }

    // =============================================
    // DUPLICATE FILE DETECTION
    // Check if any of the selected files were already uploaded
    // =============================================
    const existingFileKeys = new Set<string>()
    existingStatements.forEach(s => {
      // Build keys from existing statement transactions for matching
      s.transactions.forEach(t => {
        existingFileKeys.add(`${t.date}|${t.description}|${t.amount}`)
      })
    })

    // Also track file names already uploaded (stored in localStorage)
    const uploadedFileNames: string[] = JSON.parse(localStorage.getItem("uploadedFileNames") || "[]")
    const skippedFiles: string[] = []
    const filesToProcess: File[] = []

    for (const file of Array.from(files)) {
      const fileKey = `${accountName}::${file.name}::${file.size}`
      if (uploadedFileNames.includes(fileKey)) {
        skippedFiles.push(file.name)
      } else {
        filesToProcess.push(file)
      }
    }

    if (skippedFiles.length > 0 && filesToProcess.length === 0) {
      toast({
        title: "Duplicate Upload Blocked",
        description: `${skippedFiles.join(", ")} ${skippedFiles.length === 1 ? "has" : "have"} already been uploaded to "${accountName}". Delete the existing statement first if you want to re-upload.`,
        variant: "destructive",
      })
      event.target.value = ""
      return
    }

    if (skippedFiles.length > 0) {
      toast({
        title: "Some Files Skipped",
        description: `${skippedFiles.join(", ")} already uploaded. Processing ${filesToProcess.length} new file(s).`,
      })
    }

    if (filesToProcess.length === 0) {
      event.target.value = ""
      return
    }

    setIsUploading(true)
    saveAccountName(accountName)

    const progress: FileProgress[] = filesToProcess.map(f => ({
      fileName: f.name, status: "pending" as const, transactionCount: 0,
    }))
    setFileProgress(progress)

    const successFiles: typeof processedFiles = []
    let allTxns: any[] = []
    const newUploadedFileNames: string[] = []

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i]
      setFileProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: "uploading" } : p))

      try {
        // Read file content on the FRONTEND
        // CSVs: read as text. PDFs: read as base64.
        const isPDF = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"

        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            if (isPDF) {
              // Extract base64 from data URL: "data:application/pdf;base64,XXXX"
              const dataUrl = reader.result as string
              const base64 = dataUrl.split(",")[1] || ""
              resolve(base64)
            } else {
              resolve(reader.result as string)
            }
          }
          reader.onerror = () => reject(new Error("Failed to read file"))
          if (isPDF) {
            reader.readAsDataURL(file)
          } else {
            reader.readAsText(file)
          }
        })

        console.log(`[v0] Read file on frontend: ${file.name}, isPDF=${isPDF}, contentLength=${fileContent.length}`)

        const response = await fetch("/api/statements/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileContent,
            isPDF,
            accountName,
            accountType,
          }),
        })
        console.log(`[v0] Response for ${file.name}: status=${response.status}`)

        if (response.ok) {
          const data = await response.json()
          if (data.transactions && data.transactions.length > 0) {
            // =============================================
            // DUPLICATE TRANSACTION DEDUPLICATION
            // Remove any transactions that already exist
            // =============================================
            const uniqueTransactions = data.transactions.filter((t: any) => {
              const key = `${t.date}|${t.description}|${t.amount}`
              return !existingFileKeys.has(key)
            })

            const dupeCount = data.transactions.length - uniqueTransactions.length

            if (uniqueTransactions.length === 0) {
              setFileProgress(prev => prev.map((p, idx) =>
                idx === i ? { ...p, status: "error", error: `All ${data.transactions.length} transactions already exist (duplicate upload)` } : p
              ))
              continue
            }

            if (dupeCount > 0) {
              toast({
                title: `${dupeCount} Duplicate Transactions Removed`,
                description: `${uniqueTransactions.length} new transactions kept from ${file.name}.`,
              })
            }

            setFileProgress(prev => prev.map((p, idx) =>
              idx === i ? { ...p, status: "parsed", transactionCount: uniqueTransactions.length, month: data.month, year: data.year } : p
            ))
            successFiles.push({ fileName: file.name, month: data.month || "Unknown", year: data.year || "2025", transactions: uniqueTransactions })
            allTxns = allTxns.concat(uniqueTransactions)
            newUploadedFileNames.push(`${accountName}::${file.name}::${file.size}`)

            // Add new transactions to the existingFileKeys set so subsequent files in the same batch also get deduped
            uniqueTransactions.forEach((t: any) => {
              existingFileKeys.add(`${t.date}|${t.description}|${t.amount}`)
            })
          } else {
            setFileProgress(prev => prev.map((p, idx) =>
              idx === i ? { ...p, status: "error", error: "No transactions found" } : p
            ))
          }
        } else {
          const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
          console.log(`[v0] Error for ${file.name}:`, errData)
          setFileProgress(prev => prev.map((p, idx) =>
            idx === i ? { ...p, status: "error", error: errData.error || `Failed (${response.status})` } : p
          ))
        }
      } catch (error: any) {
        setFileProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: "error", error: error.message || "Network error" } : p
        ))
      }
    }

    // Persist uploaded file names to localStorage
    if (newUploadedFileNames.length > 0) {
      const allUploaded = [...uploadedFileNames, ...newUploadedFileNames]
      localStorage.setItem("uploadedFileNames", JSON.stringify(allUploaded))
    }

    setIsUploading(false)
    setAllParsedTransactions(allTxns)
    setProcessedFiles(successFiles)
    event.target.value = ""
  }

  const handleAutoImport = () => {
    if (allParsedTransactions.length === 0) return

    const statementsByMonth = new Map<string, any[]>()
    allParsedTransactions.forEach((t) => {
      const key = t.date.substring(0, 7)
      if (!statementsByMonth.has(key)) statementsByMonth.set(key, [])
      statementsByMonth.get(key)!.push(t)
    })

    const newStatements: UploadedStatement[] = Array.from(statementsByMonth.entries()).map(([ym, txns]) => {
      const [year, monthNum] = ym.split("-")
      return {
        id: `${accountName}-${year}-${MONTHS[parseInt(monthNum) - 1]}-${Date.now()}`,
        accountName, accountType,
        month: MONTHS[parseInt(monthNum) - 1] || "Unknown",
        year,
        fileName: `${processedFiles.length} files`,
        uploadDate: new Date().toISOString(),
        transactions: txns,
        status: "processed" as const,
      }
    })

    onStatementsUpdate([...existingStatements, ...newStatements])
    toast({ title: "Imported!", description: `${allParsedTransactions.length} transactions from ${newStatements.length} months.` })
    setFileProgress([]); setAllParsedTransactions([]); setProcessedFiles([]); setAccountName("")
    if (onContinue) setTimeout(() => onContinue(), 500)
  }

  const handleReviewFirst = () => { setShowReview(true) }

  const handleApproveFromReview = (transactions: any[]) => {
    setShowReview(false)
    const statementsByMonth = new Map<string, any[]>()
    transactions.forEach((t) => {
      const key = t.date.substring(0, 7)
      if (!statementsByMonth.has(key)) statementsByMonth.set(key, [])
      statementsByMonth.get(key)!.push(t)
    })
    const newStatements: UploadedStatement[] = Array.from(statementsByMonth.entries()).map(([ym, txns]) => {
      const [year, monthNum] = ym.split("-")
      return {
        id: `${accountName}-${year}-${MONTHS[parseInt(monthNum) - 1]}-${Date.now()}`,
        accountName, accountType,
        month: MONTHS[parseInt(monthNum) - 1] || "Unknown", year,
        fileName: `${processedFiles.length} files`,
        uploadDate: new Date().toISOString(),
        transactions: txns, status: "processed" as const,
      }
    })
    onStatementsUpdate([...existingStatements, ...newStatements])
    toast({ title: "Imported!", description: `${transactions.length} transactions imported.` })
    setFileProgress([]); setAllParsedTransactions([]); setProcessedFiles([]); setAccountName("")
    if (onContinue) setTimeout(() => onContinue(), 500)
  }

  const handleDeleteStatement = (id: string) => {
    // Find the statement being deleted so we can remove its file tracking
    const deletedStatement = existingStatements.find(s => s.id === id)
    if (deletedStatement) {
      // Remove the file name tracking so re-upload is allowed
      const uploadedFileNames: string[] = JSON.parse(localStorage.getItem("uploadedFileNames") || "[]")
      const prefix = `${deletedStatement.accountName}::`
      const updated = uploadedFileNames.filter(fn => {
        // Remove entries matching this account + statement period
        if (!fn.startsWith(prefix)) return true
        // Keep entries that don't match (conservative — remove all for this account if unclear)
        return false
      })
      // Re-add entries from other still-existing statements for this account
      existingStatements.filter(s => s.id !== id && s.accountName === deletedStatement.accountName).forEach(s => {
        // We don't have the original file info, so we leave tracking clean for remaining statements
      })
      localStorage.setItem("uploadedFileNames", JSON.stringify(updated))
    }
    onStatementsUpdate(existingStatements.filter((s) => s.id !== id))
    toast({ title: "Statement Deleted" })
  }

  const statementsByAccount = existingStatements.reduce((acc, s) => {
    if (!acc[s.accountName]) acc[s.accountName] = []
    acc[s.accountName].push(s)
    return acc
  }, {} as Record<string, UploadedStatement[]>)

  if (showReview && allParsedTransactions.length > 0) {
    return (
      <TransactionReview
        transactions={allParsedTransactions}
        accountName={accountName}
        month={`${processedFiles.length} months`}
        year=""
        fileName={`${processedFiles.length} files`}
        onApprove={handleApproveFromReview}
        onCancel={() => setShowReview(false)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Bank Statements</CardTitle>
          <CardDescription>Select your account, then upload all monthly PDF or CSV statements at once.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal bg-transparent">
                      {accountName || "e.g., Wells Fargo Business Checking"}
                      <span className="ml-2 opacity-50">▼</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Type account name..." value={accountName} onValueChange={setAccountName} />
                      <CommandList>
                        {savedAccountNames.length === 0 ? (
                          <CommandEmpty>Type a new account name</CommandEmpty>
                        ) : (
                          <>
                            <CommandEmpty>Type to add new</CommandEmpty>
                            <CommandGroup heading="Saved">
                              {savedAccountNames.map((name) => (
                                <CommandItem key={name} value={name} onSelect={() => { setAccountName(name); setIsComboboxOpen(false) }} className="flex items-center justify-between">
                                  <span>{name}</span>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => removeAccountName(name, e)}>
                                    <X className="h-3 w-3 text-red-500" />
                                  </Button>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select value={accountType} onValueChange={(v) => setAccountType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <Input type="file" accept=".pdf,.csv" multiple onChange={handleFileUpload} disabled={isUploading} className="cursor-pointer" />
              <p className="mt-3 text-sm text-muted-foreground">Select all 12 months at once (Cmd+A). PDF or CSV.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FILE PROGRESS */}
      {fileProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isUploading && <Loader2 className="h-5 w-5 animate-spin" />}
              Processing {fileProgress.length} Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {fileProgress.map((fp, idx) => (
                <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${
                  fp.status === "parsed" ? "border-green-500/30 bg-green-500/5" :
                  fp.status === "error" ? "border-red-500/30 bg-red-500/5" :
                  fp.status === "uploading" ? "border-blue-500/30 bg-blue-500/5" : ""
                }`}>
                  <div className="flex items-center gap-3">
                    {fp.status === "parsed" && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                    {fp.status === "error" && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                    {fp.status === "uploading" && <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />}
                    {fp.status === "pending" && <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div>
                      <p className="text-sm font-medium">{fp.fileName}</p>
                      {fp.status === "parsed" && <p className="text-xs text-green-600">{fp.transactionCount} transactions · {fp.month} {fp.year}</p>}
                      {fp.status === "error" && <p className="text-xs text-red-600">{fp.error}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* IMPORT BUTTONS */}
            {!isUploading && allParsedTransactions.length > 0 && (
              <div className="mt-6 p-4 rounded-lg border-2 border-primary bg-primary/5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="font-bold text-lg">{allParsedTransactions.length} transactions ready</p>
                    <p className="text-sm text-muted-foreground">
                      {processedFiles.length} statements ·
                      Income: ${allParsedTransactions.filter((t: any) => t.isIncome).reduce((s: number, t: any) => s + t.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ·
                      Expenses: ${allParsedTransactions.filter((t: any) => !t.isIncome).reduce((s: number, t: any) => s + t.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReviewFirst}>Review First</Button>
                    <Button size="lg" onClick={handleAutoImport} className="gap-2 font-bold">
                      Import & Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!isUploading && allParsedTransactions.length === 0 && fileProgress.every(f => f.status !== "pending" && f.status !== "uploading") && (
              <div className="mt-6 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <p className="font-semibold">No transactions extracted</p>
                    <p className="text-sm text-muted-foreground">Make sure these are digital PDFs from Wells Fargo online banking (not scanned). Try CSV format as backup.</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Continue button for already-imported statements */}
      {existingStatements.length > 0 && onContinue && fileProgress.length === 0 && (
        <div className="flex justify-end">
          <Button onClick={onContinue} size="lg" className="gap-2">
            Continue to Transaction Processing <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Existing statements */}
      {Object.keys(statementsByAccount).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Uploaded Statements</CardTitle></CardHeader>
          <CardContent>
            {Object.entries(statementsByAccount).map(([acctName, statements]) => (
              <div key={acctName} className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{acctName}</h3>
                  <Badge>{statements.length} months</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {statements.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{s.month} {s.year}</p>
                          <p className="text-xs text-muted-foreground">{s.transactions.length} txns</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteStatement(s.id)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {existingStatements.length === 0 && fileProgress.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Statements Uploaded</h3>
            <p className="text-muted-foreground text-center">Upload your bank statements above to begin.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
