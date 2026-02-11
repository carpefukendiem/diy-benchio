"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { FileSpreadsheet, FileText, TrendingUp, TrendingDown, ChevronDown, ChevronRight, X, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  account: string
  isIncome: boolean
  merchantName?: string
}

interface InteractiveReportsProps {
  transactions: Transaction[]
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  dateRange: { start: string; end: string }
}

// Schedule C line mapping — IRS accurate
const SCHEDULE_C_LINES: Record<string, { line: string; label: string; deductPct?: number }> = {
  "Sales Revenue": { line: "1", label: "Gross receipts or sales" },
  "Freelance Income": { line: "1", label: "Gross receipts or sales" },
  "Other Income": { line: "6", label: "Other income" },
  "Refunds Given": { line: "2", label: "Returns and allowances" },
  "Advertising & Marketing": { line: "8", label: "Advertising" },
  "Soccer Team Sponsorship": { line: "8", label: "Advertising" },
  "Social Media & Online Presence": { line: "8", label: "Advertising" },
  "Gas & Auto Expense": { line: "9", label: "Car and truck expenses" },
  "Parking Expense": { line: "9", label: "Car and truck expenses" },
  "Merchant Processing Fees": { line: "10", label: "Commissions and fees" },
  "Merchant Fees Expense": { line: "10", label: "Commissions and fees" },
  "Insurance Expense - Business": { line: "15", label: "Insurance (other than health)" },
  "Health Insurance": { line: "15", label: "Insurance / Self-employed health ins deduction" },
  "Bank & ATM Fee Expense": { line: "16b", label: "Interest (other)" },
  "Professional Service Expense": { line: "17", label: "Legal and professional services" },
  "Tax Software & Services": { line: "17", label: "Legal and professional services" },
  "Office Supplies": { line: "18", label: "Office expense" },
  "Office Supply Expense": { line: "18", label: "Office expense" },
  "Office Kitchen Supplies": { line: "18", label: "Office expense" },
  "Software & Web Hosting Expense": { line: "18", label: "Office expense" },
  "Rent Expense": { line: "20b", label: "Rent (other business property)" },
  "Travel Expense": { line: "24a", label: "Travel" },
  "Business Meals Expense": { line: "24b", label: "Meals (50% deductible)", deductPct: 50 },
  "Phone & Internet Expense": { line: "25", label: "Utilities" },
  "Utilities Expense": { line: "25", label: "Utilities" },
  "Client Gifts": { line: "27a", label: "Other expenses (gifts $25/person limit)" },
  "Eye Care - Business Expense": { line: "27a", label: "Other expenses (occupational eye care)" },
  "Education & Training": { line: "27a", label: "Other expenses" },
  "Home Office Expense": { line: "30", label: "Business use of home" },
  "Business Treasury Investment": { line: "N/A", label: "Asset — not current year deduction" },
}

