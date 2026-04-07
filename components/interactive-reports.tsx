"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  X,
  Download,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  formatScheduleCLine,
  getDeductibleAmountForExpense,
  getScheduleCLineForCategory,
  computeUiExpenseTotals,
} from "@/lib/tax/treatment"
import { isExcludedFromScheduleCExport } from "@/lib/tax/scheduleCExportFilter"
import type { LedgerTaxEstimate } from "@/lib/tax/taxEstimate"
import { EditableCell } from "@/components/editable-cell"
import { CATEGORIES as TRANSACTION_CATEGORIES } from "@/components/interactive-transactions-list"

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  account: string
  isIncome: boolean
  /** Non-revenue credits — omitted from revenue rollups */
  exclude?: boolean
  merchantName?: string
  is_personal?: boolean
  is_transfer?: boolean
  categorized_by?: "rule" | "ai" | "user" | null
  confidence?: number
  manual_entry?: boolean
  source?: "manual_adjustment" | "platform_fee_import" | "recovered_import"
}

function exportSourceColumn(t: Transaction): string {
  if (t.source === "platform_fee_import") return "platform_fee_import"
  if (t.source === "recovered_import") return "recovered_import"
  if (t.source === "manual_adjustment") return "manual_adjustment"
  return "statement"
}

function categoryLooksTransferLike(cat: string): boolean {
  const cl = cat.toLowerCase()
  return [
    "member drawing",
    "member contribution",
    "owner's contribution",
    "loan proceeds",
    "internal transfer",
    "credit card payment",
    "zelle",
    "venmo",
    "owner draw",
    "brokerage transfer",
    "business treasury",
  ].some((k) => cl.includes(k))
}

function revenueRowLabel(cat: string): string {
  if (cat === "Freelance Income") return "Freelance Income (Upwork)"
  if (cat === "Sales Revenue") return "Sales Revenue (Stripe)"
  return cat
}

interface InteractiveReportsProps {
  transactions: Transaction[]
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  onBulkUpdate: (updates: Array<{ id: string; updates: Partial<Transaction> }>) => Promise<void>
  dateRange: { start: string; end: string }
  businessName?: string
  highlightedTransactionIds?: string[]
  /** Matches dashboard Tax Estimate (same inputs as parent). */
  ledgerTaxEstimate?: LedgerTaxEstimate | null
  /** CA LLC / franchise add-on shown with total tax when applicable */
  caLLCFee?: number
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
  "Software & Web Hosting Expense": { line: "27a", label: "Other expenses (software)" },
  "Rent Expense": { line: "20b", label: "Rent (other business property)" },
  "Rent Vehicles & Equipment Expense": { line: "20a", label: "Rent (vehicles/equipment)" },
  "Travel Expense": { line: "24a", label: "Travel" },
  "Business Meals Expense": { line: "24b", label: "Meals (50% deductible)", deductPct: 50 },
  "Phone & Internet Expense": { line: "25", label: "Utilities" },
  "Utilities Expense": { line: "25", label: "Utilities" },
  "Depletion Expense": { line: "12", label: "Depletion" },
  "Employee Benefit Programs Expense": { line: "14", label: "Employee benefit programs" },
  "Mortgage Interest Expense": { line: "16a", label: "Mortgage interest" },
  "Repairs & Maintenance Expense": { line: "21", label: "Repairs and maintenance" },
  "Supplies Expense": { line: "22", label: "Supplies" },
  "Wages Expense": { line: "26", label: "Wages" },
  "License & Fee Expense": { line: "23", label: "Taxes and licenses" },
  "California LLC Fee": { line: "23", label: "Taxes and licenses (CA franchise tax)" },
  "Client Gifts": { line: "27a", label: "Other expenses (gifts $25/person limit)" },
  "Eye Care - Business Expense": { line: "27a", label: "Other expenses (occupational eye care)" },
  "Education & Training": { line: "27a", label: "Other expenses (training)" },
  "Postage & Shipping Expense": { line: "27a", label: "Other expenses (postage)" },
  "Waste & Disposal": { line: "27a", label: "Other expenses (waste)" },
  "Waste & Sanitation Expense": { line: "27a", label: "Other expenses (waste)" },
  "Home Improvement": { line: "27a", label: "Other expenses (home improvements)" },
  "Home Improvement (Business)": { line: "27a", label: "Other expenses (home improvements)" },
  "Home Office Expense": { line: "30", label: "Business use of home" },
  "SEP-IRA Contribution": { line: "S1-16", label: "Self-employed SEP/SIMPLE/qualified plans (Schedule 1)" },
  "Business Treasury Investment": { line: "N/A", label: "Asset -- not current year deduction" },
  // Stripe Capital / Business Loan — proceeds are NOT income, repayments are NOT deductible (principal)
  "Owner's Contribution": { line: "N/A", label: "Owner contribution — not gross receipts" },
  "Loan Proceeds": { line: "N/A", label: "Loan / capital advance — not gross receipts" },
  "Business Loan Proceeds": { line: "N/A", label: "Loan proceeds -- not income, not deductible (debt)" },
  "Loan Repayment - Principal": { line: "N/A", label: "Loan principal -- not deductible" },
  "Loan Interest Expense": { line: "16b", label: "Interest expense (deductible)" },
  // Crypto treasury purchase — capital asset, cost basis tracked separately
  "Crypto Treasury Purchase": { line: "N/A", label: "Capital asset purchase -- not expense (track cost basis)" },
  // --- HAIR STYLIST / SALON PROFESSIONAL ---
  "Service Income": { line: "1", label: "Gross receipts or sales (services)" },
  "Booth Rental Expense": { line: "20b", label: "Rent or lease (other business property)" },
  "Hair Products & Color": { line: "22", label: "Supplies (color, shampoo, treatments)" },
  "Styling Tools & Equipment": { line: "22", label: "Supplies (tools under $2,500) / Line 13 if depreciating" },
  "Disposable Supplies": { line: "22", label: "Supplies (foils, gloves, capes, neck strips)" },
  "Booking & Payment Software": { line: "27a", label: "Other expenses (Vagaro, GlossGenius, StyleSeat, Booksy)" },
  "Laundry & Cleaning": { line: "27a", label: "Other expenses (towel service, cape laundering)" },
  "Cosmetology License & Permits": { line: "23", label: "Taxes and licenses (CA Board renewal, city permit)" },
  "Professional Liability Insurance": { line: "15", label: "Insurance (stylist/salon liability -- not health)" },
  "Retail Product Sales COGS": { line: "4", label: "Cost of goods sold (retail products for resale)" },
}

