"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { EditableCell } from "@/components/editable-cell"
import { RefreshCw, Search, Download, Edit3 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  account: string
  isIncome: boolean
  plaidTransactionId?: string
  merchantName?: string
  pending?: boolean
}

interface InteractiveTransactionsListProps {
  transactions: Transaction[]
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  onBulkUpdate: (updates: Array<{ id: string; updates: Partial<Transaction> }>) => Promise<void>
  onRefresh: () => void
  isLoading: boolean
}

const CATEGORIES = [
  "Sales Revenue",
  "Interest Income",
  "Other Income",
  "Returns & Allowances",
  "Cost of Service",
  "Software & Web Hosting Expense",
  "Business Meals Expense",
  "Gas & Auto Expense",
  "Bank & ATM Fee Expense",
  "Insurance Expense - Auto",
  "Insurance Expense - Business",
  "Merchant Fees Expense",
  "Office Supply Expense",
  "Phone & Internet Expense",
  "Professional Service Expense",
  "Rent Expense",
  "Utilities Expense",
  "Member Drawing - Ruben Ruiz",
  "Member Contribution - Ruben Ruiz",
]

export function InteractiveTransactionsList({
  transactions,
  onUpdateTransaction,
  onBulkUpdate,
  onRefresh,
  isLoading,
}: InteractiveTransactionsListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [accountFilter, setAccountFilter] = useState("all")
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set())
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null)
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const { toast } = useToast()

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesSearch =
        transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.merchantName?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = categoryFilter === "all" || transaction.category === categoryFilter
      const matchesAccount = accountFilter === "all" || transaction.account === accountFilter
      return matchesSearch && matchesCategory && matchesAccount
    })
  }, [transactions, searchTerm, categoryFilter, accountFilter])

  const accounts = Array.from(new Set(transactions.map((t) => t.account)))

  const handleTransactionUpdate = async (transactionId: string, field: keyof Transaction, value: any) => {
    try {
      const updates: Partial<Transaction> = { [field]: value }

      // Auto-detect income vs expense based on category
      if (field === "category") {
        const revenueCategories = [
          "Sales Revenue",
          "Interest Income",
          "Other Income",
          "Member Contribution - Ruben Ruiz",
        ]
        updates.isIncome = revenueCategories.includes(value)
      }

      await onUpdateTransaction(transactionId, updates)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update transaction",
        variant: "destructive",
      })
    }
  }

  const handleBulkCategoryUpdate = async (category: string) => {
    if (selectedTransactions.size === 0) return

    const updates = Array.from(selectedTransactions).map((id) => ({
      id,
      updates: {
        category,
        isIncome: ["Sales Revenue", "Interest Income", "Other Income", "Member Contribution - Ruben Ruiz"].includes(
          category,
        ),
      },
    }))

    await onBulkUpdate(updates)
    setSelectedTransactions(new Set())
    setBulkEditMode(false)
  }

  const toggleTransactionSelection = (transactionId: string) => {
    const newSelection = new Set(selectedTransactions)
    if (newSelection.has(transactionId)) {
      newSelection.delete(transactionId)
    } else {
      newSelection.add(transactionId)
    }
    setSelectedTransactions(newSelection)
  }

  const selectAllVisible = () => {
    setSelectedTransactions(new Set(filteredTransactions.map((t) => t.id)))
  }

  const clearSelection = () => {
    setSelectedTransactions(new Set())
    setBulkEditMode(false)
  }

  const exportToCSV = () => {
    const headers = ["Date", "Description", "Merchant", "Amount", "Category", "Account", "Type"]
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map((t) =>
        [
          t.date,
          `"${t.description}"`,
          `"${t.merchantName || ""}"`,
          t.amount,
          `"${t.category}"`,
          `"${t.account}"`,
          t.isIncome ? "Income" : "Expense",
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const exportToExcel = async () => {
    try {
      const response = await fetch("/api/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: filteredTransactions }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `transactions-${new Date().toISOString().split("T")[0]}.xlsx`
        a.click()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export to Excel",
        variant: "destructive",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Live Transaction Editor</CardTitle>
            <CardDescription>
              Click any cell to edit • Select multiple for bulk actions ({filteredTransactions.length} transactions)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Sync
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters and Bulk Actions */}
        <div className="space-y-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions or merchants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account} value={account}>
                    {account}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedTransactions.size > 0 && (
            <div className="flex items-center gap-4 p-3 bg-accent rounded-lg border">
              <span className="text-sm font-medium">{selectedTransactions.size} selected</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={selectAllVisible}>
                  Select All Visible
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection}>
                  Clear Selection
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkEditMode(!bulkEditMode)}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Bulk Edit
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Edit Panel */}
          {bulkEditMode && selectedTransactions.size > 0 && (
            <div className="p-4 bg-muted rounded-lg border">
              <h4 className="font-medium mb-3">Bulk Update Category</h4>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((category) => (
                  <Button
                    key={category}
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkCategoryUpdate(category)}
                    className="text-xs"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Transactions Table */}
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 p-3 bg-muted rounded-lg font-medium text-sm">
            <div className="col-span-1">
              <Checkbox
                checked={selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    selectAllVisible()
                  } else {
                    clearSelection()
                  }
                }}
              />
            </div>
            <div className="col-span-2">Date</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Account</div>
          </div>

          {/* Transaction Rows */}
          {filteredTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className={`grid grid-cols-12 gap-4 p-3 border rounded-lg hover:bg-muted transition-colors ${
                selectedTransactions.has(transaction.id) ? "bg-accent border-border" : ""
              }`}
            >
              <div className="col-span-1 flex items-center">
                <Checkbox
                  checked={selectedTransactions.has(transaction.id)}
                  onCheckedChange={() => toggleTransactionSelection(transaction.id)}
                />
              </div>

              <div className="col-span-2 flex items-center">
                <EditableCell
                  value={transaction.date}
                  type="date"
                  onSave={(value) => handleTransactionUpdate(transaction.id, "date", value)}
                />
              </div>

              <div className="col-span-3 flex items-center">
                <EditableCell
                  value={transaction.description}
                  type="text"
                  onSave={(value) => handleTransactionUpdate(transaction.id, "description", value)}
                />
                {transaction.merchantName && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {transaction.merchantName}
                  </Badge>
                )}
              </div>

              <div className="col-span-2 flex items-center">
                <div className={`font-semibold ${transaction.isIncome ? "text-green-600" : "text-red-600"}`}>
                  {transaction.isIncome ? "+" : "-"}$
                  <EditableCell
                    value={transaction.amount.toString()}
                    type="number"
                    onSave={(value) => handleTransactionUpdate(transaction.id, "amount", Number.parseFloat(value))}
                    className="inline"
                  />
                </div>
              </div>

              <div className="col-span-2 flex items-center">
                <EditableCell
                  value={transaction.category}
                  type="select"
                  options={CATEGORIES}
                  onSave={(value) => handleTransactionUpdate(transaction.id, "category", value)}
                />
              </div>

              <div className="col-span-2 flex items-center">
                <EditableCell
                  value={transaction.account}
                  type="select"
                  options={accounts}
                  onSave={(value) => handleTransactionUpdate(transaction.id, "account", value)}
                />
              </div>
            </div>
          ))}
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No transactions found matching your criteria.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
