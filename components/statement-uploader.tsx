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
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedYear, setSelectedYear] = useState("2025")
  const [isUploading, setIsUploading] = useState(false)
  const [savedAccountNames, setSavedAccountNames] = useState<string[]>([])
  const [isComboboxOpen, setIsComboboxOpen] = useState(false)
  const [pendingReview, setPendingReview] = useState<{
    transactions: any[]
    accountName: string
    accountType: "bank" | "credit_card"
    month: string
    year: string
    fileName: string
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
    const file = event.target.files?.[0]
    if (!file || !accountName || !selectedMonth) {
      toast({
        title: "Missing Information",
        description: "Please fill in account name, month, and year before uploading",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)

    try {
      saveAccountName(accountName)

      const formData = new FormData()
      formData.append("file", file)
      formData.append("accountName", accountName)
      formData.append("accountType", accountType)
      formData.append("month", selectedMonth)
      formData.append("year", selectedYear)

      const response = await fetch("/api/statements/upload", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()

        setPendingReview({
          transactions: data.transactions || [],
          accountName,
          accountType,
          month: selectedMonth,
          year: selectedYear,
          fileName: file.name,
        })

        event.target.value = ""
      } else {
        const errorData = await response.json()
        toast({
          title: "Upload Failed",
          description: errorData.error || "Failed to process statement",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Upload error:", error)
      toast({
        title: "Upload Error",
        description: "An error occurred while uploading the statement",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleApproveTransactions = (transactions: any[]) => {
    if (!pendingReview) return

    const newStatement: UploadedStatement = {
      id: `${pendingReview.accountName}-${pendingReview.year}-${pendingReview.month}`,
      accountName: pendingReview.accountName,
      accountType: pendingReview.accountType,
      month: pendingReview.month,
      year: pendingReview.year,
      fileName: pendingReview.fileName,
      uploadDate: new Date().toISOString(),
      transactions,
      status: "processed",
    }

    onStatementsUpdate([...existingStatements, newStatement])

    toast({
      title: "Statement Imported",
      description: `${transactions.length} transactions imported successfully`,
    })

    setPendingReview(null)
    setAccountName("")
    setSelectedMonth("")
  }

  const handleCancelReview = () => {
    setPendingReview(null)
    toast({
      title: "Import Cancelled",
      description: "Statement was not imported",
    })
  }

  const handleDeleteStatement = (statementId: string) => {
    onStatementsUpdate(existingStatements.filter((s) => s.id !== statementId))
    toast({
      title: "Statement Removed",
      description: "Statement has been deleted",
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
      <TransactionReview
        transactions={pendingReview.transactions}
        accountName={pendingReview.accountName}
        month={pendingReview.month}
        year={pendingReview.year}
        fileName={pendingReview.fileName}
        onApprove={handleApproveTransactions}
        onCancel={handleCancelReview}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Bank Statements</CardTitle>
          <CardDescription>
            Upload your monthly statements (PDF or CSV format). You can upload statements incrementally - the app will
            work with whatever you've uploaded so far.
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
                      {accountName || "e.g., Chase Checking, AmEx Business"}
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

              <div className="space-y-2">
                <Label htmlFor="month">Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger id="month">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Statement File</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.csv"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="cursor-pointer"
                />
                {isUploading && <Badge variant="outline">Processing...</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">Supported formats: PDF, CSV</p>
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
