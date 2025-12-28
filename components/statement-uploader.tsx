"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, FileText, CheckCircle, XCircle, Calendar, X } from "lucide-react"
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

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function StatementUploader({ onStatementsUpdate, existingStatements, onContinue }: StatementUploaderProps) {
  const [accountName, setAccountName] = useState("")
  const [accountType, setAccountType] = useState<"bank" | "credit_card">("bank")
  const [isUploading, setIsUploading] = useState(false)
  const [savedAccountNames, setSavedAccountNames] = useState<string[]>([])
  const [isComboboxOpen, setIsComboboxOpen] = useState(false)
  const [pendingReview, setPendingReview] = useState<{
    transactions: any[]
    accountName: string
    accountType: "bank" | "credit_card"
    files: Array<{ fileName: string; month: string; year: string; transactions: any[] }>
  } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const saved = localStorage.getItem("savedAccountNames")
    if (saved) {
      try {
        setSavedAccountNames(JSON.parse(saved))
      } catch (error) {
        console.error("[v0] Error loading saved account names:", error)
      }
    }
  }, [])

  const saveAccountName = (name: string) => {
    if (name && !savedAccountNames.includes(name)) {
      const updatedNames = [...savedAccountNames, name]
      setSavedAccountNames(updatedNames)
      localStorage.setItem("savedAccountNames", JSON.stringify(updatedNames))
    }
  }

  const removeAccountName = (name: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const updatedNames = savedAccountNames.filter((n) => n !== name)
    setSavedAccountNames(updatedNames)
    localStorage.setItem("savedAccountNames", JSON.stringify(updatedNames))
    toast({
      title: "Account Name Removed",
      description: `"${name}" has been removed from saved account names`,
    })
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (!accountName) {
      toast({
        title: "Missing Information",
        description: "Please enter an account name before uploading",
        variant: "destructive",
      })
      return
    }

    console.log(`[v0] Starting bulk upload of ${files.length} files for account: ${accountName}`)
    setIsUploading(true)

    try {
      saveAccountName(accountName)

      const processedFiles: Array<{
        fileName: string
        month: string
        year: string
        transactions: any[]
        success: boolean
      }> = []
      let allTransactions: any[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        console.log(`[v0] Processing file ${i + 1}/${files.length}: ${file.name}`)

        const formData = new FormData()
        formData.append("file", file)
        formData.append("accountName", accountName)
        formData.append("accountType", accountType)

        try {
          const response = await fetch("/api/statements/upload", {
            method: "POST",
            body: formData,
          })

          console.log(`[v0] Upload response status for ${file.name}:`, response.status)

          if (response.ok) {
            const data = await response.json()
            console.log(`[v0] Upload response data for ${file.name}:`, data)

            if (data.transactions && data.transactions.length > 0) {
              processedFiles.push({
                fileName: file.name,
                month: data.month || "Unknown",
                year: data.year || "2025",
                transactions: data.transactions,
                success: true,
              })
              allTransactions = allTransactions.concat(data.transactions)
            } else {
              console.warn(`[v0] No transactions found in ${file.name}`)
              processedFiles.push({
                fileName: file.name,
                month: "Error",
                year: "Error",
                transactions: [],
                success: false,
              })
            }
          } else {
            const errorText = await response.text()
            console.error(`[v0] Failed to process ${file.name}. Status: ${response.status}, Error:`, errorText)
            processedFiles.push({
              fileName: file.name,
              month: "Error",
              year: "Error",
              transactions: [],
              success: false,
            })
          }
        } catch (error) {
          console.error(`[v0] Error processing ${file.name}:`, error)
          processedFiles.push({
            fileName: file.name,
            month: "Error",
            year: "Error",
            transactions: [],
            success: false,
          })
        }
      }

      console.log(`[v0] Bulk upload complete. Total transactions extracted: ${allTransactions.length}`)
      console.log(`[v0] All transactions:`, allTransactions)

      const successCount = processedFiles.filter((f) => f.success).length
      const failedCount = processedFiles.filter((f) => !f.success).length

      if (allTransactions.length > 0) {
        console.log(`[v0] Setting pendingReview with ${allTransactions.length} transactions`)
        setPendingReview({
          transactions: allTransactions,
          accountName,
          accountType,
          files: processedFiles.filter((f) => f.success),
        })

        toast({
          title: "Files Processed Successfully",
          description: `${successCount} file(s) uploaded. Review ${allTransactions.length} transactions before importing.`,
        })
      } else {
        console.error(`[v0] No transactions extracted from ${files.length} files`)
        toast({
          title: "No Transactions Found",
          description: `Unable to extract transactions from uploaded files. ${successCount} succeeded, ${failedCount} failed. Check browser console.`,
          variant: "destructive",
        })
      }

      event.target.value = ""
    } catch (error) {
      console.error("[v0] Bulk upload error:", error)
      toast({
        title: "Upload Error",
        description: "An error occurred during upload. Check browser console for details.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleApproveTransactions = (transactions: any[]) => {
    if (!pendingReview) return

    const statementsByMonth = new Map<string, any[]>()

    transactions.forEach((transaction) => {
      const key = `${transaction.date.substring(0, 7)}` // YYYY-MM format
      if (!statementsByMonth.has(key)) {
        statementsByMonth.set(key, [])
      }
      statementsByMonth.get(key)!.push(transaction)
    })

    const newStatements: UploadedStatement[] = Array.from(statementsByMonth.entries()).map(([yearMonth, txns]) => {
      const [year, monthNum] = yearMonth.split("-")
      const month = MONTHS[Number.parseInt(monthNum) - 1] || "Unknown"

      return {
        id: `${pendingReview.accountName}-${year}-${month}-${Date.now()}`,
        accountName: pendingReview.accountName,
        accountType: pendingReview.accountType,
        month,
        year,
        fileName: `${pendingReview.files.length} files`,
        uploadDate: new Date().toISOString(),
        transactions: txns,
        status: "processed" as const,
      }
    })

    onStatementsUpdate([...existingStatements, ...newStatements])

    toast({
      title: "Statements Imported",
      description: `${newStatements.length} months with ${transactions.length} total transactions imported`,
    })

    setPendingReview(null)
    setAccountName("")
  }

  const handleCancelReview = () => {
    setPendingReview(null)
    toast({
      title: "Import Cancelled",
      description: "Statements were not imported",
    })
  }

  const handleDeleteStatement = (id: string) => {
    const updatedStatements = existingStatements.filter((statement) => statement.id !== id)
    onStatementsUpdate(updatedStatements)
    toast({
      title: "Statement Deleted",
      description: "The selected statement has been deleted",
    })
  }

  const statementsByAccount = existingStatements.reduce(
    (acc, statement) => {
      if (!acc[statement.accountName]) {
        acc[statement.accountName] = []
      }
      acc[statement.accountName].push(statement)
      return acc
    },
    {} as Record<string, UploadedStatement[]>,
  )

  const getMonthsCoverage = () => {
    const monthsSet = new Set(existingStatements.map((s) => `${s.year}-${s.month}`))
    return `${monthsSet.size} of 12 months uploaded`
  }

  if (pendingReview) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Review Uploaded Files</CardTitle>
            <CardDescription>
              {pendingReview.files.length} files processed for {pendingReview.accountName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {pendingReview.files.map((file, idx) => (
                <div key={idx} className="p-2 border rounded text-xs">
                  <div className="font-medium truncate" title={file.fileName}>
                    {file.fileName}
                  </div>
                  <div className="text-muted-foreground">
                    {file.month} {file.year}
                  </div>
                  <div className="text-muted-foreground">{file.transactions.length} txns</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <TransactionReview
          transactions={pendingReview.transactions}
          accountName={pendingReview.accountName}
          month={`${pendingReview.files.length} months`}
          year=""
          fileName={`${pendingReview.files.length} files`}
          onApprove={handleApproveTransactions}
          onCancel={handleCancelReview}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>Upload All Statements for One Account</CardTitle>
          <CardDescription>
            Enter account details once, then select all 12 monthly statements at once. The system will automatically
            detect dates from the files.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name</Label>
                <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isComboboxOpen}
                      className="w-full justify-between font-normal bg-transparent"
                    >
                      {accountName || "e.g., Wells Fargo Business Checking"}
                      <span className="ml-2 h-4 w-4 shrink-0 opacity-50">▼</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Type account name..."
                        value={accountName}
                        onValueChange={setAccountName}
                      />
                      <CommandList>
                        {savedAccountNames.length === 0 ? (
                          <CommandEmpty>Type a new account name</CommandEmpty>
                        ) : (
                          <>
                            <CommandEmpty>No saved accounts found. Type to add new.</CommandEmpty>
                            <CommandGroup heading="Saved Account Names">
                              {savedAccountNames.map((name) => (
                                <CommandItem
                                  key={name}
                                  value={name}
                                  onSelect={() => {
                                    setAccountName(name)
                                    setIsComboboxOpen(false)
                                  }}
                                  className="flex items-center justify-between"
                                >
                                  <span>{name}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={(e) => removeAccountName(name, e)}
                                  >
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
                <Label htmlFor="accountType">Account Type</Label>
                <Select value={accountType} onValueChange={(v) => setAccountType(v as any)}>
                  <SelectTrigger id="accountType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Select All Monthly Statements</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.csv"
                  multiple
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="cursor-pointer"
                />
                {isUploading ? (
                  <div className="mt-4">
                    <Badge variant="outline" className="animate-pulse">
                      Processing files...
                    </Badge>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p className="font-medium">Click to select files or drag and drop</p>
                    <p className="text-xs mt-2">Select all 12 months at once. Supports PDF and CSV formats.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Pro tip:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Download all 12 monthly statements from your bank first</li>
                <li>Select all files at once (Cmd/Ctrl + A) for this account</li>
                <li>The system will automatically extract dates from each statement</li>
                <li>Repeat this process for each additional account</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Continue Button */}
      {existingStatements.length > 0 && onContinue && (
        <div className="flex justify-end">
          <Button onClick={onContinue} size="lg" className="gap-2">
            Continue to Transaction Processing
            <span>→</span>
          </Button>
        </div>
      )}

      {/* Coverage Summary */}
      {existingStatements.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Coverage Summary</CardTitle>
                <CardDescription>{getMonthsCoverage()}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{existingStatements.length} statements uploaded</span>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Statements by Account */}
      {Object.keys(statementsByAccount).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Statements</CardTitle>
            <CardDescription>Manage your uploaded bank and credit card statements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(statementsByAccount).map(([accountName, statements]) => (
                <div key={accountName} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{accountName}</h3>
                    <Badge variant="outline">{statements[0].accountType === "bank" ? "Bank" : "Credit Card"}</Badge>
                    <Badge>
                      {statements.length} {statements.length === 1 ? "month" : "months"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {statements.map((statement) => (
                      <div
                        key={statement.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">
                              {statement.month} {statement.year}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {statement.transactions.length} transactions
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {statement.status === "processed" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteStatement(statement.id)}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {existingStatements.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Statements Uploaded</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start by uploading your first bank statement to begin tracking your finances.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
