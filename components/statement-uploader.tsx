"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, FileText, CheckCircle, XCircle, X, Loader2, ArrowRight, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
interface UploadedStatement {
  id: string
  accountName: string
  accountType: "bank" | "credit_card" | "personal" | "investment"
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

type AccountType = "bank" | "credit_card" | "personal" | "investment"

interface QueuedUploadFile {
  id: string
  file: File
  accountName: string
  accountType: AccountType
}

type CachedStatementFile = {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  lastModified: number
  accountName: string
  accountType: AccountType
  blob: Blob
  addedAt: string
}

const CACHE_DB = "diy-benchio-statement-cache"
const CACHE_STORE = "statementFiles"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/** Parse API error when the body may be JSON, HTML (e.g. 413 from edge), or empty. */
async function readUploadErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  const trimmed = text.trim()
  if (!trimmed) {
    if (response.status === 413) {
      return "File too large for the server. Try CSV export, split files, or upgrade hosting limits (base64 JSON uploads hit limits faster)."
    }
    return `Request failed (HTTP ${response.status})`
  }
  try {
    const j = JSON.parse(trimmed) as { error?: string; message?: string }
    if (typeof j.error === "string") return j.error
    if (typeof j.message === "string") return j.message
  } catch {
    /* non-JSON */
  }
  return trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed
}

