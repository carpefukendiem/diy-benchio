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

// Schedule C line mapping — IRS accurate, aligned with bench.io categories
const SCHEDULE_C_LINES: Record<string, { line: string; label: string; deductPct?: number }> = {
  // --- INCOME ---
  "Sales Revenue": { line: "1", label: "Gross receipts or sales" },
  "Freelance Income": { line: "1", label: "Gross receipts or sales" },
  "Returns & Allowances": { line: "2", label: "Returns and allowances" },
  "Refunds Given": { line: "2", label: "Returns and allowances" },
  "Interest Income": { line: "6", label: "Other income (interest)" },
  "Other Income": { line: "6", label: "Other income" },
  // --- COGS (Line 4) ---
  "Cost of Service": { line: "4", label: "Cost of goods sold" },
  // --- EXPENSES ---
  "Advertising & Marketing": { line: "8", label: "Advertising" },
  "Soccer Team Sponsorship": { line: "8", label: "Advertising" },
  "Social Media & Online Presence": { line: "8", label: "Advertising" },
  "Gas & Auto Expense": { line: "9", label: "Car and truck expenses" },
  "Parking Expense": { line: "9", label: "Car and truck expenses" },
  "Merchant Processing Fees": { line: "10", label: "Commissions and fees" },
  "Merchant Fees Expense": { line: "10", label: "Commissions and fees" },
  "Contract Labor": { line: "11", label: "Contract labor" },
  "Equipment & Depreciation": { line: "13", label: "Depreciation and section 179" },
  "Computer Equipment Expense": { line: "13", label: "Depreciation and section 179" },
  "Insurance Expense - Business": { line: "15", label: "Insurance (other than health)" },
  "Insurance Expense - Auto": { line: "15", label: "Insurance (auto)" },
  "Health Insurance": { line: "S1-17", label: "Self-employed health insurance (Schedule 1 Line 17 -- above-the-line)" },
  "Interest Expense": { line: "16b", label: "Interest (other)" },
  "Bank & ATM Fee Expense": { line: "16b", label: "Bank fees / Interest (other)" },
  "Professional Service Expense": { line: "17", label: "Legal and professional services" },
  "Tax Software & Services": { line: "17", label: "Legal and professional services" },
  "Office Supplies": { line: "18", label: "Office expense" },
  "Office Supply Expense": { line: "18", label: "Office expense" },
  "Office Kitchen Supplies": { line: "18", label: "Office expense" },
  "Software & Web Hosting Expense": { line: "18", label: "Office expense / Software" },
  "Rent Expense": { line: "20b", label: "Rent (other business property)" },
  "Travel Expense": { line: "24a", label: "Travel" },
  "Business Meals Expense": { line: "24b", label: "Meals (50% deductible)", deductPct: 50 },
  "Phone & Internet Expense": { line: "25", label: "Utilities" },
  "Utilities Expense": { line: "25", label: "Utilities" },
  "License & Fee Expense": { line: "27a", label: "Other expenses (licenses & permits)" },
  "California LLC Fee": { line: "27a", label: "Other expenses (CA franchise tax)" },
  "Client Gifts": { line: "27a", label: "Other expenses (gifts $25/person limit)" },
  "Eye Care - Business Expense": { line: "27a", label: "Other expenses (occupational eye care)" },
  "Education & Training": { line: "27a", label: "Other expenses (training)" },
  "Postage & Shipping Expense": { line: "27a", label: "Other expenses (postage)" },
  "Waste & Disposal": { line: "27a", label: "Other expenses (waste)" },
  "Home Office Expense": { line: "30", label: "Business use of home" },
  "SEP-IRA Contribution": { line: "S1-16", label: "Self-employed SEP/SIMPLE/qualified plans (Schedule 1)" },
  "Business Treasury Investment": { line: "N/A", label: "Asset -- not current year deduction" },
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

  // Separate into bench.io-style sections: Revenue, COGS, Operating Expenses, Above-the-line, Personal, Transfers
  const { revenueItems, returnsItems, cogsItems, expenseItems, aboveTheLineItems, personalItems, transferItems, uncategorizedItems, nondeductibleItems } = useMemo(() => {
    const revenue: [string, typeof categoryTotals[string]][] = []
    const returns: [string, typeof categoryTotals[string]][] = []
    const cogs: [string, typeof categoryTotals[string]][] = []
    const expense: [string, typeof categoryTotals[string]][] = []
    const aboveLine: [string, typeof categoryTotals[string]][] = []
    const personal: [string, typeof categoryTotals[string]][] = []
    const transfer: [string, typeof categoryTotals[string]][] = []
    const uncategorized: [string, typeof categoryTotals[string]][] = []
    const nondeductible: [string, typeof categoryTotals[string]][] = []

    const personalKeywords = ["personal", "crypto"]
    const transferKeywords = ["member drawing", "member contribution", "internal transfer", "credit card payment", "zelle", "venmo", "owner draw", "brokerage transfer", "business treasury"]
    const cogsKeywords = ["cost of service", "cost of goods"]
    const aboveLineKeywords = ["health insurance", "sep-ira"]
    const nondeductibleKeywords = ["nondeductible"]
    const returnsKeywords = ["returns & allowances", "refunds given"]

    Object.entries(categoryTotals).forEach(([cat, data]) => {
      const cl = cat.toLowerCase()
      if (cl.includes("uncategorized") || cl.includes("awaiting category")) { uncategorized.push([cat, data]); return }
      if (nondeductibleKeywords.some(k => cl.includes(k))) { nondeductible.push([cat, data]); return }
      if (returnsKeywords.some(k => cl.includes(k))) { returns.push([cat, data]); return }
      if (data.isIncome || cl.includes("revenue") || cl.includes("income")) { revenue.push([cat, data]); return }
      if (transferKeywords.some(k => cl.includes(k))) { transfer.push([cat, data]); return }
      if (personalKeywords.some(k => cl.includes(k))) { personal.push([cat, data]); return }
      if (cogsKeywords.some(k => cl.includes(k))) { cogs.push([cat, data]); return }
      if (aboveLineKeywords.some(k => cl.includes(k))) { aboveLine.push([cat, data]); return }
      expense.push([cat, data])
    })

    return {
      revenueItems: revenue.sort((a, b) => b[1].amount - a[1].amount),
      returnsItems: returns,
      cogsItems: cogs.sort((a, b) => b[1].amount - a[1].amount),
      expenseItems: expense.sort((a, b) => b[1].amount - a[1].amount),
      aboveTheLineItems: aboveLine.sort((a, b) => b[1].amount - a[1].amount),
      personalItems: personal.sort((a, b) => b[1].amount - a[1].amount),
      transferItems: transfer.sort((a, b) => b[1].amount - a[1].amount),
      uncategorizedItems: uncategorized,
      nondeductibleItems: nondeductible,
    }
  }, [categoryTotals])

  // Debug: trace Software & Web Hosting category
  const swh = categoryTotals["Software & Web Hosting Expense"]
  if (swh) {
    console.log("[v0] Software & Web Hosting in categoryTotals:", swh.amount.toFixed(2), "| txns:", swh.transactions.length, "| isIncome:", swh.isIncome)
    const negTxns = swh.transactions.filter(t => t.amount < 0)
    if (negTxns.length > 0) console.log("[v0] Software negative amount txns:", negTxns.length, negTxns.map(t => `${t.description}: ${t.amount}`))
  } else {
    console.log("[v0] 'Software & Web Hosting Expense' NOT FOUND in categoryTotals. Keys:", Object.keys(categoryTotals).filter(k => k.toLowerCase().includes("soft")))
  }
  // Check which section it landed in
  const inExpense = expenseItems.find(([k]) => k.includes("Software"))
  const inRevenue = revenueItems.find(([k]) => k.includes("Software"))
  const inTransfer = transferItems.find(([k]) => k.includes("Software"))
  console.log("[v0] Software in expense?", !!inExpense, "| in revenue?", !!inRevenue, "| in transfer?", !!inTransfer)

  // bench.io-style P&L calculations
  const totalRevenueSales = revenueItems.reduce((s, [, d]) => s + d.amount, 0)
  const totalReturns = returnsItems.reduce((s, [, d]) => s + d.amount, 0)
  const totalRevenue = totalRevenueSales - totalReturns
  const totalCOGS = cogsItems.reduce((s, [, d]) => s + d.amount, 0)
  const grossProfit = totalRevenue - totalCOGS
  const totalOperatingExpenses = expenseItems.reduce((s, [, d]) => s + d.amount, 0)
  const totalAboveTheLine = aboveTheLineItems.reduce((s, [, d]) => s + d.amount, 0)
  const totalExpenses = totalCOGS + totalOperatingExpenses
  // Calculate actual deductible amount (meals at 50%)
  const totalDeductible = expenseItems.reduce((s, [cat, d]) => {
    const pct = SCHEDULE_C_LINES[cat]?.deductPct
    return s + (pct ? d.amount * (pct / 100) : d.amount)
  }, 0) + totalCOGS
  const netIncome = totalRevenue - totalExpenses
  // For backward compat in existing exports
  const incomeItems = revenueItems

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
      const isTransfer = ["member drawing", "member contribution", "internal transfer", "credit card payment", "zelle", "owner draw", "brokerage transfer", "business treasury"].some(k => cl.includes(k))
      const isPersonal = ["personal", "crypto"].some(k => cl.includes(k))

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
    summaryRows.push(["TOTAL REVENUES", "", totalRevenue.toFixed(2), "", ""])
    if (totalCOGS > 0) summaryRows.push(["TOTAL COST OF SALES", "", totalCOGS.toFixed(2), "", ""])
    summaryRows.push(["GROSS PROFIT", "", grossProfit.toFixed(2), "", ""])
    summaryRows.push(["TOTAL OPERATING EXPENSES", "", totalOperatingExpenses.toFixed(2), totalDeductible.toFixed(2), ""])
    if (totalAboveTheLine > 0) summaryRows.push(["ABOVE-THE-LINE DEDUCTIONS", "", totalAboveTheLine.toFixed(2), "", ""])
    summaryRows.push(["TOTAL EXPENSES", "", (totalExpenses + totalAboveTheLine).toFixed(2), "", ""])
    summaryRows.push(["NET PROFIT", "", netIncome.toFixed(2), "", ""])

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
  }, [expenseItems, totalRevenue, totalCOGS, grossProfit, totalOperatingExpenses, totalAboveTheLine, totalExpenses, totalDeductible, netIncome, transactions, dateRange, toast])

  // Client-side PDF — bench.io Income Statement format
  const exportPDF = useCallback(() => {
    const fmtAmt = (n: number) => {
      const abs = Math.abs(n)
      const str = abs.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return n < 0 ? `-${str}` : str
    }
    const year = dateRange.start.slice(0, 4)

    const printContent = `
<!DOCTYPE html><html><head><style>
@page { margin: 0.6in 0.75in; size: letter; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px 50px; font-size: 10.5px; color: #1a1a1a; line-height: 1.5; }
.header { text-align: center; margin-bottom: 24px; }
.header h1 { font-size: 20px; font-weight: 700; margin: 0 0 2px; letter-spacing: -0.3px; }
.header h2 { font-size: 13px; font-weight: 400; color: #555; margin: 0 0 4px; }
.header .period { font-size: 11px; color: #888; }
.header .year-label { display: inline-block; background: #f0f0f0; border-radius: 3px; padding: 2px 10px; font-size: 10px; font-weight: 600; color: #555; margin-top: 6px; }
table { width: 100%; border-collapse: collapse; margin: 0; }
td, th { padding: 4px 0; vertical-align: top; }
.cat-name { padding-left: 16px; }
.section-header td { font-weight: 700; font-size: 11px; padding-top: 14px; padding-bottom: 4px; border-bottom: 1px solid #ccc; }
.subtotal td { font-weight: 600; padding-top: 6px; border-top: 1px solid #ddd; }
.grand-total td { font-weight: 700; font-size: 11.5px; padding-top: 8px; border-top: 2px solid #333; }
.amt { text-align: right; font-variant-numeric: tabular-nums; font-family: 'Courier New', monospace; font-size: 10.5px; white-space: nowrap; }
.light { color: #888; }
.section-gap td { padding: 4px 0; }
.footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 8.5px; color: #aaa; text-align: center; }
.sched-c { margin-top: 24px; padding: 12px 16px; background: #f7f9fc; border: 1px solid #e0e4ea; border-radius: 4px; }
.sched-c h3 { font-size: 12px; margin: 0 0 8px; font-weight: 700; }
.sched-c table td { padding: 3px 0; font-size: 10px; }
.sched-c .label { color: #555; }
.sched-c .val { font-weight: 600; }
</style></head><body>

<div class="header">
<h1>Ranking SB</h1>
<h2>Annual Income Statement</h2>
<div class="period">For the period ${year}</div>
<div class="year-label">Year ${year}</div>
</div>

<table>

<!-- REVENUES -->
<tr class="section-header"><td colspan="2">Revenues</td></tr>
${revenueItems.map(([cat, data]) => `<tr><td class="cat-name">${cat}</td><td class="amt">${fmtAmt(data.amount)}</td></tr>`).join("")}
${returnsItems.map(([cat, data]) => `<tr><td class="cat-name">${cat}</td><td class="amt">${fmtAmt(-data.amount)}</td></tr>`).join("")}
<tr class="subtotal"><td>Total Revenues</td><td class="amt">${fmtAmt(totalRevenue)}</td></tr>

<!-- COST OF SALES -->
${cogsItems.length > 0 ? `
<tr class="section-gap"><td colspan="2"></td></tr>
<tr class="section-header"><td colspan="2">Cost of Sales</td></tr>
${cogsItems.map(([cat, data]) => `<tr><td class="cat-name">${cat}</td><td class="amt">${fmtAmt(data.amount)}</td></tr>`).join("")}
<tr class="subtotal"><td>Total Cost of Sales</td><td class="amt">${fmtAmt(totalCOGS)}</td></tr>
<tr class="section-gap"><td colspan="2"></td></tr>
<tr class="subtotal"><td><strong>Gross Profit</strong></td><td class="amt"><strong>${fmtAmt(grossProfit)}</strong></td></tr>
` : `<tr class="section-gap"><td colspan="2"></td></tr>
<tr class="subtotal"><td><strong>Gross Profit</strong></td><td class="amt"><strong>${fmtAmt(grossProfit)}</strong></td></tr>`}

<!-- OPERATING EXPENSES -->
<tr class="section-gap"><td colspan="2"></td></tr>
<tr class="section-header"><td colspan="2">Operating Expenses</td></tr>
${uncategorizedItems.length > 0 ? uncategorizedItems.map(([cat, data]) => `<tr><td class="cat-name">Awaiting Category - Expense</td><td class="amt">${fmtAmt(data.amount)}</td></tr>`).join("") : ""}
${expenseItems.map(([cat, data]) => {
    const sc = SCHEDULE_C_LINES[cat]
    const label = cat === "Business Meals Expense" ? `${cat} <span class="light">(50% deductible)</span>` : cat
    return `<tr><td class="cat-name">${label}</td><td class="amt">${fmtAmt(data.amount)}</td></tr>`
  }).join("")}
${nondeductibleItems.map(([cat, data]) => `<tr><td class="cat-name">${cat}</td><td class="amt">${fmtAmt(data.amount)}</td></tr>`).join("")}
<tr class="subtotal"><td>Total Operating Expenses</td><td class="amt">${fmtAmt(totalOperatingExpenses + uncategorizedItems.reduce((s, [, d]) => s + d.amount, 0) + nondeductibleItems.reduce((s, [, d]) => s + d.amount, 0))}</td></tr>

<!-- ABOVE-THE-LINE DEDUCTIONS (not on Schedule C) -->
${aboveTheLineItems.length > 0 ? `
<tr class="section-gap"><td colspan="2"></td></tr>
<tr class="section-header"><td colspan="2">Above-the-Line Deductions (Schedule 1)</td></tr>
${aboveTheLineItems.map(([cat, data]) => {
    const sc = SCHEDULE_C_LINES[cat]
    return `<tr><td class="cat-name">${cat} <span class="light">${sc ? `(${sc.label})` : ""}</span></td><td class="amt">${fmtAmt(data.amount)}</td></tr>`
  }).join("")}
<tr class="subtotal"><td>Total Above-the-Line</td><td class="amt">${fmtAmt(totalAboveTheLine)}</td></tr>
` : ""}

<!-- TOTAL EXPENSES -->
<tr class="section-gap"><td colspan="2"></td></tr>
<tr class="subtotal"><td>Total Expenses</td><td class="amt">${fmtAmt(totalExpenses + totalAboveTheLine + uncategorizedItems.reduce((s, [, d]) => s + d.amount, 0) + nondeductibleItems.reduce((s, [, d]) => s + d.amount, 0))}</td></tr>

<!-- NET PROFIT -->
<tr class="section-gap"><td colspan="2"></td></tr>
<tr class="grand-total"><td>Net Profit</td><td class="amt">${fmtAmt(netIncome)}</td></tr>
</table>

${personalItems.length > 0 || transferItems.length > 0 ? `
<div class="sched-c" style="margin-top: 24px; background: #f9f9f9;">
<h3>Non-Business Items (Not on Schedule C)</h3>
<table>
${personalItems.map(([cat, data]) => `<tr><td class="label">${cat}</td><td class="amt val">${fmtAmt(data.amount)}</td></tr>`).join("")}
${transferItems.map(([cat, data]) => `<tr><td class="label">${cat}</td><td class="amt val">${fmtAmt(data.amount)}</td></tr>`).join("")}
</table>
</div>` : ""}

${uncategorizedItems.length > 0 ? `
<div class="sched-c" style="background: #fef9ee; border-color: #f0dca8;">
<h3 style="color: #92400e;">Awaiting Category (${uncategorizedItems.reduce((s, [, d]) => s + d.transactions.length, 0)} transactions)</h3>
<p style="font-size: 9px; color: #92400e; margin: 0;">$${uncategorizedItems.reduce((s, [, d]) => s + d.amount, 0).toFixed(2)} needs to be categorized before filing.</p>
</div>` : ""}

<div class="footer">
Generated by DIY Bench.io &bull; ${new Date().toLocaleDateString()} &bull; This is not tax advice. Consult a CPA for final Schedule C preparation.
</div>
</body></html>`

    // Create downloadable HTML file
    const blob = new Blob([printContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Ranking-SB-Income-Statement-${year}.html`
    a.click()
    URL.revokeObjectURL(url)

    // Also try opening for print
    try {
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(printContent)
        printWindow.document.close()
        setTimeout(() => { printWindow.print() }, 500)
      }
    } catch {}

    toast({ title: "Income Statement Downloaded", description: "Open the HTML file, then use File -> Print -> Save as PDF for a clean PDF." })
  }, [revenueItems, returnsItems, cogsItems, expenseItems, aboveTheLineItems, personalItems, transferItems, uncategorizedItems, nondeductibleItems, totalRevenue, totalCOGS, grossProfit, totalOperatingExpenses, totalAboveTheLine, totalExpenses, totalDeductible, netIncome, dateRange, toast])

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
          <h2 className="text-2xl font-bold">Annual Income Statement</h2>
          <p className="text-muted-foreground text-sm">
            Click any category to expand transactions -- {dateRange.start} to {dateRange.end}
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
            <FileText className="h-4 w-4 mr-1" /> Income Statement PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="income-statement" className="space-y-4">
        <TabsList>
          <TabsTrigger value="income-statement">Income Statement</TabsTrigger>
          <TabsTrigger value="category-analysis">All Categories</TabsTrigger>
          <TabsTrigger value="monthly-trends">Monthly Trends</TabsTrigger>
        </TabsList>

        {/* ======= INCOME STATEMENT (bench.io style) ======= */}
        <TabsContent value="income-statement">
          <div className="space-y-4">
            {/* Revenues */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Revenues</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {revenueItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No revenue transactions</p>
                ) : (
                  revenueItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} />)
                )}
                {returnsItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} />)}
                <div className="flex justify-between font-semibold border-t pt-2 mt-2 px-3">
                  <span>Total Revenues</span>
                  <span className="font-mono">${totalRevenue.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cost of Sales */}
            {cogsItems.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold">Cost of Sales</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {cogsItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} />)}
                  <div className="flex justify-between font-semibold border-t pt-2 mt-2 px-3">
                    <span>Total Cost of Sales</span>
                    <span className="font-mono">${totalCOGS.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gross Profit */}
            <Card className="border-foreground/20">
              <CardContent className="py-3">
                <div className="flex justify-between font-bold px-3">
                  <span>Gross Profit</span>
                  <span className="font-mono">${grossProfit.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Operating Expenses */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Operating Expenses</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {uncategorizedItems.length > 0 && uncategorizedItems.map(([cat, data]) => (
                  <CategoryRow key={cat} cat={`Awaiting Category - Expense`} data={data} showLine={false} />
                ))}
                {expenseItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No categorized business expenses</p>
                ) : (
                  expenseItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} />)
                )}
                {nondeductibleItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} showLine={false} />)}
                <div className="flex justify-between font-semibold border-t pt-2 mt-2 px-3">
                  <span>Total Operating Expenses</span>
                  <span className="font-mono">${(totalOperatingExpenses + uncategorizedItems.reduce((s, [, d]) => s + d.amount, 0) + nondeductibleItems.reduce((s, [, d]) => s + d.amount, 0)).toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
                {totalDeductible !== totalOperatingExpenses && (
                  <div className="flex justify-between text-sm text-muted-foreground px-3 mt-1">
                    <span>Deductible Total (meals at 50%)</span>
                    <span className="font-mono">${totalDeductible.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Above-the-Line Deductions */}
            {aboveTheLineItems.length > 0 && (
              <Card className="border-green-200 dark:border-green-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold">Above-the-Line Deductions (Schedule 1)</CardTitle>
                  <CardDescription>Deducted from AGI, not on Schedule C. Reduces taxable income further.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {aboveTheLineItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} />)}
                  <div className="flex justify-between font-semibold border-t pt-2 mt-2 px-3">
                    <span>Total Above-the-Line</span>
                    <span className="text-green-600 font-mono">${totalAboveTheLine.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Total Expenses */}
            <Card className="border-foreground/20">
              <CardContent className="py-3">
                <div className="flex justify-between font-bold px-3">
                  <span>Total Expenses</span>
                  <span className="font-mono">${(totalExpenses + totalAboveTheLine).toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Net Profit */}
            <Card className={netIncome >= 0 ? "border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900" : "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900"}>
              <CardContent className="py-4">
                <div className="flex justify-between font-bold text-lg px-3">
                  <span>Net Profit</span>
                  <span className={`font-mono ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${netIncome.toLocaleString("en", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Personal / Non-deductible */}
            {personalItems.length > 0 && (
              <Card className="border-muted">
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
              <Card className="border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-muted-foreground">Transfers / Owner Draws (Not on P&L)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {transferItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} showLine={false} />)}
                </CardContent>
              </Card>
            )}

            {/* Uncategorized Warning */}
            {uncategorizedItems.length > 0 && (
              <Card className="border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-800">
                <CardContent className="py-3">
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 px-3">
                    {uncategorizedItems.reduce((s, [, d]) => s + d.transactions.length, 0)} uncategorized transactions (${uncategorizedItems.reduce((s, [, d]) => s + d.amount, 0).toFixed(2)}) -- categorize these in the Transactions tab to maximize deductions.
                  </p>
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