export function InteractiveReports({ transactions, onUpdateTransaction, dateRange }: InteractiveReportsProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const { toast } = useToast()

  // Build category totals with transactions grouped
  const categoryTotals = useMemo(() => {
    const totals: Record<string, { amount: number; transactions: Transaction[]; isIncome: boolean }> = {}
    transactions.forEach(t => {
      const cat = t.category || "Uncategorized Expense"
      if (!totals[cat]) totals[cat] = { amount: 0, transactions: [], isIncome: false }
      totals[cat].amount += t.amount
      totals[cat].transactions.push(t)
      if (t.isIncome) totals[cat].isIncome = true
    })
    return totals
  }, [transactions])

  // Separate income, business expenses, personal, transfers
  const { incomeItems, expenseItems, personalItems, transferItems, uncategorizedItems } = useMemo(() => {
    const income: [string, typeof categoryTotals[string]][] = []
    const expense: [string, typeof categoryTotals[string]][] = []
    const personal: [string, typeof categoryTotals[string]][] = []
    const transfer: [string, typeof categoryTotals[string]][] = []
    const uncategorized: [string, typeof categoryTotals[string]][] = []

    const personalKeywords = ["personal", "atm withdrawal", "crypto"]
    const transferKeywords = ["member drawing", "member contribution", "internal transfer", "credit card payment", "zelle", "venmo"]

    Object.entries(categoryTotals).forEach(([cat, data]) => {
      const cl = cat.toLowerCase()
      if (cl.includes("uncategorized")) { uncategorized.push([cat, data]); return }
      if (data.isIncome || cl.includes("revenue") || cl.includes("income") || cl.includes("refund")) { income.push([cat, data]); return }
      if (transferKeywords.some(k => cl.includes(k))) { transfer.push([cat, data]); return }
      if (personalKeywords.some(k => cl.includes(k))) { personal.push([cat, data]); return }
      expense.push([cat, data])
    })

    return {
      incomeItems: income.sort((a, b) => b[1].amount - a[1].amount),
      expenseItems: expense.sort((a, b) => b[1].amount - a[1].amount),
      personalItems: personal.sort((a, b) => b[1].amount - a[1].amount),
      transferItems: transfer.sort((a, b) => b[1].amount - a[1].amount),
      uncategorizedItems: uncategorized,
    }
  }, [categoryTotals])

  const totalRevenue = incomeItems.reduce((s, [, d]) => s + d.amount, 0)
  const totalExpenses = expenseItems.reduce((s, [, d]) => s + d.amount, 0)
  // Calculate actual deductible amount (meals at 50%)
  const totalDeductible = expenseItems.reduce((s, [cat, d]) => {
    const pct = SCHEDULE_C_LINES[cat]?.deductPct
    return s + (pct ? d.amount * (pct / 100) : d.amount)
  }, 0)
  const netIncome = totalRevenue - totalDeductible

  // Monthly trends data
  const monthlyData = useMemo(() => {
    const months: Record<string, { revenue: number; expenses: number; net: number }> = {}
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    // Init all 12 months
    monthNames.forEach((m, i) => {
      months[m] = { revenue: 0, expenses: 0, net: 0 }
    })

    transactions.forEach(t => {
      const d = new Date(t.date)
      const mn = monthNames[d.getMonth()]
      if (!mn) return
      const cl = t.category?.toLowerCase() || ""
      const isTransfer = ["member drawing", "member contribution", "internal transfer", "credit card payment", "zelle"].some(k => cl.includes(k))
      const isPersonal = ["personal", "atm withdrawal", "crypto"].some(k => cl.includes(k))

      if (isTransfer || isPersonal) return
      if (t.isIncome) months[mn].revenue += t.amount
      else months[mn].expenses += t.amount
    })

    Object.values(months).forEach(m => { m.net = m.revenue - m.expenses })
    return Object.entries(months).map(([month, data]) => ({ month, ...data }))
  }, [transactions])

  const maxMonthlyValue = Math.max(...monthlyData.map(m => Math.max(m.revenue, m.expenses)), 1)

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategory(prev => prev === cat ? null : cat)
  }, [])

  // CSV export — client side
  const exportCSV = useCallback(() => {
    const rows = [["Date", "Description", "Amount", "Category", "Type", "Account", "Schedule C Line"]]
    transactions.forEach(t => {
      const scLine = SCHEDULE_C_LINES[t.category]
      rows.push([
        t.date, `"${t.description}"`, t.amount.toFixed(2), t.category,
        t.isIncome ? "Income" : "Expense", t.account,
        scLine ? `Line ${scLine.line} - ${scLine.label}` : "",
      ])
    })
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `schedule-c-transactions-${dateRange.start}-${dateRange.end}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Exported", description: "CSV downloaded — import into Google Sheets or Excel" })
  }, [transactions, dateRange, toast])

  // Google Sheets-ready TSV export
  const exportGoogleSheets = useCallback(() => {
    // Create a multi-sheet format: Summary + Transactions
    const summaryRows = [
      ["SCHEDULE C — PROFIT OR LOSS FROM BUSINESS"],
      [`Tax Year: ${dateRange.start.slice(0, 4)}`],
      [""],
      ["Schedule C Line", "Category", "Amount", "Deductible Amount", "# Transactions"],
    ]
    
    // Group by Schedule C line
    const lineGroups: Record<string, { categories: string[]; amount: number; deductible: number; count: number }> = {}
    expenseItems.forEach(([cat, data]) => {
      const sc = SCHEDULE_C_LINES[cat]
      const lineKey = sc ? `Line ${sc.line}` : "Other"
      if (!lineGroups[lineKey]) lineGroups[lineKey] = { categories: [], amount: 0, deductible: 0, count: 0 }
      lineGroups[lineKey].categories.push(cat)
      lineGroups[lineKey].amount += data.amount
      lineGroups[lineKey].deductible += sc?.deductPct ? data.amount * (sc.deductPct / 100) : data.amount
      lineGroups[lineKey].count += data.transactions.length
    })

    Object.entries(lineGroups).sort().forEach(([line, data]) => {
      summaryRows.push([line, data.categories.join("; "), data.amount.toFixed(2), data.deductible.toFixed(2), String(data.count)])
    })

    summaryRows.push([""])
    summaryRows.push(["TOTAL REVENUE", "", totalRevenue.toFixed(2), "", ""])
    summaryRows.push(["TOTAL EXPENSES", "", totalExpenses.toFixed(2), totalDeductible.toFixed(2), ""])
    summaryRows.push(["NET INCOME", "", netIncome.toFixed(2), "", ""])

    // Transaction detail sheet
    const txRows = [
      ["", "", "", "", "", "", ""],
      ["ALL TRANSACTIONS"],
      ["Date", "Description", "Amount", "Category", "Schedule C Line", "Type", "Account"],
    ]
    transactions
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(t => {
        const sc = SCHEDULE_C_LINES[t.category]
        txRows.push([
          t.date, t.description, t.amount.toFixed(2), t.category,
          sc ? `Line ${sc.line}` : "", t.isIncome ? "Income" : "Expense", t.account,
        ])
      })

    const allRows = [...summaryRows, ...txRows]
    const tsv = allRows.map(r => r.join("\t")).join("\n")
    const blob = new Blob([tsv], { type: "text/tab-separated-values" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `schedule-c-${dateRange.start.slice(0, 4)}-google-sheets.tsv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Exported for Google Sheets", description: "Open Google Sheets → File → Import → Upload the .tsv file" })
  }, [expenseItems, totalRevenue, totalExpenses, totalDeductible, netIncome, transactions, dateRange, toast])

  // Client-side PDF via HTML print
  const exportPDF = useCallback(() => {
    const printContent = `
<!DOCTYPE html><html><head><style>
body{font-family:Arial,sans-serif;margin:40px;font-size:11px;color:#333}
h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:8px}
h2{font-size:14px;margin-top:20px;color:#555}
table{width:100%;border-collapse:collapse;margin:10px 0}
th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #ddd}
th{background:#f5f5f5;font-weight:bold}
.amount{text-align:right;font-family:monospace}
.total{font-weight:bold;border-top:2px solid #333}
.section{margin-bottom:20px}
.green{color:#16a34a}.red{color:#dc2626}
</style></head><body>
<h1>SCHEDULE C — PROFIT OR LOSS FROM BUSINESS</h1>
<p><strong>Taxpayer:</strong> Ruben Ruiz &nbsp; <strong>Tax Year:</strong> ${dateRange.start.slice(0, 4)} &nbsp; <strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>

<div class="section">
<h2>GROSS INCOME (Lines 1-7)</h2>
<table><tr><th>Category</th><th>Schedule C Line</th><th class="amount">Amount</th><th>Transactions</th></tr>
${incomeItems.map(([cat, data]) => {
  const sc = SCHEDULE_C_LINES[cat]
  return `<tr><td>${cat}</td><td>${sc ? `Line ${sc.line} — ${sc.label}` : ""}</td><td class="amount green">$${data.amount.toLocaleString("en", { minimumFractionDigits: 2 })}</td><td>${data.transactions.length}</td></tr>`
}).join("")}
<tr class="total"><td>Total Gross Income</td><td></td><td class="amount green">$${totalRevenue.toLocaleString("en", { minimumFractionDigits: 2 })}</td><td></td></tr>
</table></div>

<div class="section">
<h2>BUSINESS EXPENSES (Lines 8-27)</h2>
<table><tr><th>Category</th><th>Schedule C Line</th><th class="amount">Amount</th><th class="amount">Deductible</th><th>Transactions</th></tr>
${expenseItems.map(([cat, data]) => {
  const sc = SCHEDULE_C_LINES[cat]
  const deductible = sc?.deductPct ? data.amount * (sc.deductPct / 100) : data.amount
  return `<tr><td>${cat}</td><td>${sc ? `Line ${sc.line} — ${sc.label}` : ""}</td><td class="amount">$${data.amount.toLocaleString("en", { minimumFractionDigits: 2 })}</td><td class="amount">$${deductible.toLocaleString("en", { minimumFractionDigits: 2 })}</td><td>${data.transactions.length}</td></tr>`
}).join("")}
<tr class="total"><td>Total Expenses</td><td></td><td class="amount red">$${totalExpenses.toLocaleString("en", { minimumFractionDigits: 2 })}</td><td class="amount red">$${totalDeductible.toLocaleString("en", { minimumFractionDigits: 2 })}</td><td></td></tr>
</table></div>

<div class="section" style="background:#f0f9ff;padding:12px;border-radius:4px">
<h2 style="margin-top:0">NET PROFIT (Line 31)</h2>
<table><tr class="total"><td>Net Profit (Loss)</td><td></td><td class="amount ${netIncome >= 0 ? "green" : "red"}">$${netIncome.toLocaleString("en", { minimumFractionDigits: 2 })}</td><td></td></tr></table>
</div>

${personalItems.length > 0 ? `<div class="section"><h2>NON-DEDUCTIBLE (Personal / Not on Schedule C)</h2><table>
${personalItems.map(([cat, data]) => `<tr><td>${cat}</td><td class="amount">$${data.amount.toLocaleString("en", { minimumFractionDigits: 2 })}</td><td>${data.transactions.length} txns</td></tr>`).join("")}
</table></div>` : ""}

${transferItems.length > 0 ? `<div class="section"><h2>TRANSFERS / OWNER DRAWS (Not on Schedule C)</h2><table>
${transferItems.map(([cat, data]) => `<tr><td>${cat}</td><td class="amount">$${data.amount.toLocaleString("en", { minimumFractionDigits: 2 })}</td><td>${data.transactions.length} txns</td></tr>`).join("")}
</table></div>` : ""}

${uncategorizedItems.length > 0 ? `<div class="section" style="background:#fef3c7;padding:12px;border-radius:4px"><h2 style="margin-top:0;color:#92400e">⚠ UNCATEGORIZED (${uncategorizedItems.reduce((s, [, d]) => s + d.transactions.length, 0)} transactions — $${uncategorizedItems.reduce((s, [, d]) => s + d.amount, 0).toFixed(2)})</h2>
<p style="color:#92400e">These need to be categorized before filing.</p></div>` : ""}

<p style="margin-top:30px;font-size:9px;color:#999">Generated by DIY Bench.io • This is not tax advice. Consult a CPA for final Schedule C preparation.</p>
</body></html>`

    // Create downloadable HTML file (works on all browsers, no popup blocking)
    const blob = new Blob([printContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Schedule-C-Report-${dateRange.start.slice(0, 4)}.html`
    a.click()
    URL.revokeObjectURL(url)

    // Also try opening for print (some browsers allow it)
    try {
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(printContent)
        printWindow.document.close()
        setTimeout(() => { printWindow.print() }, 500)
      }
    } catch {}

    toast({ title: "Report Downloaded", description: "Open the HTML file in your browser, then use File → Print → Save as PDF" })
  }, [incomeItems, expenseItems, personalItems, transferItems, uncategorizedItems, totalRevenue, totalExpenses, totalDeductible, netIncome, dateRange, toast])

  // Render a category row with expandable transaction list
  const CategoryRow = ({ cat, data, showLine = true }: { cat: string; data: typeof categoryTotals[string]; showLine?: boolean }) => {
    const sc = SCHEDULE_C_LINES[cat]
    const isExpanded = expandedCategory === cat
    const deductible = sc?.deductPct ? data.amount * (sc.deductPct / 100) : data.amount

    return (
      <div key={cat}>
        <div
          className="flex justify-between items-center py-2 px-3 hover:bg-muted/50 rounded cursor-pointer transition-colors group"
          onClick={() => toggleCategory(cat)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            <span className="text-sm truncate">{cat}</span>
            {showLine && sc && (
              <Badge variant="outline" className="text-[10px] flex-shrink-0">
                Line {sc.line}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground flex-shrink-0">
              ({data.transactions.length})
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="font-mono font-medium text-sm">
              ${data.amount.toLocaleString("en", { minimumFractionDigits: 2 })}
            </span>
            {sc?.deductPct && (
              <span className="text-xs text-muted-foreground ml-2">
                ({sc.deductPct}% = ${deductible.toFixed(2)})
              </span>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="ml-6 mb-2 border-l-2 border-muted pl-3">
            <div className="text-xs text-muted-foreground py-1 grid grid-cols-12 font-medium">
              <span className="col-span-2">Date</span>
              <span className="col-span-6">Description</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-2">Account</span>
            </div>
            {data.transactions
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(t => (
                <div key={t.id} className="text-xs py-1.5 grid grid-cols-12 hover:bg-muted/30 rounded px-1 border-b border-muted/30">
                  <span className="col-span-2 text-muted-foreground">{t.date}</span>
                  <span className="col-span-6 truncate" title={t.description}>{t.description}</span>
                  <span className={`col-span-2 text-right font-mono ${t.isIncome ? "text-green-600" : ""}`}>
                    ${t.amount.toFixed(2)}
                  </span>
                  <span className="col-span-2 text-muted-foreground truncate">{t.account}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Schedule C Tax Reports</h2>
          <p className="text-muted-foreground text-sm">
            Click any category to see transactions • {dateRange.start} to {dateRange.end}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportGoogleSheets}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Google Sheets
          </Button>
          <Button size="sm" onClick={exportPDF}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="income-statement" className="space-y-4">
        <TabsList>
          <TabsTrigger value="income-statement">Schedule C</TabsTrigger>
          <TabsTrigger value="category-analysis">All Categories</TabsTrigger>
          <TabsTrigger value="monthly-trends">Monthly Trends</TabsTrigger>
        </TabsList>

        {/* ======= SCHEDULE C INCOME STATEMENT ======= */}
        <TabsContent value="income-statement">
          <div className="space-y-4">
            {/* Revenue */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Gross Income (Lines 1-7)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {incomeItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No income transactions</p>
                ) : (
                  incomeItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} />)
                )}
                <div className="flex justify-between font-semibold border-t pt-2 mt-2 px-3">
                  <span>Total Gross Income</span>
                  <span className="text-green-600 font-mono">${totalRevenue.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  Business Expenses (Lines 8-27)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {expenseItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No categorized business expenses</p>
                ) : (
                  expenseItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} />)
                )}
                <div className="flex justify-between font-semibold border-t pt-2 mt-2 px-3">
                  <span>Total Expenses</span>
                  <span className="text-red-600 font-mono">${totalExpenses.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
                {totalDeductible !== totalExpenses && (
                  <div className="flex justify-between text-sm text-muted-foreground px-3 mt-1">
                    <span>Total Deductible (after 50% meals adjustment)</span>
                    <span className="font-mono">${totalDeductible.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Net Profit */}
            <Card className={netIncome >= 0 ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
              <CardContent className="py-4">
                <div className="flex justify-between font-bold text-lg px-3">
                  <span>Net Profit (Line 31)</span>
                  <span className={`font-mono ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${netIncome.toLocaleString("en", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground px-3 mt-1">
                  Self-employment tax (15.3%): ${(netIncome * 0.153).toLocaleString("en", { minimumFractionDigits: 2 })} •
                  Est. income tax (22%): ${(netIncome * 0.22).toLocaleString("en", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>

            {/* Personal / Non-deductible */}
            {personalItems.length > 0 && (
              <Card className="border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-muted-foreground">Non-Deductible (Personal)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {personalItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} showLine={false} />)}
                </CardContent>
              </Card>
            )}

            {/* Transfers */}
            {transferItems.length > 0 && (
              <Card className="border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-muted-foreground">Transfers / Owner Draws (Not on Schedule C)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {transferItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} showLine={false} />)}
                </CardContent>
              </Card>
            )}

            {/* Uncategorized Warning */}
            {uncategorizedItems.length > 0 && (
              <Card className="border-yellow-300 bg-yellow-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-yellow-800">
                    ⚠ Uncategorized ({uncategorizedItems.reduce((s, [, d]) => s + d.transactions.length, 0)} transactions)
                  </CardTitle>
                  <CardDescription className="text-yellow-700">
                    These must be categorized before filing. Go to the Transactions tab to categorize them.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {uncategorizedItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} showLine={false} />)}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ======= ALL CATEGORIES ======= */}
        <TabsContent value="category-analysis">
          <Card>
            <CardHeader>
              <CardTitle>All Categories</CardTitle>
              <CardDescription>Every category with transaction drill-down</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.entries(categoryTotals)
                .sort(([, a], [, b]) => b.amount - a.amount)
                .map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} />)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======= MONTHLY TRENDS ======= */}
        <TabsContent value="monthly-trends">
          <Card>
            <CardHeader>
              <CardTitle>2025 Monthly Trends</CardTitle>
              <CardDescription>Revenue vs expenses by month (excludes personal & transfers)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Legend */}
                <div className="flex gap-4 text-sm mb-4">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded" /> Revenue</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded" /> Expenses</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded" /> Net</span>
                </div>

                {monthlyData.map(m => {
                  const revW = (m.revenue / maxMonthlyValue) * 100
                  const expW = (m.expenses / maxMonthlyValue) * 100
                  const hasData = m.revenue > 0 || m.expenses > 0

                  return (
                    <div key={m.month} className={`${hasData ? "" : "opacity-30"}`}>
                      <div className="flex items-center gap-3">
                        <span className="w-8 text-sm font-medium text-muted-foreground">{m.month}</span>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="h-4 bg-green-500 rounded-sm transition-all" style={{ width: `${Math.max(revW, 0.5)}%` }} />
                            <span className="text-xs font-mono text-green-700">${m.revenue.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-4 bg-red-400 rounded-sm transition-all" style={{ width: `${Math.max(expW, 0.5)}%` }} />
                            <span className="text-xs font-mono text-red-600">${m.expenses.toLocaleString()}</span>
                          </div>
                        </div>
                        <span className={`text-xs font-mono w-20 text-right ${m.net >= 0 ? "text-blue-600" : "text-red-600"}`}>
                          {m.net >= 0 ? "+" : ""}${m.net.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {/* Totals */}
                <div className="border-t pt-3 mt-3 flex justify-between text-sm font-semibold">
                  <span>2025 Totals</span>
                  <div className="flex gap-6">
                    <span className="text-green-600">Rev: ${totalRevenue.toLocaleString()}</span>
                    <span className="text-red-600">Exp: ${totalExpenses.toLocaleString()}</span>
                    <span className={netIncome >= 0 ? "text-blue-600" : "text-red-600"}>Net: ${netIncome.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
