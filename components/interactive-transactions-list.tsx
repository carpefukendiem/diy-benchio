"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { EditableCell } from "@/components/editable-cell"
import { RefreshCw, Search, Download, Edit3, FileText } from "lucide-react"
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
  // --- Income ---
  "Sales Revenue",
  "Freelance Income",
  "Interest Income",
  "Other Income",
  "Returns & Allowances",
  "Refunds Given",
  // --- COGS ---
  "Cost of Service",
  // --- Operating Expenses (Schedule C lines 8-27) ---
  "Advertising & Marketing",
  "Soccer Team Sponsorship",
  "Social Media & Online Presence",
  "Contract Labor",
  "Equipment & Depreciation",
  "Computer Equipment Expense",
  "Insurance Expense - Business",
  "Insurance Expense - Auto",
  "Health Insurance",
  "Interest Expense",
  "Bank & ATM Fee Expense",
  "License & Fee Expense",
  "California LLC Fee",
  "Merchant Processing Fees",
  "Merchant Fees Expense",
  "Office Supplies",
  "Office Supply Expense",
  "Office Kitchen Supplies",
  "Phone & Internet Expense",
  "Professional Service Expense",
  "Tax Software & Services",
  "Software & Web Hosting Expense",
  "Rent Expense",
  "Utilities Expense",
  "Business Meals Expense",
  "Travel Expense",
  "Gas & Auto Expense",
  "Parking Expense",
  "Postage & Shipping Expense",
  "Education & Training",
  "Home Office Expense",
  "Eye Care - Business Expense",
  "Client Gifts",
  "Waste & Disposal",
  "SEP-IRA Contribution",
  // --- Non-deductible ---
  "Nondeductible Client Entertainment",
  "Business Treasury Investment",
  "Uncategorized Expense",
  // --- Transfers & Owner ---
  "Owner Draw",
  "Member Drawing - Ruben Ruiz",
  "Member Contribution - Ruben Ruiz",
  "Internal Transfer",
  "Credit Card Payment",
  "Brokerage Transfer",
  "Zelle / Venmo Transfer",
  // --- Personal ---
  "Personal Expense",
  "Personal - Groceries",
  "Personal - Entertainment",
  "Personal - Shopping",
  "Personal - Food & Drink",
  "Personal - Health",
  "Crypto / Investments",
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
      const sl = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm ||
        transaction.description.toLowerCase().includes(sl) ||
        transaction.merchantName?.toLowerCase().includes(sl) ||
        transaction.category?.toLowerCase().includes(sl) ||
        transaction.amount.toString().includes(searchTerm)
      const matchesCategory = categoryFilter === "all" || 
        (categoryFilter === "uncategorized" ? (!transaction.category || transaction.category === "Uncategorized Expense") : transaction.category === categoryFilter)
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
          "Freelance Income",
          "Interest Income",
          "Other Income",
          "Refunds Given",
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
        isIncome: ["Sales Revenue", "Freelance Income", "Interest Income", "Other Income", "Refunds Given", "Member Contribution - Ruben Ruiz"].includes(
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

  const exportToPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" })

      // Title
      doc.setFontSize(16)
      doc.text("Transaction Report", 14, 15)
      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text(`Generated: ${new Date().toLocaleDateString()} | ${filteredTransactions.length} transactions`, 14, 21)
      doc.setTextColor(0)

      // Summary
      const totalIncome = filteredTransactions.filter(t => t.isIncome).reduce((s, t) => s + t.amount, 0)
      const totalExpenses = filteredTransactions.filter(t => !t.isIncome).reduce((s, t) => s + t.amount, 0)
      doc.setFontSize(10)
      doc.text(`Total Income: $${totalIncome.toLocaleString("en", { minimumFractionDigits: 2 })}`, 14, 28)
      doc.text(`Total Expenses: $${totalExpenses.toLocaleString("en", { minimumFractionDigits: 2 })}`, 100, 28)
      doc.text(`Net: $${(totalIncome - totalExpenses).toLocaleString("en", { minimumFractionDigits: 2 })}`, 200, 28)

      // Table
      const tableRows = filteredTransactions.map(t => [
        t.date,
        t.description.length > 40 ? t.description.substring(0, 40) + "..." : t.description,
        t.merchantName || "",
        `$${t.amount.toLocaleString("en", { minimumFractionDigits: 2 })}`,
        t.category,
        t.account,
        t.isIncome ? "Income" : "Expense",
      ])

      autoTable(doc, {
        startY: 33,
        head: [["Date", "Description", "Merchant", "Amount", "Category", "Account", "Type"]],
        body: tableRows,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 65 },
          2: { cellWidth: 40 },
          3: { cellWidth: 25, halign: "right" },
          4: { cellWidth: 40 },
          5: { cellWidth: 30 },
          6: { cellWidth: 18 },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data: any) => {
          if (data.column.index === 6 && data.section === "body") {
            data.cell.styles.textColor = data.cell.raw === "Income" ? [22, 163, 74] : [220, 38, 38]
          }
        },
      })

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text(`DIY Bench.io | Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 7)
      }

      doc.save(`transactions-${new Date().toISOString().split("T")[0]}.pdf`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export to PDF",
        variant: "destructive",
      })
    }
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

  const uncategorizedCount = useMemo(() => {
    return transactions.filter(t => !t.category || t.category === "Uncategorized Expense" || t.category === "").length
  }, [transactions])

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              Live Transaction Editor
              {uncategorizedCount > 0 && (
                <Badge variant="destructive" className="text-xs cursor-pointer" onClick={() => setCategoryFilter("uncategorized")}>
                  {uncategorizedCount} uncategorized
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Click any cell to edit {"\u2022"} Select multiple for bulk actions ({filteredTransactions.length} transactions)
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
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
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
                <SelectItem value="uncategorized">⚠ Uncategorized Only</SelectItem>
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
