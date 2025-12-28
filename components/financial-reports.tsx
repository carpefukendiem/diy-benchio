"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, FileSpreadsheet, TrendingUp, TrendingDown } from "lucide-react"

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  account: string
  isIncome: boolean
}

interface FinancialReportsProps {
  transactions: Transaction[]
}

export function FinancialReports({ transactions }: FinancialReportsProps) {
  // Calculate financial data
  const calculateCategoryTotals = () => {
    const totals: Record<string, number> = {}

    transactions.forEach((transaction) => {
      const category = transaction.category
      if (!totals[category]) {
        totals[category] = 0
      }
      totals[category] += transaction.amount
    })

    return totals
  }

  const categoryTotals = calculateCategoryTotals()

  // Income Statement Data
  const revenueCategories = ["Sales Revenue", "Interest Income", "Other Income"]
  const expenseCategories = [
    "Software & Web Hosting Expense",
    "Business Meals Expense",
    "Gas & Auto Expense",
    "Bank & ATM Fee Expense",
    "Insurance Expense - Business",
    "Merchant Fees Expense",
    "Office Supply Expense",
    "Phone & Internet Expense",
    "Professional Service Expense",
  ]

  const totalRevenue = revenueCategories.reduce((sum, cat) => sum + (categoryTotals[cat] || 0), 0)
  const totalExpenses = expenseCategories.reduce((sum, cat) => sum + (categoryTotals[cat] || 0), 0)
  const netIncome = totalRevenue - totalExpenses

  // Balance Sheet Data (Mock - would come from account balances in real implementation)
  const balanceSheetData = {
    assets: {
      "Wells Fargo - Checking - 9898": 354.22,
      "Wells Fargo - Savings - 4174": 29.12,
      "Stripe - Merchant Processor": 498.81,
      "Money in transit": 0,
    },
    liabilities: {
      "Barclaycard - Credit Card - 2163": 3999.71,
      "Stripe Capital - Loan Payable": 6021.4,
    },
    equity: {
      "Member Contribution - Ruben Ruiz": 8679.15,
      "Member Drawing - Ruben Ruiz": -31304.25,
      "Retained Earnings": netIncome,
    },
  }

  const totalAssets = Object.values(balanceSheetData.assets).reduce((sum, val) => sum + val, 0)
  const totalLiabilities = Object.values(balanceSheetData.liabilities).reduce((sum, val) => sum + val, 0)
  const totalEquity = Object.values(balanceSheetData.equity).reduce((sum, val) => sum + val, 0)

  const exportToGoogleSheets = async () => {
    try {
      const response = await fetch("/api/export/google-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions,
          categoryTotals,
          balanceSheetData,
          netIncome,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        window.open(data.spreadsheetUrl, "_blank")
      }
    } catch (error) {
      console.error("Error exporting to Google Sheets:", error)
    }
  }

  const downloadFinancialPackage = () => {
    const financialData = {
      businessName: "Ranking SB",
      reportDate: new Date().toISOString().split("T")[0],
      incomeStatement: {
        revenue: revenueCategories.map((cat) => ({ category: cat, amount: categoryTotals[cat] || 0 })),
        expenses: expenseCategories.map((cat) => ({ category: cat, amount: categoryTotals[cat] || 0 })),
        netIncome,
      },
      balanceSheet: balanceSheetData,
      transactions,
    }

    const blob = new Blob([JSON.stringify(financialData, null, 2)], { type: "application/json" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ranking-sb-financial-package-${new Date().toISOString().split("T")[0]}.json`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Financial Reports</h2>
          <p className="text-muted-foreground">Comprehensive financial statements for Ranking SB</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToGoogleSheets}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export to Sheets
          </Button>
          <Button onClick={downloadFinancialPackage}>
            <Download className="h-4 w-4 mr-2" />
            Download Package
          </Button>
        </div>
      </div>

      <Tabs defaultValue="income-statement" className="space-y-6">
        <TabsList>
          <TabsTrigger value="income-statement">Income Statement</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="income-statement">
          <Card>
            <CardHeader>
              <CardTitle>Income Statement</CardTitle>
              <CardDescription>January 1, 2024 - December 31, 2024</CardDescription>
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
                    {revenueCategories.map((category) => (
                      <div key={category} className="flex justify-between">
                        <span className="text-muted-foreground">{category}</span>
                        <span className="font-medium">${(categoryTotals[category] || 0).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total Revenue</span>
                      <span className="text-green-600">${totalRevenue.toLocaleString()}</span>
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
                    {expenseCategories.map((category) => (
                      <div key={category} className="flex justify-between">
                        <span className="text-muted-foreground">{category}</span>
                        <span className="font-medium">${(categoryTotals[category] || 0).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total Operating Expenses</span>
                      <span className="text-red-600">${totalExpenses.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Net Income */}
                <div className="bg-primary/10 p-4 rounded-lg">
                  <div className="flex justify-between font-bold text-xl">
                    <span>Net Income</span>
                    <span className={netIncome >= 0 ? "text-green-600" : "text-red-600"}>
                      ${netIncome.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader>
              <CardTitle>Balance Sheet</CardTitle>
              <CardDescription>As of December 31, 2024</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Assets */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Assets</h3>
                  <div className="space-y-2">
                    {Object.entries(balanceSheetData.assets).map(([account, amount]) => (
                      <div key={account} className="flex justify-between">
                        <span className="text-muted-foreground">{account}</span>
                        <span className="font-medium">${amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total Assets</span>
                      <span>${totalAssets.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Liabilities */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Liabilities</h3>
                  <div className="space-y-2">
                    {Object.entries(balanceSheetData.liabilities).map(([account, amount]) => (
                      <div key={account} className="flex justify-between">
                        <span className="text-muted-foreground">{account}</span>
                        <span className="font-medium">${amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total Liabilities</span>
                      <span>${totalLiabilities.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Equity */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Equity</h3>
                  <div className="space-y-2">
                    {Object.entries(balanceSheetData.equity).map(([account, amount]) => (
                      <div key={account} className="flex justify-between">
                        <span className="text-muted-foreground">{account}</span>
                        <span className="font-medium">${amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total Equity</span>
                      <span>${totalEquity.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Balance Check */}
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex justify-between font-semibold">
                    <span>Total Liabilities + Equity</span>
                    <span>${(totalLiabilities + totalEquity).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
                      ? "✅ Balance sheet balances"
                      : "⚠️ Balance sheet does not balance"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-flow">
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Statement</CardTitle>
              <CardDescription>January 1, 2024 - December 31, 2024</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Operating Activities</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Net Income</span>
                      <span>${netIncome.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Net Cash from Operating Activities</span>
                      <span>${netIncome.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="text-center py-4 text-muted-foreground">
                  <p>Detailed cash flow analysis available with connected accounts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Total income for the period</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalExpenses.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Total expenses for the period</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className={netIncome >= 0 ? "text-green-600" : "text-red-600"}>Net Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${netIncome.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Profit for the period</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