/** Let React paint progress before heavy work / network (avoids “frozen” UI on multi-file upload). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function openCacheDb(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function cacheStatementFile(file: File, accountName: string, accountType: AccountType) {
  const db = await openCacheDb()
  const id = `${accountName}|${file.name}|${file.size}|${file.lastModified}`
  const payload: CachedStatementFile = {
    id,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
    lastModified: file.lastModified,
    accountName,
    accountType,
    blob: file,
    addedAt: new Date().toISOString(),
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readwrite")
    tx.objectStore(CACHE_STORE).put(payload)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function getCachedStatementFiles(): Promise<CachedStatementFile[]> {
  const db = await openCacheDb()
  const out = await new Promise<CachedStatementFile[]>((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readonly")
    const req = tx.objectStore(CACHE_STORE).getAll()
    req.onsuccess = () => resolve((req.result || []) as CachedStatementFile[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return out
}

export function StatementUploader({ onStatementsUpdate, existingStatements, onContinue }: StatementUploaderProps) {
  const [accountName, setAccountName] = useState("")
  const [accountType, setAccountType] = useState<AccountType>("bank")
  const [isUploading, setIsUploading] = useState(false)
  const [savedAccountNames, setSavedAccountNames] = useState<string[]>([])
  const [isComboboxOpen, setIsComboboxOpen] = useState(false)
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([])
  const [allParsedTransactions, setAllParsedTransactions] = useState<any[]>([])
  const [queuedFiles, setQueuedFiles] = useState<QueuedUploadFile[]>([])
  const [cachedFileCount, setCachedFileCount] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    const saved = localStorage.getItem("savedAccountNames")
    if (saved) {
      try { setSavedAccountNames(JSON.parse(saved)) } catch {}
    }
  }, [])

  const refreshCachedCount = async () => {
    try {
      const cached = await getCachedStatementFiles()
      setCachedFileCount(cached.length)
    } catch {
      // ignore cache errors
    }
  }

  useEffect(() => {
    void refreshCachedCount()
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

  const buildNewStatements = (
    taggedTransactions: any[],
    filesCount: number,
    accountTypeByAccount: Record<string, AccountType>
  ): UploadedStatement[] => {
    const statementsByMonth = new Map<string, any[]>()
    taggedTransactions.forEach((t) => {
      const key = `${t.account || "Unknown Account"}|${t.date.substring(0, 7)}`
      if (!statementsByMonth.has(key)) statementsByMonth.set(key, [])
      statementsByMonth.get(key)!.push(t)
    })

    return Array.from(statementsByMonth.entries()).map(([ym, txns], idx) => {
      const [txnAccountName, year, monthNum] = ym.split("|")
      return {
        id: `${txnAccountName}-${year}-${MONTHS[parseInt(monthNum) - 1]}-${Date.now()}-${idx}`,
        accountName: txnAccountName,
        accountType: accountTypeByAccount[txnAccountName] || "bank",
        month: MONTHS[parseInt(monthNum) - 1] || "Unknown",
        year,
        fileName: `${filesCount} file${filesCount === 1 ? "" : "s"}`,
        uploadDate: new Date().toISOString(),
        transactions: txns,
        status: "processed" as const,
      }
    })
  }

  /** Merge parsed transactions into app state and advance the wizard. */
  const commitImported = (
    taggedTransactions: any[],
    filesCount: number,
    accountTypeByAccount: Record<string, AccountType>,
    clearFileProgress = true
  ) => {
    const newStatements = buildNewStatements(taggedTransactions, filesCount, accountTypeByAccount)
    onStatementsUpdate([...existingStatements, ...newStatements])
    toast({
      title: "Statements imported",
      description: `${taggedTransactions.length} transactions · ${newStatements.length} month${newStatements.length === 1 ? "" : "s"} · ${filesCount} file${filesCount === 1 ? "" : "s"}`,
    })
    if (clearFileProgress) setFileProgress([])
    setAllParsedTransactions([])
    setAccountName("")
    setQueuedFiles([])
    if (onContinue) setTimeout(() => onContinue(), 500)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (!accountName) {
      toast({ title: "Missing Account Name", description: "Please enter an account name before uploading", variant: "destructive" })
      return
    }

    const filesToQueue: QueuedUploadFile[] = Array.from(files).map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      accountName,
      accountType,
    }))
    setQueuedFiles(filesToQueue)
    const progress: FileProgress[] = filesToQueue.map(f => ({
      fileName: f.file.name, status: "pending" as const, transactionCount: 0,
    }))
    setFileProgress(progress)
    event.target.value = ""
  }

  const updateQueuedFile = (id: string, updates: Partial<Pick<QueuedUploadFile, "accountName" | "accountType">>) => {
    setQueuedFiles(prev => prev.map(q => (q.id === id ? { ...q, ...updates } : q)))
  }

  const processQueuedUpload = async (filesToProcess: QueuedUploadFile[]) => {
    if (filesToProcess.length === 0) return
    if (filesToProcess.some(q => !q.accountName.trim())) {
      toast({ title: "Missing Account Name", description: "Each file must have an account name before upload.", variant: "destructive" })
      return
    }

    setIsUploading(true)
    filesToProcess.forEach(q => saveAccountName(q.accountName))
    setFileProgress(filesToProcess.map(f => ({ fileName: f.file.name, status: "pending", transactionCount: 0 })))

    // =============================================
    // DUPLICATE TRANSACTION DEDUPLICATION (per-account)
    // =============================================
    const existingFileKeys = new Set<string>()
    existingStatements.forEach(s => {
      s.transactions.forEach(t => {
        existingFileKeys.add(`${s.accountName}|${t.date}|${t.description}|${t.amount}`)
      })
    })

    await Promise.all(
      filesToProcess.map(async (q) => {
        try {
          await cacheStatementFile(q.file, q.accountName, q.accountType)
        } catch {
          // non-fatal: upload should still proceed
        }
      }),
    )
    await refreshCachedCount()
    await nextFrame()

    toast({
      title: `Processing ${filesToProcess.length} file${filesToProcess.length === 1 ? "" : "s"}`,
      description: "Uploading to the server (one file at a time). Keep this tab open.",
    })

    const successFiles: Array<{ fileName: string; month: string; year: string; transactions: any[] }> = []
    let allTxns: any[] = []
    const fileErrors: { name: string; message: string }[] = []

    const accountTypeByAccount: Record<string, AccountType> = {}
    filesToProcess.forEach(q => { accountTypeByAccount[q.accountName] = q.accountType })

    for (let i = 0; i < filesToProcess.length; i++) {
      const queued = filesToProcess[i]
      const file = queued.file
      const fileAccountName = queued.accountName
      const fileAccountType = queued.accountType
      setFileProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: "uploading" } : p))
      await nextFrame()

      try {
        const isPDF = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"

        // Multipart upload: raw file bytes (smaller than base64-in-JSON; avoids main-thread freeze from huge btoa loops).
        const formData = new FormData()
        formData.append("file", file, file.name)
        formData.append("fileName", file.name)
        formData.append("isPDF", isPDF ? "true" : "false")
        formData.append("accountName", fileAccountName)
        formData.append("accountType", fileAccountType)

        const response = await fetch("/api/statements/upload", {
          method: "POST",
          body: formData,
        })
        console.log(`[upload] Response for ${file.name}: status=${response.status}`)

        if (response.ok) {
          let data: any
          try {
            const text = await response.text()
            console.log("[upload] Raw response for", file.name, ":", text.substring(0, 500))
            data = JSON.parse(text)
          } catch (parseErr) {
            console.error("[upload] JSON parse failed for", file.name, parseErr)
            setFileProgress(prev => prev.map((p, idx) =>
              idx === i ? { ...p, status: "error", error: "Server returned invalid response" } : p
            ))
            continue
          }

          if (!data) {
            setFileProgress(prev => prev.map((p, idx) =>
              idx === i ? { ...p, status: "error", error: "Empty response from server" } : p
            ))
            continue
          }

          if (data.transactions && Array.isArray(data.transactions) && data.transactions.length > 0) {
            // =============================================
            // DUPLICATE TRANSACTION DEDUPLICATION
            // Remove any transactions that already exist
            // =============================================
            const uniqueTransactions = data.transactions.filter((t: any) => {
              const key = `${fileAccountName}|${t.date}|${t.description}|${t.amount}`
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

            // Add new transactions to the existingFileKeys set so subsequent files in the same batch also get deduped
            uniqueTransactions.forEach((t: any) => {
              existingFileKeys.add(`${fileAccountName}|${t.date}|${t.description}|${t.amount}`)
            })
          } else if (data.error) {
            setFileProgress(prev => prev.map((p, idx) =>
              idx === i ? { ...p, status: "error", error: data.error } : p
            ))
          } else {
            setFileProgress(prev => prev.map((p, idx) =>
              idx === i ? { ...p, status: "error", error: "No transactions found in file" } : p
            ))
          }
        } else {
          const message = await readUploadErrorMessage(response)
          console.warn(`[upload] Error for ${file.name}:`, message)
          fileErrors.push({ name: file.name, message })
          setFileProgress(prev => prev.map((p, idx) =>
            idx === i ? { ...p, status: "error", error: message } : p
          ))
        }
      } catch (error: any) {
        const message = error.message || "Network error"
        fileErrors.push({ name: file.name, message })
        setFileProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: "error", error: message } : p
        ))
      }
    }

    setIsUploading(false)
    setAllParsedTransactions(allTxns)

    if (allTxns.length > 0) {
      // Keep per-file success visible briefly, then clear (commit still runs immediately).
      commitImported(autoTagForAccountType(allTxns, accountTypeByAccount), successFiles.length, accountTypeByAccount, false)
      window.setTimeout(() => setFileProgress([]), 2200)
      if (fileErrors.length > 0) {
        toast({
          title: `${fileErrors.length} file${fileErrors.length === 1 ? "" : "s"} failed`,
          description: fileErrors.slice(0, 4).map((e) => `${e.name}: ${e.message}`).join(" · "),
          variant: "destructive",
        })
      }
    } else if (fileErrors.length > 0) {
      toast({
        title: "Could not import statements",
        description: fileErrors.slice(0, 3).map((e) => `${e.name}: ${e.message}`).join(" · "),
        variant: "destructive",
      })
    }
  }

  const startQueuedUpload = async () => {
    await processQueuedUpload(queuedFiles)
  }

  const handleReparseCachedFiles = async () => {
    try {
      const cached = await getCachedStatementFiles()
      if (cached.length === 0) {
        toast({ title: "No cached files", description: "Upload statements first so they can be re-parsed later." })
        return
      }
      const filesToProcess: QueuedUploadFile[] = cached.map((c, idx) => ({
        id: `cached-${idx}-${c.id}`,
        file: new File([c.blob], c.fileName, { type: c.fileType, lastModified: c.lastModified }),
        accountName: c.accountName,
        accountType: c.accountType,
      }))
      toast({
        title: "Re-running parser",
        description: `Queued ${filesToProcess.length} cached file(s) for re-import.`,
      })
      await processQueuedUpload(filesToProcess)
    } catch {
      toast({ title: "Cache read failed", description: "Could not load cached files for re-parse.", variant: "destructive" })
    }
  }

  const autoTagForAccountType = (txns: any[], accountTypeByAccount: Record<string, AccountType>) => {
    return txns.map((t) => {
      const type = accountTypeByAccount[t.account] || "bank"
      if (type === "personal") {
        return {
          ...t,
          category: "Personal Expense",
          isIncome: false,
          is_personal: true,
          is_transfer: false,
          categorized_by: "import",
          confidence: 1,
        }
      }
      if (type === "investment") {
        return {
          ...t,
          category: "Crypto / Investments",
          isIncome: false,
          is_personal: true,
          is_transfer: false,
          categorized_by: "import",
          confidence: 1,
        }
      }
      return t
    })
  }

  const handleDeleteStatement = (id: string) => {
    onStatementsUpdate(existingStatements.filter((s) => s.id !== id))
    toast({ title: "Statement Deleted" })
  }

  const statementsByAccount = existingStatements.reduce((acc, s) => {
    if (!acc[s.accountName]) acc[s.accountName] = []
    acc[s.accountName].push(s)
    return acc
  }, {} as Record<string, UploadedStatement[]>)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Bank Statements</CardTitle>
          <CardDescription>
            Select your account, then upload all monthly PDF or CSV statements at once. Files are sent directly to the server (no slow browser encoding) and import automatically when parsing succeeds.
          </CardDescription>
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
                    <SelectItem value="bank">Business Bank Account</SelectItem>
                    <SelectItem value="credit_card">Business Credit Card</SelectItem>
                    <SelectItem value="personal">Personal Account (auto-excluded from taxes)</SelectItem>
                    <SelectItem value="investment">Investment / Brokerage (auto-excluded from taxes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <Input type="file" accept=".pdf,.csv" multiple onChange={handleFileUpload} disabled={isUploading} className="cursor-pointer" />
              <p className="mt-3 text-sm text-muted-foreground">Select all 12 months at once (Cmd+A). PDF or CSV.</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{cachedFileCount} cached statement file(s) available for parser re-run</p>
              <Button size="sm" variant="secondary" onClick={handleReparseCachedFiles} disabled={isUploading || cachedFileCount === 0}>
                Re-run parser on cached files
              </Button>
            </div>

            {queuedFiles.length > 0 && !isUploading && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Review file account assignments before upload</p>
                    <p className="text-xs text-muted-foreground">
                      Set account name/type per file to prevent personal and business mixing.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setQueuedFiles([]); setFileProgress([]) }}>
                      Clear Queue
                    </Button>
                    <Button size="sm" onClick={startQueuedUpload}>
                      Start Upload
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {queuedFiles.map((q) => (
                    <div key={q.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center border rounded p-2">
                      <div className="text-sm truncate">{q.file.name}</div>
                      <Input
                        value={q.accountName}
                        onChange={(e) => updateQueuedFile(q.id, { accountName: e.target.value })}
                        placeholder="Account name"
                      />
                      <Select value={q.accountType} onValueChange={(v) => updateQueuedFile(q.id, { accountType: v as AccountType })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank">Business Bank Account</SelectItem>
                          <SelectItem value="credit_card">Business Credit Card</SelectItem>
                          <SelectItem value="personal">Personal Account (auto-excluded from taxes)</SelectItem>
                          <SelectItem value="investment">Investment / Brokerage (auto-excluded from taxes)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            {Object.entries(statementsByAccount).map(([acctName, statements]) => {
              const acctType = statements[0]?.accountType
              const isExcluded = acctType === "personal" || acctType === "investment"
              return (
              <div key={acctName} className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{acctName}</h3>
                  <Badge>{statements.length} months</Badge>
                  {isExcluded && <Badge variant="secondary" className="text-orange-600 border-orange-300 bg-orange-50">Excluded from taxes</Badge>}
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
            )})}
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
