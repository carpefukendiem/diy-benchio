"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { TaxWizard } from "@/components/tax-wizard"
import { PlaidLinkButton } from "@/components/plaid-link-button"
import { AccountManagement } from "@/components/account-management"
import { InteractiveTransactionsList } from "@/components/interactive-transactions-list"
import { InteractiveReports } from "@/components/interactive-reports"
import { EthereumFix } from "@/components/ethereum-fix"
import {
  DollarSign,
  TrendingUp,
  FileText,
  CreditCard,
  RefreshCw,
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
  plaidTransactionId?: string
  merchantName?: string
  pending?: boolean
}

interface PlaidAccount {
  account_id: string
  name: string
  official_name?: string
  type: string
  subtype: string
  balance: number
  available_balance?: number
  currency_code: string
  institution_name: string
  institution_id: string
  item_id: string
  access_token: string
  last_sync: string
  status: "active" | "error" | "disconnected"
  error_message?: string
  mask?: string
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
  const [connectedAccounts, setConnectedAccounts] = useState<PlaidAccount[]>([])
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
      loadAccountData()
    }
  }, [])

  const loadAccountData = async () => {
    setIsLoading(true)
    try {
      // Load connected accounts
      const accountsResponse = await fetch("/api/plaid/accounts?user_id=user_main")
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json()
        setConnectedAccounts(accountsData.accounts)
      }

      // Load transactions
      const transactionsResponse = await fetch("/api/transactions/fetch")
      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json()
        setTransactions(transactionsData.transactions)
      }

      setLastSync(new Date().toLocaleString())
    } catch (error) {
      console.error("Error loading account data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleWizardComplete = (profile: TaxProfile) => {
    setTaxProfile(profile)
    setShowWizard(false)
    localStorage.setItem("taxProfile", JSON.stringify(profile))
    toast({
      title: "Accounting System Ready! 📊",
      description: `Welcome ${profile.name}! Your California business tax minimization system is configured.`,
    })
  }

  const handlePlaidSuccess = async (publicToken: string, metadata: any) => {
    setIsLoading(true)
    console.log("[v0] Plaid success, exchanging public token")
    try {
      const response = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Successfully exchanged token, received accounts:", data.accounts.length)
        setConnectedAccounts((prev) => [...prev, ...data.accounts])
        await fetchYearToDateTransactions(data.access_token)
        toast({
          title: "Account Connected",
          description: "Syncing your financial data for tax optimization...",
        })
      } else {
        const errorData = await response.json()
        console.error("[v0] Failed to exchange token:", errorData)
        toast({
          title: "Connection Error",
          description: errorData.details || "Failed to connect account. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error connecting account:", error)
      toast({
        title: "Connection Error",
        description: "Failed to connect account. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchYearToDateTransactions = async (accessToken?: string) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/plaid/transactions/year-to-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          start_date: dateRange.start,
          end_date: dateRange.end,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions)
        setLastSync(new Date().toLocaleString())
      }
    } catch (error) {
      console.error("Error fetching transactions:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefreshAccount = async (accountId: string) => {
    const account = connectedAccounts.find((acc) => acc.account_id === accountId)
    if (!account) return

    const response = await fetch("/api/plaid/accounts/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: accountId,
        access_token: account.access_token,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      setConnectedAccounts((prev) =>
        prev.map((acc) => (acc.account_id === accountId ? { ...acc, ...data.account } : acc)),
      )
    }
  }

  const handleRemoveAccount = async (accountId: string) => {
    const account = connectedAccounts.find((acc) => acc.account_id === accountId)
    if (!account) return

    const response = await fetch("/api/plaid/accounts/remove", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: accountId,
        item_id: account.item_id,
      }),
    })

    if (response.ok) {
      setConnectedAccounts((prev) => prev.filter((acc) => acc.account_id !== accountId))
      setTransactions((prev) => prev.filter((t) => t.account !== account.name))
    }
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
    setConnectedAccounts([])
    setTransactions([])
  }

  if (showWizard) {
    return (
      <>
        <EthereumFix />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 p-4">
          <TaxWizard onComplete={handleWizardComplete} />
        </div>
      </>
    )
  }

  // Calculate metrics
  const totalRevenue = transactions.filter((t) => t.isIncome).reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = transactions.filter((t) => !t.isIncome).reduce((sum, t) => sum + t.amount, 0)
  const netIncome = totalRevenue - totalExpenses
  const totalBalance = connectedAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  const estimatedTaxSavings = Math.round(totalExpenses * 0.35) // CA + Federal combined rate
  const estimatedTaxLiability = Math.max(0, Math.round(netIncome * 0.35) - estimatedTaxSavings)

  const getBusinessTypeIcon = () => {
    if (taxProfile?.businessType === "ghl_agency") return <Megaphone className="h-5 w-5 text-blue-500" />
    if (taxProfile?.businessType === "hair_stylist") return <Sparkles className="h-5 w-5 text-pink-500" />
    return <Building2 className="h-5 w-5 text-purple-500" />
  }

  const getBusinessTypeTitle = () => {
    if (taxProfile?.businessType === "ghl_agency") return "Digital Marketing Agency"
    if (taxProfile?.businessType === "hair_stylist") return "Hair Stylist Business"
    return "Multi-Business"
  }

  return (
    <>
      <EthereumFix />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {getBusinessTypeIcon()}
                  <h1 className="text-4xl font-bold text-gray-900">{taxProfile?.name}'s Business Accounting</h1>
                </div>
                <p className="text-lg text-gray-600 flex items-center gap-2">
                  {getBusinessTypeTitle()} • California Tax Optimization
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Shield className="h-3 w-3 mr-1" />
                    Tax Minimization Active
                  </Badge>
                </p>
                {lastSync && <p className="text-sm text-gray-500 mt-1">Last synced: {lastSync}</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetWizard}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Reconfigure
                </Button>
                <Button variant="outline" onClick={() => fetchYearToDateTransactions()} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                  Sync All Data
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connected Accounts</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{connectedAccounts.length}</div>
                <p className="text-xs text-muted-foreground">
                  {connectedAccounts.length === 0 ? "Connect accounts" : "Active connections"}
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
                <div className="text-2xl font-bold text-green-600">${estimatedTaxSavings.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">From deductions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Est. Tax Liability</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${estimatedTaxLiability <= 1000 ? "text-green-600" : "text-orange-600"}`}
                >
                  ${estimatedTaxLiability.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">After deductions</p>
              </CardContent>
            </Card>
          </div>

          {/* Tax Minimization Alert */}
          {estimatedTaxLiability <= 1000 && totalExpenses > 0 && (
            <Card className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-800">Excellent Tax Optimization! 🎉</h3>
                    <p className="text-sm text-green-700">
                      Your deductions have minimized your tax liability to ${estimatedTaxLiability.toLocaleString()}.
                      You are saving approximately ${estimatedTaxSavings.toLocaleString()} in taxes!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content */}
          <Tabs defaultValue="accounts" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="accounts">Account Management</TabsTrigger>
              <TabsTrigger value="transactions">Transaction Processing</TabsTrigger>
              <TabsTrigger value="reports">Tax Reports</TabsTrigger>
              <TabsTrigger value="deductions">Deduction Tracking</TabsTrigger>
            </TabsList>

            <TabsContent value="accounts">
              <div className="space-y-6">
                {connectedAccounts.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Connect Your Business Accounts</CardTitle>
                      <CardDescription>
                        Connect all your business bank accounts, credit cards, and payment processors to automatically
                        import and categorize your 2025 financial data for maximum tax deductions.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PlaidLinkButton onSuccess={handlePlaidSuccess} isLoading={isLoading} />
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Add Additional Accounts</CardTitle>
                      <CardDescription>
                        Connect more business accounts to ensure complete financial data coverage for tax optimization.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PlaidLinkButton onSuccess={handlePlaidSuccess} isLoading={isLoading} />
                    </CardContent>
                  </Card>
                )}

                <AccountManagement
                  accounts={connectedAccounts}
                  onAccountUpdate={setConnectedAccounts}
                  onRefreshAccount={handleRefreshAccount}
                  onRemoveAccount={handleRemoveAccount}
                />
              </div>
            </TabsContent>

            <TabsContent value="transactions">
              {transactions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Financial Data Yet</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Connect your business accounts to automatically import and categorize your transactions for
                      maximum tax deductions.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <InteractiveTransactionsList
                  transactions={transactions}
                  onUpdateTransaction={updateTransaction}
                  onBulkUpdate={bulkUpdateTransactions}
                  onRefresh={() => fetchYearToDateTransactions()}
                  isLoading={isLoading}
                />
              )}
            </TabsContent>

            <TabsContent value="reports">
              {transactions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Tax Reports Ready When You Are</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Once you connect accounts and import transactions, your comprehensive tax reports will be
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

            <TabsContent value="deductions">
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
                          const taxSavings = Math.round(totalAmount * 0.35) // CA + Federal rate

                          return (
                            <Card key={deduction} className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <h4 className="font-semibold text-sm mb-2 line-clamp-2">{deduction}</h4>
                                <div className="text-2xl font-bold text-blue-600 mb-1">${totalAmount.toFixed(2)}</div>
                                <div className="text-sm text-green-600 font-medium mb-2">
                                  Tax Savings: ${taxSavings.toFixed(2)}
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
                          <span className="font-bold text-green-600">${estimatedTaxSavings.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                          <span className="font-medium">Remaining Tax Liability:</span>
                          <span className="font-bold text-orange-600">${estimatedTaxLiability.toLocaleString()}</span>
                        </div>
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
