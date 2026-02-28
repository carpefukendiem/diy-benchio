"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { InteractiveTransactionsList } from "@/components/interactive-transactions-list"
import { InteractiveReports } from "@/components/interactive-reports"
import { EthereumFix } from "@/components/ethereum-fix"
import { StatementUploader } from "@/components/statement-uploader"
import { TaxWizard } from "@/components/tax-wizard"
import { BusinessSelector } from "@/components/business-selector"
import {
  DollarSign,
  TrendingUp,
  FileText,
  Sparkles,
  Megaphone,
  Calculator,
  TrendingDown,
  Shield,
  Building2,
  Plus,
} from "lucide-react"
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
  pending?: boolean
}

interface UploadedStatement {
  id: string
  accountName: string
  accountType: "bank" | "credit_card" | "personal" | "investment"
  month: string
  year: string
  fileName: string
  uploadDate: string
  transactions: Transaction[]
  status: "processed" | "error"
}

interface BusinessData {
  id: string
  profile: TaxProfile
  uploadedStatements: UploadedStatement[]
  transactions: Transaction[]
  lastSync: string
}

interface TaxProfile {
  businessName: string
  businessType: string
  entityType: string
  deductions: string[]
}

export default function CaliforniaBusinessAccounting() {
  const [businesses, setBusinesses] = useState<BusinessData[]>([])
  const [currentBusinessId, setCurrentBusinessId] = useState<string>("")
  const [showWizard, setShowWizard] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState("statements")
  const currentBusiness = businesses.find((b) => b.id === currentBusinessId)

  const handleWizardComplete = (profile: TaxProfile) => {
    const newBusiness: BusinessData = {
      id: Date.now().toString(),
      profile: {
        businessName: profile.businessName,
        businessType: profile.businessType,
        entityType: profile.entityType,
        deductions: profile.deductions,
      },
      uploadedStatements: [],
      transactions: [],
      lastSync: "",
    }

    setBusinesses((prev) => [...prev, newBusiness])
    setCurrentBusinessId(newBusiness.id)
    setShowWizard(false)

    toast({
      title: "Business Added Successfully",
      description: `${profile.businessName} is now configured for tax optimization.`,
    })
  }

  const handleAddBusiness = () => {
    setShowWizard(true)
  }

  const handleSelectBusiness = (id: string) => {
    setCurrentBusinessId(id)
    toast({
      title: "Switched Business",
      description: `Now viewing ${businesses.find((b) => b.id === id)?.profile.businessName}`,
    })
  }

  const updateCurrentBusiness = (updates: Partial<BusinessData>) => {
    setBusinesses((prev) => prev.map((b) => (b.id === currentBusinessId ? { ...b, ...updates } : b)))
  }

  const updateTransaction = async (transactionId: string, updates: Partial<Transaction>) => {
    if (!currentBusiness) return

    const updatedTransactions = currentBusiness.transactions.map((t) =>
      t.id === transactionId ? { ...t, ...updates } : t,
    )
    updateCurrentBusiness({ transactions: updatedTransactions })
  }

  const bulkUpdateTransactions = async (updates: Array<{ id: string; updates: Partial<Transaction> }>) => {
    if (!currentBusiness) return

    let updatedTransactions = [...currentBusiness.transactions]
    updates.forEach(({ id, updates: transactionUpdates }) => {
      updatedTransactions = updatedTransactions.map((t) => (t.id === id ? { ...t, ...transactionUpdates } : t))
    })
    updateCurrentBusiness({ transactions: updatedTransactions })
  }

  const handleStatementsUpdate = (statements: UploadedStatement[]) => {
    const allTransactions = statements.flatMap((statement) => statement.transactions)
    updateCurrentBusiness({
      uploadedStatements: statements,
      transactions: allTransactions,
      lastSync: new Date().toLocaleString(),
    })
  }

  const handleContinueToTransactions = () => {
    setActiveTab("transactions")
    toast({
      title: "Ready to Process",
      description: "Review and categorize your transactions for maximum tax deductions",
    })
  }

  const totalBalance = currentBusiness
    ? currentBusiness.uploadedStatements.reduce((sum, statement) => {
        const statementBalance = statement.transactions.reduce((acc, t) => acc + (t.isIncome ? t.amount : -t.amount), 0)
        return sum + statementBalance
      }, 0)
    : 0

  const totalRevenue = currentBusiness
    ? currentBusiness.transactions.filter((t) => t.isIncome).reduce((sum, t) => sum + t.amount, 0)
    : 0

  const totalExpenses = currentBusiness
    ? currentBusiness.transactions.filter((t) => !t.isIncome).reduce((sum, t) => sum + t.amount, 0)
    : 0

  const taxSavings = totalExpenses * 0.35
  const estimatedTaxLiability = Math.max(0, (totalRevenue - totalExpenses) * 0.35)

  const getBusinessTypeIcon = () => {
    if (!currentBusiness) return <Building2 className="h-5 w-5" />
    if (currentBusiness.profile.businessType === "gohighlevel-agency")
      return <Megaphone className="h-5 w-5 text-primary" />
    if (currentBusiness.profile.businessType === "hair-stylist") return <Sparkles className="h-5 w-5 text-pink-500" />
    return <Building2 className="h-5 w-5 text-purple-500" />
  }

  const getBusinessTypeTitle = () => {
    if (!currentBusiness) return ""
    if (currentBusiness.profile.businessType === "gohighlevel-agency") return "Digital Marketing Agency"
    if (currentBusiness.profile.businessType === "hair-stylist") return "Hair Stylist Business"
    return "Business"
  }

  useEffect(() => {
    const savedBusinesses = localStorage.getItem("businesses")
    if (savedBusinesses) {
      const parsedBusinesses = JSON.parse(savedBusinesses)
      setBusinesses(parsedBusinesses)
      if (parsedBusinesses.length > 0) {
        const lastBusinessId = localStorage.getItem("lastBusinessId")
        setCurrentBusinessId(lastBusinessId || parsedBusinesses[0].id)
        setShowWizard(false)
      }
    }
  }, [])

  useEffect(() => {
    if (businesses.length > 0) {
      localStorage.setItem("businesses", JSON.stringify(businesses))
    }
  }, [businesses])

  useEffect(() => {
    if (currentBusinessId) {
      localStorage.setItem("lastBusinessId", currentBusinessId)
    }
  }, [currentBusinessId])

  if (showWizard) {
    return (
      <>
        <EthereumFix />
        <div className="min-h-screen bg-background">
          {businesses.length > 0 && (
            <div className="container mx-auto px-4 py-4">
              <Button variant="ghost" onClick={() => setShowWizard(false)}>
                ← Back to Dashboard
              </Button>
            </div>
          )}
          <TaxWizard onComplete={handleWizardComplete} />
        </div>
      </>
    )
  }

  if (!currentBusiness) {
    return (
      <>
        <EthereumFix />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Business Selected</h3>
              <p className="text-muted-foreground mb-4">Add a business to get started</p>
              <Button onClick={handleAddBusiness}>
                <Plus className="h-4 w-4 mr-2" />
                Add Business
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <EthereumFix />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {getBusinessTypeIcon()}
                  <h1 className="text-4xl font-bold">{currentBusiness.profile.businessName}</h1>
                </div>
                <div className="text-lg text-muted-foreground flex items-center gap-2">
                  {getBusinessTypeTitle()} • California Tax Optimization
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Shield className="h-3 w-3 mr-1" />
                    Tax Minimization Active
                  </Badge>
                </div>
                {currentBusiness.lastSync && (
                  <p className="text-sm text-muted-foreground mt-1">Last synced: {currentBusiness.lastSync}</p>
                )}
              </div>
              <div className="flex gap-2">
                <BusinessSelector
                  businesses={businesses.map((b) => ({
                    id: b.id,
                    name: b.profile.businessName,
                    type: b.profile.businessType,
                  }))}
                  currentBusinessId={currentBusinessId}
                  onSelectBusiness={handleSelectBusiness}
                  onAddBusiness={handleAddBusiness}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uploaded Statements</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentBusiness.uploadedStatements.length}</div>
                <p className="text-xs text-muted-foreground">
                  {currentBusiness.uploadedStatements.length === 0 ? "Upload statements" : "Statements processed"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalBalance.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">All accounts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">2025 Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Gross income</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Deductible Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">${totalExpenses.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {currentBusiness.transactions.filter((t) => !t.isIncome).length} transactions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tax Savings</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${taxSavings.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">From deductions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Est. Tax Liability</CardTitle>
                <Calculator className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">${estimatedTaxLiability.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">After deductions</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="statements">Statements</TabsTrigger>
              <TabsTrigger value="transactions">Transaction Processing</TabsTrigger>
              <TabsTrigger value="reports">Tax Reports</TabsTrigger>
              <TabsTrigger value="deductions">Deduction Tracking</TabsTrigger>
            </TabsList>

            <TabsContent value="statements" className="space-y-6">
              <StatementUploader
                existingStatements={currentBusiness.uploadedStatements}
                onStatementsUpdate={handleStatementsUpdate}
                onContinue={handleContinueToTransactions}
              />
            </TabsContent>

            <TabsContent value="transactions" className="space-y-6">
              {currentBusiness.transactions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Financial Data Yet</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Upload your business statements to automatically import and categorize your transactions for
                      maximum tax deductions.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <InteractiveTransactionsList
                  transactions={currentBusiness.transactions}
                  onUpdateTransaction={updateTransaction}
                  onBulkUpdate={bulkUpdateTransactions}
                  onRefresh={() => {}}
                  isLoading={isLoading}
                />
              )}
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              {currentBusiness.transactions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Tax Reports Ready When You Are</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Once you upload statements and import transactions, your comprehensive tax reports will be
                      generated automatically.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <InteractiveReports
                  transactions={currentBusiness.transactions}
                  onUpdateTransaction={updateTransaction}
                  dateRange={{ start: "2025-01-01", end: "2025-12-31" }}
                />
              )}
            </TabsContent>

            <TabsContent value="deductions" className="space-y-6">
              {(() => {
                // Compute per-category expense totals from real transactions
                const personalOrTransfer = new Set([
                  "Internal Transfer", "Credit Card Payment", "Member Drawing - Ruben Ruiz",
                  "Member Contribution - Ruben Ruiz", "Personal Expense", "Personal - Groceries",
                  "Personal - Entertainment", "Personal - Shopping", "Personal - Food & Drink",
                  "Personal - Health", "ATM Withdrawal", "Zelle / Venmo Transfer", "Crypto / Investments",
                ])
                const expenseByCat: Record<string, { amount: number; count: number }> = {}
                currentBusiness.transactions.forEach((t) => {
                  if (t.isIncome || personalOrTransfer.has(t.category)) return
                  if (!expenseByCat[t.category]) expenseByCat[t.category] = { amount: 0, count: 0 }
                  expenseByCat[t.category].amount += t.amount
                  expenseByCat[t.category].count++
                })
                const sortedCategories = Object.entries(expenseByCat).sort(([, a], [, b]) => b.amount - a.amount)
                const uncategorizedCount = currentBusiness.transactions.filter(
                  (t) => !t.isIncome && t.category === "Uncategorized Expense"
                ).length
                const netProfit = totalRevenue - totalExpenses
                const seTax = Math.max(0, netProfit) * 0.9235 * 0.153
                const estIncomeTax = Math.max(0, netProfit - seTax * 0.5) * 0.22
                const totalTax = seTax + estIncomeTax

                return (
                  <div className="space-y-6">
                    {/* Schedule C Summary */}
                    <Card className="border-green-200 bg-green-50/30">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Calculator className="h-5 w-5 text-green-600" />
                          Schedule C Tax Summary (2025 YTD)
                        </CardTitle>
                        <CardDescription>Self-employment tax calculation based on uploaded statements</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-3 bg-white rounded-lg border">
                            <p className="text-xs text-muted-foreground mb-1">Gross Revenue</p>
                            <p className="text-xl font-bold text-green-600">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border">
                            <p className="text-xs text-muted-foreground mb-1">Total Deductions</p>
                            <p className="text-xl font-bold text-blue-600">${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border">
                            <p className="text-xs text-muted-foreground mb-1">Net Profit (Sch. C)</p>
                            <p className={`text-xl font-bold ${netProfit >= 0 ? "text-orange-600" : "text-green-600"}`}>${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border">
                            <p className="text-xs text-muted-foreground mb-1">Est. Total Tax Owed</p>
                            <p className="text-xl font-bold text-red-600">${totalTax.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                            <p className="text-xs text-muted-foreground">SE: ${seTax.toFixed(0)} + Income: ${estIncomeTax.toFixed(0)}</p>
                          </div>
                        </div>
                        {uncategorizedCount > 0 && (
                          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                            <span className="text-amber-600 font-medium">{uncategorizedCount} uncategorized transactions</span>
                            <span className="text-sm text-muted-foreground">— review in Transaction Processing tab to capture more deductions</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Per-Category Deduction Breakdown */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Deductions by Category</CardTitle>
                        <CardDescription>All business expense categories from your uploaded statements</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {sortedCategories.length > 0 ? (
                          <div className="space-y-3">
                            {sortedCategories.map(([category, data]) => {
                              const savings = data.amount * 0.35
                              const pct = totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0
                              return (
                                <div key={category} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="font-medium text-sm truncate">{category}</p>
                                      <div className="flex items-center gap-3 ml-2 shrink-0">
                                        <span className="text-xs text-muted-foreground">{data.count} txns</span>
                                        <span className="text-sm text-green-600 font-medium">saves ~${savings.toFixed(0)}</span>
                                        <span className="font-bold">${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-1.5">
                                      <div
                                        className="bg-blue-500 h-1.5 rounded-full"
                                        style={{ width: `${Math.min(100, pct)}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">
                              Upload business statements to see deduction breakdown
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Optimization Tips */}
                    <Card>
                      <CardHeader>
                        <CardTitle>California Tax Optimization Tips</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-3">
                            <div className="p-3 bg-blue-50 rounded-lg">
                              <p className="font-semibold text-blue-800 mb-1">SEP-IRA Contribution</p>
                              <p className="text-blue-700">Contribute up to 25% of net profit (max $69,000) to a SEP-IRA before filing deadline. Reduces both income and SE tax.</p>
                              {netProfit > 0 && <p className="font-bold text-blue-800 mt-1">Your max: ${Math.min(netProfit * 0.25, 69000).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>}
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg">
                              <p className="font-semibold text-green-800 mb-1">Home Office (Form 8829)</p>
                              <p className="text-green-700">Simplified method: $5/sq ft up to 300 sq ft = $1,500/yr. Requires dedicated space used regularly and exclusively for business.</p>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-lg">
                              <p className="font-semibold text-purple-800 mb-1">Self-Employed Health Insurance</p>
                              <p className="text-purple-700">100% of health/dental/vision premiums deductible on Schedule 1 (not Sch. C). Reduces adjusted gross income directly.</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="p-3 bg-amber-50 rounded-lg">
                              <p className="font-semibold text-amber-800 mb-1">Vehicle Mileage (70¢/mile)</p>
                              <p className="text-amber-700">Track every business mile. Client meetings, supply runs, networking events all qualify. Use MileIQ or Everlance app.</p>
                            </div>
                            <div className="p-3 bg-rose-50 rounded-lg">
                              <p className="font-semibold text-rose-800 mb-1">Section 179 Equipment</p>
                              <p className="text-rose-700">100% first-year deduction on computers, phones, cameras, and other business equipment up to $1.22M. Must be purchased and in service by Dec 31.</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                              <p className="font-semibold text-slate-800 mb-1">Quarterly Estimated Taxes</p>
                              <p className="text-slate-700">Pay estimated taxes Apr 15, Jun 15, Sep 15, Jan 15 to avoid underpayment penalty.
                                {netProfit > 0 && <span className="font-bold"> Each quarter: ~${(totalTax / 4).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })()}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}