export function InteractiveReports({
  transactions,
  onUpdateTransaction,
  onBulkUpdate,
  dateRange,
  businessName = "My Business",
  highlightedTransactionIds,
  ledgerTaxEstimate = null,
  caLLCFee = 0,
}: InteractiveReportsProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const { toast } = useToast()

  const [activeReportTab, setActiveReportTab] = useState<string>("income-statement")
  const highlightedSet = useMemo(() => new Set(highlightedTransactionIds ?? []), [highlightedTransactionIds])
  const accounts = useMemo(() => Array.from(new Set(transactions.map(t => t.account))).sort((a, b) => a.localeCompare(b)), [transactions])
  const [bulkReclassifyCategory, setBulkReclassifyCategory] = useState<string>("")

  useEffect(() => {
    setBulkReclassifyCategory(expandedCategory || "")
  }, [expandedCategory])

  // Build category totals with transactions grouped. Transfers flagged on the row but posted to a
  // non-transfer category do not add to that category's P&L amount (avoids understating revenue).
  const categoryTotals = useMemo(() => {
    const totals: Record<string, { amount: number; transactions: Transaction[]; isIncome: boolean }> = {}
    transactions.forEach(t => {
      const cat = t.category || "Uncategorized Expense"
      if (!totals[cat]) totals[cat] = { amount: 0, transactions: [], isIncome: false }
      totals[cat].transactions.push(t)
      const skipAmountForBucket = t.is_transfer === true && !categoryLooksTransferLike(cat)
      if (!skipAmountForBucket) totals[cat].amount += t.amount
      if (t.isIncome) totals[cat].isIncome = true
    })
    return totals
  }, [transactions, activeReportTab])

  // Separate into bench.io-style sections: Revenue, COGS, Operating Expenses, Above-the-line, Personal, Transfers, Capital
  const { revenueItems, returnsItems, cogsItems, expenseItems, aboveTheLineItems, personalItems, transferItems, uncategorizedItems, nondeductibleItems, capitalItems } = useMemo(() => {
    const revenue: [string, typeof categoryTotals[string]][] = []
    const returns: [string, typeof categoryTotals[string]][] = []
    const cogs: [string, typeof categoryTotals[string]][] = []
    const expense: [string, typeof categoryTotals[string]][] = []
    const aboveLine: [string, typeof categoryTotals[string]][] = []
    const personal: [string, typeof categoryTotals[string]][] = []
    const transfer: [string, typeof categoryTotals[string]][] = []
    const uncategorized: [string, typeof categoryTotals[string]][] = []
    const nondeductible: [string, typeof categoryTotals[string]][] = []
    const capital: [string, typeof categoryTotals[string]][] = []

    const personalKeywords = ["personal", "crypto / investments", "atm withdrawal", "cash withdrawal"]
    const transferKeywords = ["member drawing", "member contribution", "owner's contribution", "internal transfer", "credit card payment", "zelle", "venmo", "owner draw", "brokerage transfer", "business treasury"]
    const cogsKeywords = ["cost of service", "cost of goods", " cogs"]
    const aboveLineKeywords = ["health insurance", "sep-ira"]
    const nondeductibleKeywords = ["nondeductible"]
    const returnsKeywords = ["returns & allowances", "refunds given"]
    // Capital/balance-sheet items: not income, not deductible expenses
    const capitalKeywords = ["business loan proceeds", "loan proceeds", "loan repayment - principal", "crypto treasury purchase"]

    Object.entries(categoryTotals).forEach(([cat, data]) => {
      const cl = cat.toLowerCase()
      const isTransferAny = data.transactions.some(t => t.is_transfer === true)
      const isPersonalAny = data.transactions.some(t => t.is_personal === true)
      if (cl.includes("uncategorized") || cl.includes("awaiting category")) { uncategorized.push([cat, data]); return }
      if (nondeductibleKeywords.some(k => cl.includes(k))) { nondeductible.push([cat, data]); return }
      if (returnsKeywords.some(k => cl.includes(k))) { returns.push([cat, data]); return }
      if (capitalKeywords.some(k => cl.includes(k))) { capital.push([cat, data]); return }
      if (data.isIncome || cl.includes("revenue") || cl.includes("income")) { revenue.push([cat, data]); return }
      if (isTransferAny || transferKeywords.some(k => cl.includes(k))) { transfer.push([cat, data]); return }
      if (isPersonalAny || personalKeywords.some(k => cl.includes(k))) { personal.push([cat, data]); return }
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
      capitalItems: capital,
    }
  }, [categoryTotals])

  // bench.io-style P&L calculations
  const totalRevenueSales = revenueItems.reduce((s, [, d]) => s + d.amount, 0)
  const totalReturns = returnsItems.reduce((s, [, d]) => s + d.amount, 0)
  const totalRevenue = totalRevenueSales - totalReturns
  const totalCOGS = cogsItems.reduce((s, [, d]) => s + d.amount, 0)
  const grossProfit = totalRevenue - totalCOGS
  const totalOperatingExpenses = expenseItems.reduce((s, [, d]) => s + d.amount, 0)
  const totalAboveTheLine = aboveTheLineItems.reduce((s, [, d]) => s + d.amount, 0)
  const totalExpenses = totalCOGS + totalOperatingExpenses
  /** Book P&amp;L before meal limitation (operating expenses at gross amounts) */
  const netIncomeBook = totalRevenue - totalExpenses
  // For backward compat in existing exports
  const incomeItems = revenueItems

  /** Consolidated operating lines for statement UI/PDF (soccer → advertising, merchant fee aliases, meals = Schedule C amount). */
  const mergedStatementExpenses = useMemo(() => {
    const map = new Map<string, { gross: number; deductible: number; transactions: Transaction[] }>()
    for (const [cat, data] of expenseItems) {
      let out = cat
      if (cat === "Soccer Team Sponsorship") out = "Advertising & Marketing"
      if (cat === "Merchant Fees Expense") out = "Merchant Processing Fees"
      const ded = getDeductibleAmountForExpense(cat, data.amount)
      const cur = map.get(out)
      if (!cur) {
        map.set(out, {
          gross: data.amount,
          deductible: ded,
          transactions: [...data.transactions],
        })
      } else {
        cur.gross += data.amount
        cur.deductible += ded
        cur.transactions.push(...data.transactions)
      }
    }
    return Array.from(map.entries())
      .map(([displayCategory, v]) => ({
        displayCategory,
        ...v,
        isMeals: displayCategory === "Business Meals Expense",
      }))
      .sort((a, b) => b.gross - a.gross)
  }, [expenseItems])

  /** Merchant / commissions — Bench-style Cost of Sales, not Operating Expenses. */
  const MERCHANT_COST_OF_SALES_LABEL = "Merchant Processing Fees"

  const merchantCostOfSalesRow = useMemo(
    () => mergedStatementExpenses.find((r) => r.displayCategory === MERCHANT_COST_OF_SALES_LABEL),
    [mergedStatementExpenses],
  )

  const mergedOperatingExpenseRowsOnly = useMemo(
    () => mergedStatementExpenses.filter((r) => r.displayCategory !== MERCHANT_COST_OF_SALES_LABEL),
    [mergedStatementExpenses],
  )

  const totalCostOfSalesPL = totalCOGS + (merchantCostOfSalesRow?.deductible ?? 0)
  const grossProfitPL = totalRevenue - totalCostOfSalesPL

  const uncategorizedOperatingTotal = uncategorizedItems.reduce((s, [, d]) => s + d.amount, 0)

  /**
   * Operating subtotal (Schedule C–style amounts; meals at 50%). Excludes merchant (in COS).
   * Uncategorized amounts are listed in the UI but omitted here so totals match Schedule C until categorized.
   */
  const mergedOperatingScheduleCSubtotal =
    mergedOperatingExpenseRowsOnly.reduce((s, r) => s + r.deductible, 0)

  /** P&amp;L: COS + operating — never health insurance / Schedule 1; never uncategorized. */
  const totalStatementExpenses = totalCostOfSalesPL + mergedOperatingScheduleCSubtotal

  const { schedCDeductions } = useMemo(() => computeUiExpenseTotals(transactions), [transactions])

  /** Net profit; ties to Total Revenues − Total Expenses on this statement. */
  const scheduleCNetProfit = totalRevenue - totalStatementExpenses

  /** Alias for spreadsheet summary (matches `computeUiExpenseTotals`). */
  const totalDeductible = schedCDeductions

  // Monthly trends data
  const monthlyData = useMemo(() => {
    if (activeReportTab !== "monthly-trends") return []
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
      const isTransfer = t.is_transfer === true || ["member drawing", "member contribution", "owner's contribution", "internal transfer", "credit card payment", "zelle", "owner draw", "brokerage transfer", "business treasury"].some(k => cl.includes(k))
      const isPersonal = t.is_personal === true || ["personal", "crypto"].some(k => cl.includes(k))

      if (isTransfer || isPersonal || t.exclude === true) return
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
    const rows = [
      ["Date", "Description", "Amount", "Category", "Type", "Account", "Schedule C Line", "Source"],
    ]
    transactions.forEach(t => {
      if (isExcludedFromScheduleCExport(t.category, { isTransfer: t.is_transfer, isPersonal: t.is_personal, exclude: t.exclude })) return
      const scheduleLine = formatScheduleCLine(t.category)
      const source = exportSourceColumn(t)
      rows.push([
        t.date, `"${t.description}"`, t.amount.toFixed(2), t.category,
        t.isIncome ? "Income" : "Expense", t.account,
        scheduleLine,
        source,
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
      const sc = getScheduleCLineForCategory(cat)
      const lineKey = sc ? `Line ${sc.line}` : "Other"
      if (!lineGroups[lineKey]) lineGroups[lineKey] = { categories: [], amount: 0, deductible: 0, count: 0 }
      lineGroups[lineKey].categories.push(cat)
      lineGroups[lineKey].amount += data.amount
      lineGroups[lineKey].deductible += getDeductibleAmountForExpense(cat, data.amount)
      lineGroups[lineKey].count += data.transactions.length
    })

    Object.entries(lineGroups).sort().forEach(([line, data]) => {
      summaryRows.push([line, data.categories.join("; "), data.amount.toFixed(2), data.deductible.toFixed(2), String(data.count)])
    })

    summaryRows.push([""])
    summaryRows.push(["INCOME STATEMENT SUMMARY (P&L)"])
    summaryRows.push(["TOTAL REVENUES", "", totalRevenue.toFixed(2), "", ""])
    if (totalCostOfSalesPL > 0) summaryRows.push(["TOTAL COST OF SALES", "", totalCostOfSalesPL.toFixed(2), "", ""])
    summaryRows.push(["GROSS PROFIT", "", grossProfitPL.toFixed(2), "", ""])
    summaryRows.push(["TOTAL OPERATING EXPENSES", "", mergedOperatingScheduleCSubtotal.toFixed(2), totalDeductible.toFixed(2), ""])
    summaryRows.push(["TOTAL EXPENSES (excl. Schedule 1)", "", totalStatementExpenses.toFixed(2), "", ""])
    summaryRows.push(["NET PROFIT", "", scheduleCNetProfit.toFixed(2), "", ""])
    if (totalAboveTheLine > 0) {
      summaryRows.push([""])
      summaryRows.push(["SCHEDULE 1 (ABOVE THE LINE) — NOT ON P&L TOTALS"])
      summaryRows.push(["TOTAL ABOVE-THE-LINE DEDUCTIONS", "", totalAboveTheLine.toFixed(2), "", ""])
    }

    // Transaction detail sheet
    const txRows = [
      ["", "", "", "", "", "", "", ""],
      ["ALL TRANSACTIONS"],
      ["Date", "Description", "Amount", "Category", "Schedule C Line", "Type", "Account", "Source"],
    ]
    transactions
      .filter((t) => !isExcludedFromScheduleCExport(t.category, { isTransfer: t.is_transfer, isPersonal: t.is_personal, exclude: t.exclude }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(t => {
        const sc = getScheduleCLineForCategory(t.category)
        const source = exportSourceColumn(t)
        txRows.push([
          t.date, t.description, t.amount.toFixed(2), t.category,
          sc ? `Line ${sc.line}` : "", t.isIncome ? "Income" : "Expense", t.account,
          source,
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
  }, [
    expenseItems,
    totalRevenue,
    totalCostOfSalesPL,
    grossProfitPL,
    mergedOperatingScheduleCSubtotal,
    totalAboveTheLine,
    totalStatementExpenses,
    totalDeductible,
    scheduleCNetProfit,
    transactions,
    dateRange,
    toast,
  ])

  /** Minimal Bench-style P&amp;L HTML only (no tax panel, no Schedule C annotations). */
  const exportPDF = useCallback(() => {
    const fmtAmt = (n: number) => {
      const abs = Math.abs(n)
      const str = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return n < 0 ? `(${str})` : str
    }
    const year = dateRange.start.slice(0, 4)
    const hasCostOfSales = totalCostOfSalesPL > 0

    const cosRows = [
      ...cogsItems.map(([cat, data]) => `<tr><td class="ind">${cat}</td><td class="amt">${fmtAmt(data.amount)}</td></tr>`),
      ...(merchantCostOfSalesRow
        ? [
            `<tr><td class="ind">${MERCHANT_COST_OF_SALES_LABEL}</td><td class="amt">${fmtAmt(merchantCostOfSalesRow.deductible)}</td></tr>`,
          ]
        : []),
    ].join("")

    const opRows = mergedOperatingExpenseRowsOnly
      .map(
        (row) =>
          `<tr><td class="ind">${row.displayCategory}</td><td class="amt">${fmtAmt(row.deductible)}</td></tr>`,
      )
      .join("")

    const printContent = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
@page { margin: 0.75in 0.85in; size: letter; }
body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 0; font-size: 11px; color: #000; line-height: 1.35; }
.hdr { text-align: center; margin-bottom: 28px; }
.co { font-size: 15px; font-weight: 700; margin: 0 0 6px; }
.ti { font-size: 12px; font-weight: 400; margin: 0 0 2px; }
.per { font-size: 11px; margin: 0; }
table.pl { width: 100%; border-collapse: collapse; }
.pl td { padding: 3px 0; vertical-align: baseline; }
.pl td.amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-left: 12px; }
.pl td.ind { padding-left: 18px; }
.sec td { font-weight: 700; padding-top: 14px; padding-bottom: 4px; border-bottom: 1px solid #000; }
.sub td { font-weight: 600; padding-top: 8px; border-top: 1px solid #bbb; }
.tot td { font-weight: 700; padding-top: 10px; border-top: 2px solid #000; font-size: 11px; }
.sp td { height: 10px; padding: 0; border: none; }
</style></head><body>
<div class="hdr">
<div class="co">${businessName}</div>
<div class="ti">Annual Income Statement</div>
<p class="per">For the period ${year}</p>
</div>
<table class="pl" role="presentation">
<tr class="sec"><td>Revenues</td><td></td></tr>
${revenueItems.map(([cat, data]) => `<tr><td class="ind">${revenueRowLabel(cat)}</td><td class="amt">${fmtAmt(data.amount)}</td></tr>`).join("")}
${returnsItems.map(([cat, data]) => `<tr><td class="ind">${cat}</td><td class="amt">${fmtAmt(-data.amount)}</td></tr>`).join("")}
<tr class="sub"><td>Total Revenues</td><td class="amt">${fmtAmt(totalRevenue)}</td></tr>
${
  hasCostOfSales
    ? `<tr class="sp"><td colspan="2"></td></tr>
<tr class="sec"><td>Cost of Sales</td><td></td></tr>
${cosRows}
<tr class="sub"><td>Total Cost of Sales</td><td class="amt">${fmtAmt(totalCostOfSalesPL)}</td></tr>`
    : ""
}
<tr class="sp"><td colspan="2"></td></tr>
<tr class="sub"><td>Gross Profit</td><td class="amt">${fmtAmt(grossProfitPL)}</td></tr>
<tr class="sp"><td colspan="2"></td></tr>
<tr class="sec"><td>Operating Expenses</td><td></td></tr>
${opRows}
<tr class="sub"><td>Total Operating Expenses</td><td class="amt">${fmtAmt(mergedOperatingScheduleCSubtotal)}</td></tr>
<tr class="sp"><td colspan="2"></td></tr>
<tr class="sub"><td>Total Expenses</td><td class="amt">${fmtAmt(totalStatementExpenses)}</td></tr>
<tr class="sp"><td colspan="2"></td></tr>
<tr class="tot"><td>Net Profit</td><td class="amt">${fmtAmt(scheduleCNetProfit)}</td></tr>
</table>
</body></html>`

    const blob = new Blob([printContent], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${businessName.replace(/[^a-z0-9]/gi, "-")}-Income-Statement-${year}.html`
    a.click()
    URL.revokeObjectURL(url)

    try {
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(printContent)
        printWindow.document.close()
        setTimeout(() => {
          printWindow.print()
        }, 400)
      }
    } catch {
      /* ignore */
    }

    toast({ title: "Income Statement downloaded", description: "HTML file — use Print → Save as PDF if needed." })
  }, [
    revenueItems,
    returnsItems,
    cogsItems,
    merchantCostOfSalesRow,
    mergedOperatingExpenseRowsOnly,
    mergedOperatingScheduleCSubtotal,
    totalRevenue,
    totalCostOfSalesPL,
    grossProfitPL,
    totalStatementExpenses,
    scheduleCNetProfit,
    dateRange,
    businessName,
    toast,
  ])

  /** Internal tax planning — separate from the P&amp;L export. */
  const exportTaxSummary = useCallback(() => {
    const te = ledgerTaxEstimate
    if (te == null) {
      toast({
        title: "Tax Summary unavailable",
        description: "Open the dashboard with transactions loaded so the tax estimate can run, then try again.",
        variant: "destructive",
      })
      return
    }
    const fmtAmt = (n: number) => {
      const abs = Math.abs(n)
      const str = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return n < 0 ? `(${str})` : str
    }
    const year = dateRange.start.slice(0, 4)

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Tax Summary ${year}</title><style>
@page { margin: 0.75in 0.85in; size: letter; }
body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 0; font-size: 11px; color: #000; line-height: 1.4; }
.hdr { text-align: center; margin-bottom: 24px; }
.co { font-size: 15px; font-weight: 700; margin: 0 0 6px; }
.ti { font-size: 12px; margin: 0; }
.per { font-size: 11px; margin: 4px 0 0; }
table { width: 100%; border-collapse: collapse; }
td { padding: 4px 0; vertical-align: top; }
td.amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; padding-left: 16px; }
tr.div td { padding-top: 10px; }
</style></head><body>
<div class="hdr">
<div class="co">${businessName}</div>
<div class="ti">Tax Summary</div>
<p class="per">For the period ${year} • Filing status: ${te.filingStatus === "married_joint" ? "Married filing jointly" : "Single"}</p>
</div>
<table role="presentation">
<tr><td>Gross revenue</td><td class="amt">${fmtAmt(te.grossRevenue)}</td></tr>
<tr><td>Total Schedule C deductions</td><td class="amt">${fmtAmt(te.scheduleCTotalDeductions)}</td></tr>
<tr><td>Net profit (Schedule C)</td><td class="amt">${fmtAmt(te.netProfitScheduleC)}</td></tr>
<tr class="div"><td>Self-employment tax</td><td class="amt">${fmtAmt(te.selfEmploymentTax)}</td></tr>
<tr><td>One-half SE tax deduction (Schedule 1)</td><td class="amt">${fmtAmt(te.halfSETaxDeduction)}</td></tr>
<tr><td>Health insurance deduction (Schedule 1)</td><td class="amt">${fmtAmt(te.healthInsuranceDeduction)}</td></tr>
<tr><td>Adjusted gross income</td><td class="amt">${fmtAmt(te.adjustedGrossIncome)}</td></tr>
<tr><td>Federal standard deduction</td><td class="amt">${fmtAmt(te.federalStandardDeduction)}</td></tr>
<tr><td>Federal taxable income (after QBI)</td><td class="amt">${fmtAmt(te.taxableIncomeFederal)}</td></tr>
<tr class="div"><td>Federal income tax</td><td class="amt">${fmtAmt(te.federalIncomeTax)}</td></tr>
<tr><td>California income tax</td><td class="amt">${fmtAmt(te.californiaIncomeTax)}</td></tr>
${caLLCFee > 0 ? `<tr><td>California LLC / franchise</td><td class="amt">${fmtAmt(caLLCFee)}</td></tr>` : ""}
<tr class="div"><td><strong>Total estimated tax owed</strong></td><td class="amt"><strong>${fmtAmt(te.totalEstimatedTaxOwed + caLLCFee)}</strong></td></tr>
<tr class="div"><td>SEP-IRA max deferral (planning)</td><td class="amt">${fmtAmt(te.sepIraMaxDeferral)}</td></tr>
<tr><td>Estimated federal tax saved if max SEP</td><td class="amt">${fmtAmt(te.estimatedFederalTaxSavedIfMaxSep)}</td></tr>
</table>
</body></html>`

    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${businessName.replace(/[^a-z0-9]/gi, "-")}-Tax-Summary-${year}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Tax Summary downloaded", description: "Separate from the income statement — for internal planning." })
  }, [ledgerTaxEstimate, businessName, dateRange, caLLCFee, toast])

  const inferFromCategory = useCallback((category: string) => {
    const revenueCategories = [
      "Sales Revenue",
      "Service Income",
      "Freelance Income",
      "Interest Income",
      "Other Income",
      "Refunds Given",
      "Member Contribution - Ruben Ruiz",
    ]
    const isIncome = revenueCategories.includes(category)
    const c = String(category || "").toLowerCase()
    const is_personal = c.includes("personal") || c.includes("crypto / investments")
    const is_transfer =
      c.includes("credit card payment") ||
      c.includes("member drawing") ||
      c.includes("member contribution") ||
      c.includes("owner's contribution") ||
      c.includes("loan proceeds") ||
      c.includes("owner draw") ||
      c.includes("internal transfer") ||
      c.includes("zelle / venmo transfer") ||
      c.includes("brokerage transfer") ||
      c.includes("business treasury") ||
      c.includes("crypto / investments")
    const exclude =
      category === "Owner's Contribution" ||
      category === "Loan Proceeds" ||
      category === "Business Loan Proceeds"
    return { isIncome, is_personal, is_transfer, exclude }
  }, [])

  // Render a category row with expandable transaction list
  const CategoryRow = ({
    cat,
    data,
    showLine = true,
    rowLabel,
    /** When set (e.g. merged meals row), main column shows this Schedule C amount; `data.amount` is gross. */
    primaryAmount,
    /** Income Statement tab: hide Schedule C badges and meal annotations. */
    plainIncomeStatement = false,
  }: {
    cat: string
    data: (typeof categoryTotals)[string]
    showLine?: boolean
    rowLabel?: string
    primaryAmount?: number
    plainIncomeStatement?: boolean
  }) => {
    const title = rowLabel ?? cat
    const sc = SCHEDULE_C_LINES[cat]
    const showScheduleMeta = showLine && !plainIncomeStatement
    const isExpanded = expandedCategory === cat
    const deductible = sc?.deductPct ? data.amount * (sc.deductPct / 100) : data.amount
    const summaryAmount = primaryAmount !== undefined ? primaryAmount : data.amount
    const normalizedBulkCategory = TRANSACTION_CATEGORIES.includes(bulkReclassifyCategory)
      ? bulkReclassifyCategory
      : (TRANSACTION_CATEGORIES[0] ?? "")
    const hasDirtyInCategory = data.transactions.some((t) => highlightedSet.has(t.id))

    return (
      <div key={cat}>
        <div
          className={`flex justify-between items-center py-2 px-3 hover:bg-muted/50 rounded cursor-pointer transition-colors group ${
            hasDirtyInCategory ? "bg-amber-50 border border-amber-300 dark:bg-amber-950/30 dark:border-amber-700" : ""
          }`}
          onClick={() => toggleCategory(cat)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            <span className="text-sm truncate">{title}</span>
            {showScheduleMeta && sc && (
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
              ${summaryAmount.toLocaleString("en", { minimumFractionDigits: 2 })}
            </span>
            {!plainIncomeStatement && sc?.deductPct && primaryAmount !== undefined && (
              <span className="text-xs text-muted-foreground ml-2">
                (50% deductible; gross ${data.amount.toLocaleString("en", { minimumFractionDigits: 2 })})
              </span>
            )}
            {!plainIncomeStatement && sc?.deductPct && primaryAmount === undefined && (
              <span className="text-xs text-muted-foreground ml-2">
                ({sc.deductPct}% = ${deductible.toFixed(2)})
              </span>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="ml-6 mb-2 border-l-2 border-muted pl-3 space-y-2">
            {data.transactions.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[11px]">
                  Bulk reclassify {data.transactions.length} in "{title}"
                </Badge>
                <Select value={normalizedBulkCategory} onValueChange={setBulkReclassifyCategory}>
                  <SelectTrigger className="w-[260px] h-8">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  disabled={!normalizedBulkCategory || normalizedBulkCategory === cat}
                  onClick={async () => {
                    const toCategory = normalizedBulkCategory
                    const { isIncome, is_personal, is_transfer, exclude } = inferFromCategory(toCategory)
                    const updates = data.transactions.map((tx) => ({
                      id: tx.id,
                      updates: {
                        category: toCategory,
                        isIncome,
                        is_personal,
                        is_transfer,
                        exclude,
                        categorized_by: "user" as const,
                        confidence: 1,
                      },
                    }))
                    await onBulkUpdate(updates)
                    setExpandedCategory(toCategory)
                  }}
                >
                  Apply to all
                </Button>
              </div>
            )}

            <div className="text-xs text-muted-foreground py-1 grid grid-cols-12 font-medium">
              <span className="col-span-2">Date</span>
              <span className="col-span-4">Description</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-2">Category</span>
              <span className="col-span-2">Account</span>
            </div>

            {data.transactions
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((t) => {
                const isHighlighted = highlightedSet.has(t.id)
                const categorizedLabel =
                  t.categorized_by === "rule"
                    ? "Rules"
                    : t.categorized_by === "ai"
                      ? "AI"
                      : t.categorized_by === "user"
                        ? "Manual"
                        : ""
                const confidenceLabel = typeof t.confidence === "number" ? `${Math.round(t.confidence * 100)}%` : ""
                return (
                  <div
                    key={t.id}
                    className={`text-xs py-1.5 grid grid-cols-12 hover:bg-muted/30 rounded px-1 border-b border-muted/30 ${
                      isHighlighted
                        ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700"
                        : ""
                    }`}
                  >
                    <span className="col-span-2 text-muted-foreground truncate">{t.date}</span>

                    <div className="col-span-4 min-w-0">
                      <div className="truncate" title={t.description}>
                        {t.description}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        {t.source === "manual_adjustment" && (
                          <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                            Manual adjustment
                          </Badge>
                        )}
                        {t.source === "platform_fee_import" && (
                          <Badge variant="secondary" className="text-[10px] whitespace-nowrap bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100">
                            Platform fee import
                          </Badge>
                        )}
                        {t.source === "recovered_import" && (
                          <Badge variant="secondary" className="text-[10px] whitespace-nowrap bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100">
                            Recovered import
                          </Badge>
                        )}
                        {t.categorized_by && (
                          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                            {categorizedLabel}
                          </Badge>
                        )}
                        {confidenceLabel && (
                          <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                            {confidenceLabel}
                          </Badge>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                            <Checkbox
                              checked={t.is_personal === true}
                              onCheckedChange={(v) =>
                                void onUpdateTransaction(t.id, {
                                  is_personal: v === true,
                                  categorized_by: "user",
                                  confidence: 1,
                                })
                              }
                            />
                            Personal
                          </label>
                          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                            <Checkbox
                              checked={t.is_transfer === true}
                              onCheckedChange={(v) =>
                                void onUpdateTransaction(t.id, {
                                  is_transfer: v === true,
                                  categorized_by: "user",
                                  confidence: 1,
                                })
                              }
                            />
                            Transfer
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 flex justify-end items-center">
                      <EditableCell
                        value={t.amount.toFixed(2)}
                        type="number"
                        className={t.isIncome ? "text-green-600" : "text-red-600"}
                        onSave={(value) => {
                          const next = Number.parseFloat(value)
                          void onUpdateTransaction(t.id, {
                            amount: Number.isFinite(next) ? Math.abs(next) : t.amount,
                          })
                        }}
                      />
                    </div>

                    <div className="col-span-2 flex items-center">
                      <EditableCell
                        value={t.category}
                        type="select"
                        options={TRANSACTION_CATEGORIES}
                        onSave={(value) => {
                          const { isIncome, is_personal, is_transfer, exclude } = inferFromCategory(value)
                          void onUpdateTransaction(t.id, {
                            category: value,
                            isIncome,
                            is_personal,
                            is_transfer,
                            exclude,
                            categorized_by: "user",
                            confidence: 1,
                          })
                        }}
                      />
                    </div>

                    <span className="col-span-2 text-muted-foreground truncate">{t.account}</span>
                  </div>
                )
              })}
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
          {highlightedTransactionIds && highlightedTransactionIds.length > 0 && (
            <p className="text-xs mt-2 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
              You have {highlightedTransactionIds.length} unsaved edit{highlightedTransactionIds.length === 1 ? "" : "s"}. Click the Save button to persist changes.
            </p>
          )}
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportGoogleSheets}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Google Sheets
          </Button>
          <Button size="sm" onClick={exportPDF}>
            <FileText className="h-4 w-4 mr-1" /> Income Statement
          </Button>
          <Button variant="outline" size="sm" onClick={exportTaxSummary}>
            <Download className="h-4 w-4 mr-1" /> Tax Summary
          </Button>
        </div>
      </div>

      <Tabs
        defaultValue="income-statement"
        onValueChange={setActiveReportTab}
        className="space-y-4"
      >
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
                  revenueItems.map(([cat, data]) => (
                    <CategoryRow
                      key={cat}
                      cat={cat}
                      data={data}
                      rowLabel={revenueRowLabel(cat)}
                      plainIncomeStatement
                      showLine={false}
                    />
                  ))
                )}
                {returnsItems.map(([cat, data]) => (
                  <CategoryRow key={cat} cat={cat} data={data} plainIncomeStatement showLine={false} />
                ))}
                <div className="flex justify-between font-semibold border-t pt-2 mt-2 px-3">
                  <span>Total Revenues</span>
                  <span className="font-mono">${totalRevenue.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cost of Sales (COGS + merchant processing) */}
            {totalCostOfSalesPL > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold">Cost of Sales</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {cogsItems.map(([cat, data]) => (
                    <CategoryRow key={cat} cat={cat} data={data} plainIncomeStatement showLine={false} />
                  ))}
                  {merchantCostOfSalesRow && (
                    <CategoryRow
                      cat={MERCHANT_COST_OF_SALES_LABEL}
                      data={{
                        amount: merchantCostOfSalesRow.gross,
                        transactions: merchantCostOfSalesRow.transactions,
                        isIncome: false,
                      }}
                      primaryAmount={merchantCostOfSalesRow.deductible}
                      plainIncomeStatement
                      showLine={false}
                    />
                  )}
                  <div className="flex justify-between font-semibold border-t pt-2 mt-2 px-3">
                    <span>Total Cost of Sales</span>
                    <span className="font-mono">${totalCostOfSalesPL.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gross Profit */}
            <Card className="border-foreground/20">
              <CardContent className="py-3">
                <div className="flex justify-between font-bold px-3">
                  <span>Gross Profit</span>
                  <span className="font-mono">${grossProfitPL.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Operating Expenses */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Operating Expenses</CardTitle>
                <CardDescription>
                  Merchant processing is under Cost of Sales. Soccer sponsorship is included in Advertising &amp; Marketing.
                  Amounts follow Schedule C rules (business meals at 50%).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {uncategorizedItems.length > 0 && (
                  <>
                    {uncategorizedItems.map(([cat, data]) => (
                      <CategoryRow
                        key={cat}
                        cat="Uncategorized Expense"
                        data={data}
                        showLine={false}
                        plainIncomeStatement
                      />
                    ))}
                    <p className="text-xs text-muted-foreground px-3 pb-2">
                      Uncategorized transactions are not included in Total Expenses or Net Profit until categorized.
                    </p>
                  </>
                )}
                {mergedOperatingExpenseRowsOnly.length === 0 && uncategorizedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No categorized business expenses</p>
                ) : (
                  mergedOperatingExpenseRowsOnly.map((row) => (
                    <CategoryRow
                      key={row.displayCategory}
                      cat={row.displayCategory}
                      data={{
                        amount: row.gross,
                        transactions: row.transactions,
                        isIncome: false,
                      }}
                      primaryAmount={row.deductible}
                      plainIncomeStatement
                      showLine={false}
                    />
                  ))
                )}
                {nondeductibleItems.map(([cat, data]) => (
                  <CategoryRow key={cat} cat={cat} data={data} showLine={false} plainIncomeStatement />
                ))}
                <div className="flex justify-between font-semibold border-t pt-2 mt-2 px-3">
                  <span>Total Operating Expenses</span>
                  <span className="font-mono">
                    ${mergedOperatingScheduleCSubtotal.toLocaleString("en", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {nondeductibleItems.length > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground px-3 mt-1">
                    <span>Other (not on Schedule C)</span>
                    <span className="font-mono">
                      $
                      {nondeductibleItems
                        .reduce((s, [, d]) => s + d.amount, 0)
                        .toLocaleString("en", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Total Expenses — P&amp;L only (not Schedule 1) */}
            <Card className="border-foreground/20">
              <CardContent className="py-3">
                <div className="flex justify-between font-bold px-3">
                  <span>Total Expenses</span>
                  <span className="font-mono">${totalStatementExpenses.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                </div>
                <p className="text-xs text-muted-foreground px-3 mt-1">
                  Cost of sales plus operating expenses. Health insurance and other Form 1040 Schedule 1 deductions are
                  below Net Profit.
                </p>
              </CardContent>
            </Card>

            {/* Net Profit */}
            <Card
              className={
                scheduleCNetProfit >= 0
                  ? "border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900"
                  : "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900"
              }
            >
              <CardContent className="py-4">
                <div className="flex justify-between font-bold text-lg px-3">
                  <span>Net Profit</span>
                  <span className={`font-mono ${scheduleCNetProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${scheduleCNetProfit.toLocaleString("en", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground px-3 mt-1">Total Revenues minus Total Expenses on this statement.</p>
              </CardContent>
            </Card>

            {/* Above-the-Line — Form 1040 Schedule 1 (after P&amp;L net) */}
            {aboveTheLineItems.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold">Form 1040 — Schedule 1 (above-the-line)</CardTitle>
                  <CardDescription>
                    These reduce adjusted gross income on your personal return. They are not subtracted on this income
                    statement and do not change Net Profit above.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {aboveTheLineItems.map(([cat, data]) => (
                    <CategoryRow key={cat} cat={cat} data={data} plainIncomeStatement showLine={false} />
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-2 mt-2 px-3">
                    <span>Total Schedule 1 deductions (this section)</span>
                    <span className="font-mono">${totalAboveTheLine.toLocaleString("en", { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {ledgerTaxEstimate && (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tax Estimation Summary</CardTitle>
                  <CardDescription>AGI through estimated tax — same logic as the dashboard Tax Estimate panel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm pt-0">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Gross revenue</span>
                    <span className="font-mono">${ledgerTaxEstimate.grossRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Total Schedule C deductions</span>
                    <span className="font-mono">${ledgerTaxEstimate.scheduleCTotalDeductions.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-2 font-medium">
                    <span>Net profit (Schedule C)</span>
                    <span className="font-mono">${ledgerTaxEstimate.netProfitScheduleC.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Self-employment tax</span>
                      <span className="font-mono">${ledgerTaxEstimate.selfEmploymentTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">½ SE deduction</span>
                      <span className="font-mono">−${ledgerTaxEstimate.halfSETaxDeduction.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Health insurance (Sch. 1)</span>
                      <span className="font-mono">−${ledgerTaxEstimate.healthInsuranceDeduction.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">AGI</span>
                      <span className="font-mono">${ledgerTaxEstimate.adjustedGrossIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Federal standard deduction</span>
                      <span className="font-mono">−${ledgerTaxEstimate.federalStandardDeduction.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Federal taxable income (after QBI)</span>
                      <span className="font-mono">${ledgerTaxEstimate.taxableIncomeFederal.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-2 space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Federal income tax</span>
                      <span className="font-mono">${ledgerTaxEstimate.federalIncomeTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Self-employment tax</span>
                      <span className="font-mono">${ledgerTaxEstimate.selfEmploymentTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">California income tax</span>
                      <span className="font-mono">${ledgerTaxEstimate.californiaIncomeTax.toFixed(2)}</span>
                    </div>
                    {caLLCFee > 0 && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">CA LLC / franchise</span>
                        <span className="font-mono">${caLLCFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 font-semibold border-t pt-2">
                      <span>Total estimated tax owed</span>
                      <span className="font-mono">${(ledgerTaxEstimate.totalEstimatedTaxOwed + caLLCFee).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-2 text-xs space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">SEP-IRA max deferral (planning)</span>
                      <span className="font-mono">${ledgerTaxEstimate.sepIraMaxDeferral.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Est. federal tax saved if max SEP</span>
                      <span className="font-mono">${ledgerTaxEstimate.estimatedFederalTaxSavedIfMaxSep.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Capital / Financing Items */}
            {capitalItems.length > 0 && (
              <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-800 print:hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-blue-700 dark:text-blue-400">Capital &amp; Financing</CardTitle>
                  <p className="text-xs text-muted-foreground">Not included in Schedule C net profit.</p>
                </CardHeader>
                <CardContent className="pt-0">
                  {capitalItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} showLine={true} />)}
                </CardContent>
              </Card>
            )}

            {/* Personal / Non-deductible */}
            {personalItems.length > 0 && (
              <Card className="border-muted print:hidden">
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
              <Card className="border-muted print:hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-muted-foreground">Transfers / Owner Draws (Not on P&L)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {transferItems.map(([cat, data]) => <CategoryRow key={cat} cat={cat} data={data} showLine={false} />)}
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
                    <span className={netIncomeBook >= 0 ? "text-blue-600" : "text-red-600"}>
                      Net: ${netIncomeBook.toLocaleString()}
                    </span>
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
