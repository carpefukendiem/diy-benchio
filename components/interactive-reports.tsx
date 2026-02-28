"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { EditableCell } from "@/components/editable-cell"
import { FileSpreadsheet, FileText, TrendingUp, TrendingDown, Edit3 } from "lucide-react"
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

interface InteractiveReportsProps {
  transactions: Transaction[]
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  dateRange: { start: string; end: string }
}

export function InteractiveReports({ transactions, onUpdateTransaction, dateRange }: InteractiveReportsProps) {
  const [editingMode, setEditingMode] = useState(false)
  const { toast } = useToast()

  // Calculate financial data — separate income vs expense buckets
  const categoryTotals = useMemo(() => {
    const totals: Record<string, { amount: number; transactions: Transaction[] }> = {}

    transactions.forEach((transaction) => {
      // Skip transfers and personal items from financial report
      const cat = transaction.category
      const skip = [
        "Internal Transfer",
        "Credit Card Payment",
        "Member Drawing - Ruben Ruiz",
        "Member Contribution - Ruben Ruiz",
        "Personal Expense",
        "Personal - Groceries",
        "Personal - Entertainment",
        "Personal - Shopping",
        "Personal - Food & Drink",
        "Personal - Health",
        "ATM Withdrawal",
        "Zelle / Venmo Transfer",
        "Crypto / Investments",
      ]
      if (skip.includes(cat)) return

      if (!totals[cat]) {
        totals[cat] = { amount: 0, transactions: [] }
      }
      totals[cat].amount += transaction.amount
      totals[cat].transactions.push(transaction)
    })

    return totals
  }, [transactions])

  // Revenue: only income transactions grouped by category
  const revenueTotals = useMemo(() => {
    const totals: Record<string, { amount: number; count: number }> = {}
    transactions.forEach((t) => {
      if (!t.isIncome) return
      const cat = t.category
      if (!totals[cat]) totals[cat] = { amount: 0, count: 0 }
      totals[cat].amount += t.amount
      totals[cat].count++
    })
    return totals
  }, [transactions])

  // Expenses: only non-income, non-transfer, non-personal transactions
  const expenseTotals = useMemo(() => {
    const personalOrTransfer = [
      "Internal Transfer",
      "Credit Card Payment",
      "Member Drawing - Ruben Ruiz",
      "Member Contribution - Ruben Ruiz",
      "Personal Expense",
      "Personal - Groceries",
      "Personal - Entertainment",
      "Personal - Shopping",
      "Personal - Food & Drink",
      "Personal - Health",
      "ATM Withdrawal",
      "Zelle / Venmo Transfer",
      "Crypto / Investments",
    ]
    const totals: Record<string, { amount: number; count: number }> = {}
    transactions.forEach((t) => {
      if (t.isIncome) return
      if (personalOrTransfer.includes(t.category)) return
      const cat = t.category
      if (!totals[cat]) totals[cat] = { amount: 0, count: 0 }
      totals[cat].amount += t.amount
      totals[cat].count++
    })
    return totals
  }, [transactions])

  const totalRevenue = Object.values(revenueTotals).reduce((sum, v) => sum + v.amount, 0)
  const totalExpenses = Object.values(expenseTotals).reduce((sum, v) => sum + v.amount, 0)
  const netIncome = totalRevenue - totalExpenses

  const handleCategoryUpdate = async (oldCategory: string, newCategory: string) => {
    if (oldCategory === newCategory) return

    const transactionsToUpdate = categoryTotals[oldCategory]?.transactions || []

    try {
      for (const transaction of transactionsToUpdate) {
        await onUpdateTransaction(transaction.id, { category: newCategory })
      }
      toast({
        title: "Success",
        description: `Updated ${transactionsToUpdate.length} transactions to ${newCategory}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      })
    }
  }

  const exportToPDF = async () => {
    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions,
          categoryTotals,
          dateRange,
          reportType: "complete",
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `financial-reports-${dateRange.start}-${dateRange.end}.pdf`
        a.click()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export PDF",
        variant: "destructive",
      })
    }
  }

  const exportToExcel = async () => {
    try {
      const response = await fetch("/api/export/excel-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions,
          categoryTotals,
          dateRange,
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `financial-reports-${dateRange.start}-${dateRange.end}.xlsx`
        a.click()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export Excel",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Interactive Financial Reports</h2>
          <p className="text-muted-foreground">
            Live reports • Click any category to edit • {dateRange.start} to {dateRange.end}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setEditingMode(!editingMode)}
            className={editingMode ? "bg-accent" : ""}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            {editingMode ? "Exit Edit Mode" : "Edit Mode"}
          </Button>
          <Button variant="outline" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={exportToPDF}>
            <FileText className="h-4 w-4 mr-2" />
            PDF Report
          </Button>
        </div>
      </div>

      <Tabs defaultValue="income-statement" className="space-y-6">
        <TabsList>
          <TabsTrigger value="income-statement">Income Statement</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="category-analysis">Category Analysis</TabsTrigger>
          <TabsTrigger value="monthly-trends">Monthly Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="income-statement">
          <Card>
            <CardHeader>
              <CardTitle>Income Statement</CardTitle>
              <CardDescription>
                {dateRange.start} to {dateRange.end} • Click categories to edit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Revenue Section */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                    Revenue
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(revenueTotals)
                      .sort(([, a], [, b]) => b.amount - a.amount)
                      .map(([category, data]) => (
                        <div key={category} className="flex justify-between items-center group">
                          <div className="flex items-center gap-2">
                            {editingMode ? (
                              <EditableCell
                                value={category}
                                type="text"
                                onSave={(newCategory) => handleCategoryUpdate(category, newCategory)}
                              />
                            ) : (
                              <span className="text-muted-foreground">{category}</span>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {data.count} transactions
                            </Badge>
                          </div>
                          <span className="font-medium text-green-600">${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    {Object.keys(revenueTotals).length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No income transactions found</p>
                    )}
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total Revenue</span>
                      <span className="text-green-600">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Operating Expenses */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center">
                    <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
                    Operating Expenses
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(expenseTotals)
                      .sort(([, a], [, b]) => b.amount - a.amount)
                      .map(([category, data]) => (
                        <div key={category} className="flex justify-between items-center group">
                          <div className="flex items-center gap-2">
                            {editingMode ? (
                              <EditableCell
                                value={category}
                                type="text"
                                onSave={(newCategory) => handleCategoryUpdate(category, newCategory)}
                              />
                            ) : (
                              <span className="text-muted-foreground">{category}</span>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {data.count} transactions
                            </Badge>
                          </div>
                          <span className="font-medium">${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    {Object.keys(expenseTotals).length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No expense transactions found</p>
                    )}
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total Operating Expenses</span>
                      <span className="text-red-600">${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Net Income */}
                <div className="bg-primary/10 p-4 rounded-lg">
                  <div className="flex justify-between font-bold text-xl">
                    <span>Net Income (before SE Tax)</span>
                    <span className={netIncome >= 0 ? "text-green-600" : "text-red-600"}>
                      ${netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    SE Tax ≈ ${(netIncome * 0.9235 * 0.153).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} • Net after SE Tax ≈ ${(netIncome - netIncome * 0.9235 * 0.153).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category-analysis">
          <Card>
            <CardHeader>
              <CardTitle>Category Analysis</CardTitle>
              <CardDescription>Detailed breakdown by category with transaction counts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(categoryTotals)
                  .sort(([, a], [, b]) => b.amount - a.amount)
                  .map(([category, data]) => (
                    <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{category}</p>
                          <p className="text-sm text-muted-foreground">{data.transactions.length} transactions</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${data.amount.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">
                          Avg: ${(data.amount / data.transactions.length).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader>
              <CardTitle>Balance Sheet</CardTitle>
              <CardDescription>As of {dateRange.end}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center py-8 text-muted-foreground">
                  <p>Balance Sheet requires account balance data from connected accounts.</p>
                  <p>Connect your accounts to view real-time balance sheet information.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly-trends">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Trends</CardTitle>
              <CardDescription>Revenue and expense trends by month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>Monthly trend analysis coming soon.</p>
                <p>This will show revenue and expense patterns over time.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
