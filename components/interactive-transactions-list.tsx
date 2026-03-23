"use client"

import { useState, useMemo, useEffect } from "react"
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
  onAddTransaction: (transaction: Omit<Transaction, "id">) => Promise<void>
  onRefresh: () => void
  isLoading: boolean
  highlightedTransactionIds?: string[]
}

type SavedAuditView = {
  id: string
  name: string
  searchTerm: string
  categoryFilter: string
  accountFilter: string
  sortBy: "category" | "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "description"
  showChangedOnly: boolean
}

export const CATEGORIES = [
  // --- Income ---
  "Sales Revenue",
  "Service Income",
  "Freelance Income",
  "Interest Income",
  "Other Income",
  "Returns & Allowances",
  "Refunds Given",
  // --- COGS ---
  "Cost of Service",
  "Retail Product Sales COGS",
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
  "Depletion Expense",
  "Employee Benefit Programs Expense",
  "Mortgage Interest Expense",
  "Rent Vehicles & Equipment Expense",
  "Repairs & Maintenance Expense",
  "Supplies Expense",
  "Wages Expense",
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
  // === HAIR STYLIST / SALON PROFESSIONAL ===
  "Booth Rental Expense",
  "Hair Products & Color",
  "Styling Tools & Equipment",
  "Disposable Supplies",
  "Booking & Payment Software",
  "Laundry & Cleaning",
  "Cosmetology License & Permits",
  "Professional Liability Insurance",
  // --- Non-deductible / Capital items ---
  "Nondeductible Client Entertainment",
  "Business Treasury Investment",
  "Crypto Treasury Purchase",
  "Business Loan Proceeds",
  "Loan Repayment - Principal",
  "Loan Interest Expense",
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
  onAddTransaction,
  onRefresh,
  isLoading,
  highlightedTransactionIds = [],
}: InteractiveTransactionsListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [accountFilter, setAccountFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"category" | "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "description">("category")
  const [showChangedOnly, setShowChangedOnly] = useState(false)
  const [savedViews, setSavedViews] = useState<SavedAuditView[]>([])
  const [newViewName, setNewViewName] = useState("")
  const [recurringCategory, setRecurringCategory] = useState("Phone & Internet Expense")
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set())
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null)
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0])
  const [manualDescription, setManualDescription] = useState("")
  const [manualAmount, setManualAmount] = useState("")
  const [manualCategory, setManualCategory] = useState("Phone & Internet Expense")
  const [manualIsIncome, setManualIsIncome] = useState(false)
  const [auditToolkitExpanded, setAuditToolkitExpanded] = useState(false)
  const { toast } = useToast()

  const highlightedSet = useMemo(() => new Set(highlightedTransactionIds), [highlightedTransactionIds])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("transactions.savedAuditViews")
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) setSavedViews(parsed)
    } catch {
      // ignore localStorage parse errors
    }
  }, [])

  const persistViews = (views: SavedAuditView[]) => {
    setSavedViews(views)
    try {
      localStorage.setItem("transactions.savedAuditViews", JSON.stringify(views))
    } catch {
      // ignore localStorage write errors
    }
  }

  const filteredTransactions = useMemo(() => {
    const filtered = transactions.filter((transaction) => {
      const sl = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm ||
        transaction.description.toLowerCase().includes(sl) ||
        transaction.merchantName?.toLowerCase().includes(sl) ||
        transaction.category?.toLowerCase().includes(sl) ||
        transaction.amount.toString().includes(searchTerm)
      const matchesCategory = categoryFilter === "all" || 
        (categoryFilter === "uncategorized" ? (!transaction.category || transaction.category === "Uncategorized Expense") : transaction.category === categoryFilter)
      const matchesAccount = accountFilter === "all" || transaction.account === accountFilter
      const matchesChangedOnly = !showChangedOnly || highlightedSet.has(transaction.id)
      return matchesSearch && matchesCategory && matchesAccount && matchesChangedOnly
    })

    // Keep ordering deterministic so category edits re-position rows immediately.
    return filtered.slice().sort((a, b) => {
      const dateA = Date.parse(a.date || "")
      const dateB = Date.parse(b.date || "")
      const catA = (a.category || "").toLowerCase()
      const catB = (b.category || "").toLowerCase()

      if (sortBy === "category" && catA !== catB) return catA.localeCompare(catB)
      if (sortBy === "date_desc" && Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateB - dateA
      if (sortBy === "date_asc" && Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateA - dateB
      if (sortBy === "amount_desc" && a.amount !== b.amount) return b.amount - a.amount
      if (sortBy === "amount_asc" && a.amount !== b.amount) return a.amount - b.amount
      if (sortBy === "description") return (a.description || "").localeCompare(b.description || "")

      // Stable fallback order
      if (catA !== catB) return catA.localeCompare(catB)
      if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateB - dateA
      if (a.amount !== b.amount) return b.amount - a.amount
      return (a.description || "").localeCompare(b.description || "")
    })
  }, [transactions, searchTerm, categoryFilter, accountFilter, sortBy, showChangedOnly, highlightedSet])

  const accounts = Array.from(new Set(transactions.map((t) => t.account)))
  const defaultAccount = accounts[0] || "Business Checking"
  const [manualAccount, setManualAccount] = useState(defaultAccount)

  const auditYear = useMemo(() => {
    const years = transactions
      .map((t) => Number((t.date || "").slice(0, 4)))
      .filter((y) => Number.isFinite(y) && y > 2000)
    if (years.length === 0) return new Date().getFullYear()
    return years.sort((a, b) => b - a)[0]
  }, [transactions])

  const phoneTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const isYear = (t.date || "").startsWith(String(auditYear))
      if (!isYear) return false
      const dl = (t.description || "").toLowerCase()
      return t.category === "Phone & Internet Expense" || dl.includes("cox") || dl.includes("verizon")
    })
  }, [transactions, auditYear])

  const missingPhoneMonths = useMemo(() => {
    const present = new Set(
      phoneTransactions
        .map((t) => Number((t.date || "").slice(5, 7)))
        .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12)
    )
    const missing: number[] = []
    for (let m = 1; m <= 12; m++) if (!present.has(m)) missing.push(m)
    return missing
  }, [phoneTransactions])

  const cryptoExchangeTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const dl = (t.description || "").toLowerCase()
      return dl.includes("kraken") || dl.includes("coinbase")
    })
  }, [transactions])

  const duplicateGroups = useMemo(() => {
    if (!auditToolkitExpanded) return []
    const groups = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const merchantish = (t.merchantName || t.description || "").toLowerCase().replace(/\s+/g, " ").trim()
      const key = `${t.date}|${Number(t.amount).toFixed(2)}|${merchantish}`
      const arr = groups.get(key) || []
      arr.push(t)
      groups.set(key, arr)
    }
    return Array.from(groups.values())
      .filter((g) => g.length > 1)
      .sort((a, b) => b.length - a.length)
  }, [transactions, auditToolkitExpanded])

  const recurringCoverage = useMemo(() => {
    if (!auditToolkitExpanded) return { count: 0, coveredMonths: 0, missingMonths: [] as number[] }
    const tx = transactions.filter((t) => {
      const isYear = (t.date || "").startsWith(String(auditYear))
      return isYear && (t.category || "") === recurringCategory
    })
    const present = new Set(
      tx.map((t) => Number((t.date || "").slice(5, 7))).filter((m) => Number.isFinite(m) && m >= 1 && m <= 12)
    )
    const missing: number[] = []
    for (let m = 1; m <= 12; m++) if (!present.has(m)) missing.push(m)
    return { count: tx.length, coveredMonths: present.size, missingMonths: missing }
  }, [transactions, auditYear, recurringCategory, auditToolkitExpanded])

  const handleAddManualTransaction = async () => {
    const amount = Number(manualAmount)
    if (!manualDate || !manualDescription.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Missing fields", description: "Date, description, and amount are required.", variant: "destructive" })
      return
    }
    try {
      await onAddTransaction({
        date: manualDate,
        description: manualDescription.trim(),
        amount: Math.abs(amount),
        category: manualCategory,
        account: manualAccount || defaultAccount,
        isIncome: manualIsIncome,
      })
      toast({ title: "Manual transaction added", description: "You can now edit category/account as needed." })
      setManualDescription("")
      setManualAmount("")
      setShowManualForm(false)
    } catch {
      toast({ title: "Error", description: "Failed to add manual transaction", variant: "destructive" })
    }
  }

  const handleMarkCryptoPersonal = async () => {
    if (cryptoExchangeTransactions.length === 0) return
    const updates = cryptoExchangeTransactions.map((t) => ({
      id: t.id,
      updates: { category: "Crypto / Investments", isIncome: false },
    }))
    await onBulkUpdate(updates)
    toast({
      title: "Crypto exchange transactions updated",
      description: `${updates.length} transaction${updates.length === 1 ? "" : "s"} marked as personal/excluded.`,
    })
  }

  const resetFilters = () => {
    setSearchTerm("")
    setCategoryFilter("all")
    setAccountFilter("all")
    setSortBy("category")
    setShowChangedOnly(false)
  }

  const saveCurrentView = () => {
    const name = newViewName.trim()
    if (!name) return
    const view: SavedAuditView = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name,
      searchTerm,
      categoryFilter,
      accountFilter,
      sortBy,
      showChangedOnly,
    }
    persistViews([view, ...savedViews].slice(0, 12))
    setNewViewName("")
    toast({ title: "Audit view saved", description: `"${name}" added.` })
  }

  const applySavedView = (view: SavedAuditView) => {
    setSearchTerm(view.searchTerm)
    setCategoryFilter(view.categoryFilter)
    setAccountFilter(view.accountFilter)
    setSortBy(view.sortBy)
    setShowChangedOnly(view.showChangedOnly)
  }

  const deleteSavedView = (id: string) => {
    persistViews(savedViews.filter((v) => v.id !== id))
  }

  const handleTransactionUpdate = async (transactionId: string, field: keyof Transaction, value: any) => {
    try {
      const updates: Partial<Transaction> = { [field]: value }

      // Auto-detect income vs expense based on category
      if (field === "category") {
        const revenueCategories = [
          "Sales Revenue",
          "Service Income",
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
          <div className="rounded-lg border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-700 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">
                <p className="font-medium">Audit & Quick Fix</p>
                <p className="text-muted-foreground">
                  Phone/Internet in {auditYear}: {phoneTransactions.length} txn across {12 - missingPhoneMonths.length}/12 months
                  {missingPhoneMonths.length > 0 ? ` (missing ${missingPhoneMonths.length})` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowManualForm((v) => !v)}>
                  {showManualForm ? "Hide Manual Add" : "Add Manual Transaction"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAuditToolkitExpanded((v) => !v)}
                  title="Show/hide heavy audit panels"
                >
                  {auditToolkitExpanded ? "Hide details" : "Show details"}
                </Button>
              </div>
            </div>
            {cryptoExchangeTransactions.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{cryptoExchangeTransactions.length} Kraken/Coinbase txn detected</Badge>
                <Button size="sm" variant="secondary" onClick={handleMarkCryptoPersonal}>
                  Mark Kraken/Coinbase as Personal/Excluded
                </Button>
              </div>
            )}
            {missingPhoneMonths.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Missing months (phone/internet): {missingPhoneMonths.map((m) => String(m).padStart(2, "0")).join(", ")}
              </p>
            )}

            {auditToolkitExpanded && (
              <>
                <div className="pt-1 border-t border-amber-200/80 dark:border-amber-800/60">
                  <p className="text-xs font-medium mb-1">Monthly completeness checker</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={recurringCategory} onValueChange={setRecurringCategory}>
                      <SelectTrigger className="w-[250px] h-8">
                        <SelectValue placeholder="Pick category to audit" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="outline">{recurringCoverage.coveredMonths}/12 months covered</Badge>
                    {recurringCoverage.missingMonths.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Missing: {recurringCoverage.missingMonths.map((m) => String(m).padStart(2, "0")).join(", ")}
                      </span>
                    ) : (
                      <span className="text-xs text-green-700 dark:text-green-300">No missing months</span>
                    )}
                  </div>
                </div>

                <div className="pt-1 border-t border-amber-200/80 dark:border-amber-800/60">
                  <p className="text-xs font-medium mb-1">Duplicate detector</p>
                  {duplicateGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No obvious duplicates by date + amount + merchant/description.</p>
                  ) : (
                    <div className="space-y-1">
                      {duplicateGroups.slice(0, 5).map((group, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          {group.length}x — {group[0].date} — ${group[0].amount.toFixed(2)} — {(group[0].merchantName || group[0].description).slice(0, 80)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {showManualForm && (
            <div className="rounded-lg border p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
              <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
              <Input
                placeholder="Description (e.g. Verizon Wireless)"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                className="md:col-span-2"
              />
              <Input type="number" step="0.01" placeholder="Amount" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} />
              <Select value={manualCategory} onValueChange={(v) => { setManualCategory(v); setManualIsIncome(["Sales Revenue","Service Income","Freelance Income","Interest Income","Other Income","Refunds Given","Member Contribution - Ruben Ruiz"].includes(v)) }}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={manualAccount || defaultAccount} onValueChange={setManualAccount}>
                <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                <SelectContent>
                  {accounts.length === 0 ? (
                    <SelectItem value={defaultAccount}>{defaultAccount}</SelectItem>
                  ) : (
                    accounts.map((account) => (
                      <SelectItem key={account} value={account}>{account}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="md:col-span-6 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowManualForm(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddManualTransaction}>Save Manual Transaction</Button>
              </div>
            </div>
          )}

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
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[210px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Sort: Category (A-Z)</SelectItem>
                <SelectItem value="date_desc">Sort: Date (Newest)</SelectItem>
                <SelectItem value="date_asc">Sort: Date (Oldest)</SelectItem>
                <SelectItem value="amount_desc">Sort: Amount (High-Low)</SelectItem>
                <SelectItem value="amount_asc">Sort: Amount (Low-High)</SelectItem>
                <SelectItem value="description">Sort: Description (A-Z)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showChangedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowChangedOnly((v) => !v)}
              disabled={highlightedTransactionIds.length === 0}
              title="Show only recently changed rows (e.g. after Force All)"
            >
              Only Changed
            </Button>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="Save current filters as..."
              className="w-[220px] h-8"
            />
            <Button size="sm" variant="outline" onClick={saveCurrentView} disabled={!newViewName.trim()}>
              Save View
            </Button>
            {savedViews.map((view) => (
              <div key={view.id} className="inline-flex items-center gap-1 rounded border px-2 py-1">
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => applySavedView(view)}>
                  {view.name}
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => deleteSavedView(view.id)}>
                  x
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </p>

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
              } ${highlightedSet.has(transaction.id) ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700" : ""}`}
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
