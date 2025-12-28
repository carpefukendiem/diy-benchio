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
  accountType: "bank" | "credit_card"
  month: string
  year: string
  fileName: string
  uploadDate: string
  transactions: Transaction[]
  status: "processed" | "error"
}

interface TaxProfile {
  name: string
  businessType: "hair_stylist" | "ghl_agency" | "both"
  filingStatus: "married_joint" | "married_separate" | "single"
  hasEmployees: boolean
  businessStructure: "sole_proprietor" | "llc" | "s_corp" | "partnership"
  estimatedIncome: string
  specialDeductions: string[]
  clientCount?: string
  serviceTypes?: string[]
}

export default function CaliforniaBusinessAccounting() {
  const [taxProfile, setTaxProfile] = useState<TaxProfile | null>(null)
  const [showWizard, setShowWizard] = useState(true)
  const [uploadedStatements, setUploadedStatements] = useState<UploadedStatement[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastSync, setLastSync] = useState<string>("")
  const [dateRange, setDateRange] = useState({ start: "2025-01-01", end: "2025-12-31" })
  const { toast } = useToast()

  // Check if user has completed setup
  useEffect(() => {
    const savedProfile = localStorage.getItem("taxProfile")
    if (savedProfile) {
      setTaxProfile(JSON.parse(savedProfile))
      setShowWizard(false)
    }
  }, [])

  useEffect(() => {
    const allTransactions = uploadedStatements.flatMap((statement) => statement.transactions)
    setTransactions(allTransactions)
  }, [uploadedStatements])

  const handleWizardComplete = (profile: TaxProfile) => {
    setTaxProfile(profile)
    setShowWizard(false)
    localStorage.setItem("taxProfile", JSON.stringify(profile))
    toast({
      title: "Accounting System Ready",
      description: `Welcome ${profile.name}! Your California business tax minimization system is configured.`,
    })
  }

  const updateTransaction = async (transactionId: string, updates: Partial<Transaction>) => {
    try {
      const response = await fetch("/api/transactions/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transactionId, updates }),
      })

      if (response.ok) {
        setTransactions((prev) => prev.map((t) => (t.id === transactionId ? { ...t, ...updates } : t)))
      }
    } catch (error) {
      console.error("Error updating transaction:", error)
    }
  }

  const bulkUpdateTransactions = async (updates: Array<{ id: string; updates: Partial<Transaction> }>) => {
    try {
      const response = await fetch("/api/transactions/bulk-update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })

      if (response.ok) {
        updates.forEach(({ id, updates: transactionUpdates }) => {
          setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...transactionUpdates } : t)))
        })
      }
    } catch (error) {
      console.error("Error bulk updating transactions:", error)
    }
  }

  const resetWizard = () => {
    localStorage.removeItem("taxProfile")
    setTaxProfile(null)
    setShowWizard(true)
    setUploadedStatements([])
    setTransactions([])
  }

  const totalBalance = uploadedStatements.reduce((sum, statement) => {
    const statementBalance = statement.transactions.reduce((acc, t) => acc + (t.isIncome ? t.amount : -t.amount), 0)
    return sum + statementBalance
  }, 0)

  const totalRevenue = transactions.filter((t) => t.isIncome).reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = transactions.filter((t) => !t.isIncome).reduce((sum, t) => sum + t.amount, 0)

  const taxSavings = totalExpenses * 0.35

  const estimatedTaxLiability = Math.max(0, (totalRevenue - totalExpenses) * 0.35)

  const getBusinessTypeIcon = () => {
    if (taxProfile?.businessType === "ghl_agency") return <Megaphone className="h-5 w-5 text-primary" />
    if (taxProfile?.businessType === "hair_stylist") return <Sparkles className="h-5 w-5 text-pink-500" />
    return <Building2 className="h-5 w-5 text-purple-500" />
  }

  const getBusinessTypeTitle = () => {
    if (taxProfile?.businessType === "ghl_agency") return "Digital Marketing Agency"
    if (taxProfile?.businessType === "hair_stylist") return "Hair Stylist Business"
    return "Multi-Business"
  }

  if (showWizard) {
    return (
      <>
        <EthereumFix />
        <TaxWizard onComplete={handleWizardComplete} />
      </>
    )
  }

  return (
    <>
      <EthereumFix />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {getBusinessTypeIcon()}
                  <h1 className="text-4xl font-bold">{taxProfile?.name}'s Business Accounting</h1>
                </div>
                <p className="text-lg text-muted-foreground flex items-center gap-2">
                  {getBusinessTypeTitle()} • California Tax Optimization
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Shield className="h-3 w-3 mr-1" />
                    Tax Minimization Active
                  </Badge>
                </p>
                {lastSync && <p className="text-sm text-muted-foreground mt-1">Last synced: {lastSync}</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetWizard}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Reconfigure
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uploaded Statements</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{uploadedStatements.length}</div>
                <p className="text-xs text-muted-foreground">
                  {uploadedStatements.length === 0 ? "Upload statements" : "Statements processed"}
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
                  {transactions.filter((t) => !t.isIncome).length} transactions
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

          {/* Main Content */}
          <Tabs defaultValue="statements" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="statements">Statements</TabsTrigger>
              <TabsTrigger value="transactions">Transaction Processing</TabsTrigger>
              <TabsTrigger value="reports">Tax Reports</TabsTrigger>
              <TabsTrigger value="deductions">Deduction Tracking</TabsTrigger>
            </TabsList>

            <TabsContent value="statements" className="space-y-6">
              <StatementUploader existingStatements={uploadedStatements} onStatementsUpdate={setUploadedStatements} />
            </TabsContent>

            <TabsContent value="transactions" className="space-y-6">
              {transactions.length === 0 ? (
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
                  transactions={transactions}
                  onUpdateTransaction={updateTransaction}
                  onBulkUpdate={bulkUpdateTransactions}
                  onRefresh={() => {}}
                  isLoading={isLoading}
                />
              )}
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              {transactions.length === 0 ? (
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
                  transactions={transactions}
                  onUpdateTransaction={updateTransaction}
                  dateRange={dateRange}
                />
              )}
            </TabsContent>

            <TabsContent value="deductions" className="space-y-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Deduction Tracking & Optimization</CardTitle>
                    <CardDescription>
                      Monitor your {taxProfile?.specialDeductions?.length || 0} configured deduction categories to
                      maximize tax savings and minimize your California tax liability.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {taxProfile?.specialDeductions && taxProfile.specialDeductions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {taxProfile.specialDeductions.map((deduction) => {
                          const relatedTransactions = transactions.filter(
                            (t) =>
                              !t.isIncome &&
                              (t.category.toLowerCase().includes(deduction.toLowerCase()) ||
                                t.description.toLowerCase().includes(deduction.toLowerCase()) ||
                                deduction.toLowerCase().includes(t.category.toLowerCase())),
                          )
                          const totalAmount = relatedTransactions.reduce((sum, t) => sum + t.amount, 0)
                          const savings = Math.round(totalAmount * 0.35) // CA + Federal rate

                          return (
                            <Card key={deduction} className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <h4 className="font-semibold text-sm mb-2 line-clamp-2">{deduction}</h4>
                                <div className="text-2xl font-bold text-blue-600 mb-1">${totalAmount.toFixed(2)}</div>
                                <div className="text-sm text-green-600 font-medium mb-2">
                                  Tax Savings: ${savings.toFixed(2)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {relatedTransactions.length} transactions • 2025 YTD
                                </p>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          No deduction categories configured. Reconfigure your system to set up deduction tracking.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>California Tax Optimization Summary</CardTitle>
                    <CardDescription>Your current tax minimization performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                          <span className="font-medium">Total Deductible Expenses:</span>
                          <span className="font-bold text-blue-600">${totalExpenses.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                          <span className="font-medium">Estimated Tax Savings:</span>
                          <span className="font-bold text-green-600">${taxSavings.toLocaleString()}</span>
                        </div>
                        {/* Placeholder for other metrics if needed */}
                      </div>
                      <div className="space-y-3">
                        <h4 className="font-semibold">Optimization Tips:</h4>
                        <ul className="text-sm space-y-2">
                          <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">•</span>
                            <span>Review uncategorized transactions for additional deductions</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">•</span>
                            <span>Consider equipment purchases before year-end for Section 179 deductions</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">•</span>
                            <span>Maximize retirement contributions to reduce current year taxes</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">•</span>
                            <span>Document home office expenses if working from home</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}
