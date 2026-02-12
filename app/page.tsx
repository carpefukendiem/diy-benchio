"use client"

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { EthereumFix } from "@/components/ethereum-fix"
import { BusinessSelector } from "@/components/business-selector"
import { SaveIndicator } from "@/components/save-indicator"
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
  Loader2,
  RefreshCw,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

import { BUILT_IN_RULES, CATEGORY_ID_TO_NAME } from "@/lib/categorization/rules-engine"

// Lazy load heavy tab components — only loads when user clicks that tab
const StatementUploader = lazy(() => import("@/components/statement-uploader").then(m => ({ default: m.StatementUploader })))
const InteractiveTransactionsList = lazy(() => import("@/components/interactive-transactions-list").then(m => ({ default: m.InteractiveTransactionsList })))
const InteractiveReports = lazy(() => import("@/components/interactive-reports").then(m => ({ default: m.InteractiveReports })))
const TaxWizard = lazy(() => import("@/components/tax-wizard").then(m => ({ default: m.TaxWizard })))
const ReceiptUploader = lazy(() => import("@/components/receipt-uploader").then(m => ({ default: m.ReceiptUploader })))

function TabLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

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

interface BusinessData {
  id: string
  profile: TaxProfile
  uploadedStatements: UploadedStatement[]
  transactions: Transaction[]
  receipts: any[]
  lastSync: string
}

interface TaxProfile {
  businessName: string
  businessType: string
  entityType: string
  deductions: string[]
}

// Debounced localStorage save — prevents lag from serializing on every keystroke
let saveTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSave(key: string, value: any, delay = 500) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      console.warn("localStorage save failed:", e)
    }
  }, delay)
}

export default function CaliforniaBusinessAccounting() {
  const [businesses, setBusinesses] = useState<BusinessData[]>([])
  const [currentBusinessId, setCurrentBusinessId] = useState<string>("")
  const [showWizard, setShowWizard] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState("statements")
  const currentBusiness = useMemo(
    () => businesses.find((b) => b.id === currentBusinessId),
    [businesses, currentBusinessId]
  )

  // Load from localStorage once on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("businesses")
      if (saved) {
        const parsed = JSON.parse(saved)
        setBusinesses(parsed)
        if (parsed.length > 0) {
          const lastId = localStorage.getItem("lastBusinessId")
          setCurrentBusinessId(lastId || parsed[0].id)
          setShowWizard(false)
        }
      }
    } catch (e) {
      console.warn("Failed to load saved data:", e)
    }
    setIsHydrated(true)
  }, [])

  // Debounced save to localStorage
  useEffect(() => {
    if (!isHydrated || businesses.length === 0) return
    debouncedSave("businesses", businesses)
  }, [businesses, isHydrated])

  useEffect(() => {
    if (currentBusinessId) {
      localStorage.setItem("lastBusinessId", currentBusinessId)
    }
  }, [currentBusinessId])

  const handleWizardComplete = useCallback((profile: TaxProfile) => {
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
      receipts: [],
      lastSync: "",
    }

    setBusinesses((prev) => [...prev, newBusiness])
    setCurrentBusinessId(newBusiness.id)
    setShowWizard(false)

    toast({
      title: "Business Added Successfully",
      description: `${profile.businessName} is now configured for tax optimization.`,
    })
  }, [toast])

  const handleAddBusiness = useCallback(() => {
    setShowWizard(true)
  }, [])

  const handleSelectBusiness = useCallback((id: string) => {
    setCurrentBusinessId(id)
    toast({
      title: "Switched Business",
      description: `Now viewing ${businesses.find((b) => b.id === id)?.profile.businessName}`,
    })
  }, [businesses, toast])

  const updateCurrentBusiness = useCallback((updates: Partial<BusinessData>) => {
    setBusinesses((prev) => prev.map((b) => (b.id === currentBusinessId ? { ...b, ...updates } : b)))
  }, [currentBusinessId])

  const updateTransaction = useCallback(async (transactionId: string, updates: Partial<Transaction>) => {
    setBusinesses((prev) =>
      prev.map((b) =>
        b.id === currentBusinessId
          ? {
              ...b,
              transactions: b.transactions.map((t) =>
                t.id === transactionId ? { ...t, ...updates } : t
              ),
            }
          : b
      )
    )
  }, [currentBusinessId])

  const bulkUpdateTransactions = useCallback(async (updates: Array<{ id: string; updates: Partial<Transaction> }>) => {
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id !== currentBusinessId) return b
        const updateMap = new Map(updates.map(u => [u.id, u.updates]))
        return {
          ...b,
          transactions: b.transactions.map((t) => {
            const u = updateMap.get(t.id)
            return u ? { ...t, ...u } : t
          }),
        }
      })
    )
  }, [currentBusinessId])

  const handleStatementsUpdate = useCallback((statements: UploadedStatement[]) => {
    const allTransactions = statements.flatMap((statement) => statement.transactions)
    updateCurrentBusiness({
      uploadedStatements: statements,
      transactions: allTransactions,
      lastSync: new Date().toLocaleString(),
    })
  }, [updateCurrentBusiness])

  const handleContinueToTransactions = useCallback(() => {
    setActiveTab("transactions")
    toast({
      title: "Ready to Process",
      description: "Review and categorize your transactions for maximum tax deductions",
    })
  }, [toast])

  // Re-categorize all transactions using latest rules (client-side)
  const handleRecategorize = useCallback((forceAll = false) => {
    if (!currentBusiness || currentBusiness.transactions.length === 0) {
      toast({ title: "No transactions", description: "Upload statements first" })
      return
    }

    // Use the single source of truth rules engine (369+ rules + smart fallback)
    let updated = 0
    const newTransactions = currentBusiness.transactions.map(t => {
      // Skip user-categorized transactions unless forceAll (don't override manual edits)
      if (!forceAll && t.category && t.category !== "Uncategorized Expense" && t.category !== "") {
        // But DO check if Upwork income is miscategorized
        const dl = t.description.toLowerCase()
        if (dl.includes("upwork") && !t.isIncome) {
          updated++
          return { ...t, category: "Freelance Income", isIncome: true }
        }
        return t
      }

      const dl = t.description.toLowerCase()
      
      // Try all built-in rules from the rules engine
      for (const rule of BUILT_IN_RULES) {
        let matched = false
        if (rule.match === 'contains') matched = dl.includes(rule.pattern)
        else if (rule.match === 'starts_with') matched = dl.startsWith(rule.pattern)
        
        if (matched) {
          const catInfo = CATEGORY_ID_TO_NAME[rule.category_id]
          if (catInfo) {
            updated++
            return {
              ...t,
              category: catInfo.name,
              isIncome: catInfo.isIncome,
            }
          }
        }
      }

      // Smart fallback — try keyword heuristics before leaving uncategorized
      const amount = t.amount || 0
      const absAmount = Math.abs(amount)

      // Credits/deposits
      if (amount > 0) {
        if (dl.includes('payment') || dl.includes('credit') || dl.includes('refund')) {
          updated++
          return { ...t, category: "Credit Card Payment", isIncome: false }
        }
        if (amount > 500) {
          updated++
          return { ...t, category: "Other Income", isIncome: true }
        }
        updated++
        return { ...t, category: "Refunds Given", isIncome: true }
      }

      // Debits with keyword hints
      if (dl.includes('fee') || dl.includes('charge') || dl.includes('penalty')) {
        updated++
        return { ...t, category: "Bank & ATM Fee Expense", isIncome: false }
      }
      if (dl.includes('dlr ') || dl.includes('dlr*')) {
        updated++
        return { ...t, category: "Client Gifts", isIncome: false }
      }

      // POS purchases: small ones → Office Supplies, larger → Personal Shopping
      if (dl.includes('purchase authorized') || dl.includes('pos purchase') || dl.includes('pos debit')) {
        updated++
        if (absAmount < 50) {
          return { ...t, category: "Office Supplies", isIncome: false }
        }
        return { ...t, category: "Personal - Shopping", isIncome: false }
      }

      // Short merchant names with state abbreviations → likely restaurant
      if (absAmount < 30 && dl.length < 40 && /\b(ca|az|nv|tx|ny|fl|wa|or|co)\b/.test(dl)) {
        updated++
        return { ...t, category: "Business Meals Expense", isIncome: false }
      }

      return t
    })

    updateCurrentBusiness({ transactions: newTransactions })
    toast({
      title: `Re-categorized ${updated} transactions`,
      description: updated > 0 ? "Review the changes in the Transactions tab" : "All transactions already categorized",
    })
  }, [currentBusiness, updateCurrentBusiness, toast])

  // Cloud load handler — replaces localStorage data with Supabase data
  const handleCloudLoad = useCallback((cloudBusinesses: BusinessData[]) => {
    if (cloudBusinesses && cloudBusinesses.length > 0) {
      setBusinesses(cloudBusinesses)
      setCurrentBusinessId(cloudBusinesses[0].id)
      setShowWizard(false)
    }
  }, [])

  // Receipts handler
  const handleReceiptsUpdate = useCallback((receipts: any[]) => {
    updateCurrentBusiness({ receipts })
  }, [updateCurrentBusiness])

  // Memoize expensive calculations
  const stats = useMemo(() => {
    if (!currentBusiness) return { totalBalance: 0, totalRevenue: 0, totalExpenses: 0, totalDeductible: 0, taxSavings: 0, estimatedTaxLiability: 0 }

    const totalBalance = currentBusiness.uploadedStatements.reduce((sum, statement) => {
      return sum + statement.transactions.reduce((acc, t) => acc + (t.isIncome ? t.amount : -t.amount), 0)
    }, 0)

    const totalRevenue = currentBusiness.transactions
      .filter((t) => t.isIncome)
      .reduce((sum, t) => sum + t.amount, 0)

    // Only count business-deductible expenses (exclude personal, transfers, owner draws, uncategorized)
    const personalKeywords = ["personal", "crypto"]
    const transferKeywords = ["member drawing", "member contribution", "internal transfer", "credit card payment", "zelle", "venmo", "owner draw", "brokerage transfer", "business treasury"]
    const businessExpenses = currentBusiness.transactions.filter((t) => {
      if (t.isIncome) return false
      const cl = (t.category || "").toLowerCase()
      if (!cl || cl.includes("uncategorized")) return false
      if (personalKeywords.some(k => cl.includes(k))) return false
      if (transferKeywords.some(k => cl.includes(k))) return false
      return true
    })
    const totalExpenses = businessExpenses.reduce((sum, t) => sum + t.amount, 0)
    // Apply 50% meals deduction rule
    const totalDeductible = businessExpenses.reduce((sum, t) => {
      const cl = (t.category || "").toLowerCase()
      if (cl.includes("meals")) return sum + t.amount * 0.5
      return sum + t.amount
    }, 0)

    const taxSavings = totalDeductible * 0.35
    const estimatedTaxLiability = Math.max(0, (totalRevenue - totalDeductible) * 0.35)

    return { totalBalance, totalRevenue, totalExpenses, totalDeductible, taxSavings, estimatedTaxLiability }
  }, [currentBusiness])

  const businessSelectorData = useMemo(() =>
    businesses.map((b) => ({
      id: b.id,
      name: b.profile.businessName,
      type: b.profile.businessType,
    })),
    [businesses]
  )

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

  // Don't render until hydrated to prevent flash
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

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
          <Suspense fallback={<TabLoading />}>
            <TaxWizard onComplete={handleWizardComplete} />
          </Suspense>
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
              <div className="flex gap-2 items-center">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => handleRecategorize(false)} disabled={!currentBusiness || currentBusiness.transactions.length === 0}>
                  <Sparkles className="h-3.5 w-3.5" /> Re-categorize
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => handleRecategorize(true)} disabled={!currentBusiness || currentBusiness.transactions.length === 0} title="Re-run all rules on every transaction, overriding previous categorizations">
                  <RefreshCw className="h-3.5 w-3.5" /> Force All
                </Button>
                <SaveIndicator businesses={businesses} onLoad={handleCloudLoad} />
                <BusinessSelector
                  businesses={businessSelectorData}
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
                <div className="text-2xl font-bold">${stats.totalBalance.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">All accounts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">2025 Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${stats.totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Gross income</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Deductible Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">${stats.totalDeductible.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  After 50% meals adjustment
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tax Savings</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${stats.taxSavings.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">From deductions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Est. Tax Liability</CardTitle>
                <Calculator className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">${stats.estimatedTaxLiability.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">After deductions</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="statements">Statements</TabsTrigger>
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
              <TabsTrigger value="transactions" className="relative">
                Transactions
                {currentBusiness.transactions.filter(t => !t.category || t.category === "Uncategorized Expense" || t.category === "").length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">
                    {currentBusiness.transactions.filter(t => !t.category || t.category === "Uncategorized Expense" || t.category === "").length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="reports">Tax Reports</TabsTrigger>
              <TabsTrigger value="deductions">Deductions</TabsTrigger>
            </TabsList>

            <TabsContent value="statements" className="space-y-6">
              <Suspense fallback={<TabLoading />}>
                <StatementUploader
                  existingStatements={currentBusiness.uploadedStatements}
                  onStatementsUpdate={handleStatementsUpdate}
                  onContinue={handleContinueToTransactions}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="receipts" className="space-y-6">
              <Suspense fallback={<TabLoading />}>
                <ReceiptUploader
                  businessId={currentBusinessId}
                  receipts={currentBusiness.receipts || []}
                  onReceiptsUpdate={handleReceiptsUpdate}
                />
              </Suspense>
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
                <Suspense fallback={<TabLoading />}>
                  <InteractiveTransactionsList
                    transactions={currentBusiness.transactions}
                    onUpdateTransaction={updateTransaction}
                    onBulkUpdate={bulkUpdateTransactions}
                    onRefresh={() => {}}
                    isLoading={isLoading}
                  />
                </Suspense>
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
                <Suspense fallback={<TabLoading />}>
                  <InteractiveReports
                    transactions={currentBusiness.transactions}
                    onUpdateTransaction={updateTransaction}
                    dateRange={{ start: "2025-01-01", end: "2025-12-31" }}
                  />
                </Suspense>
              )}
            </TabsContent>

            <TabsContent value="deductions" className="space-y-6">
              <DeductionsTab currentBusiness={currentBusiness} stats={stats} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}

// Extracted as separate component to avoid re-renders from parent
// Human-readable labels for deduction IDs
const DEDUCTION_LABELS: Record<string, string> = {
  advertising: "Advertising & Marketing",
  marketing: "Marketing & Advertising",
  vehicle: "Vehicle & Mileage",
  "merchant-fees": "Merchant & Platform Fees",
  contractors: "Contract Labor (1099s)",
  equipment: "Equipment & Depreciation",
  insurance: "Business Insurance",
  "health-insurance": "Self-Employed Health Insurance",
  "bank-fees": "Interest & Bank Fees",
  professional: "Professional Services",
  office: "Office Supplies & Expenses",
  travel: "Business Travel",
  meals: "Business Meals (50%)",
  utilities: "Utilities",
  "phone-internet": "Phone & Internet",
  software: "Software & SaaS",
  "software-booking": "Booking & Payment Software",
  education: "Education & Training",
  "home-office": "Home Office Deduction",
  "california-fees": "California LLC / Franchise Tax",
  rent: "Rent Expense",
  "sep-ira": "SEP-IRA / Solo 401(k)",
  waste: "Waste & Disposal",
}

// Map wizard deduction IDs to actual transaction category names
const DEDUCTION_CATEGORY_MAP: Record<string, string[]> = {
  advertising: ["Advertising & Marketing", "Social Media & Online Presence", "Soccer Team Sponsorship"],
  marketing: ["Advertising & Marketing", "Social Media & Online Presence", "Soccer Team Sponsorship"],
  vehicle: ["Gas & Auto Expense", "Parking Expense"],
  "merchant-fees": ["Merchant Processing Fees", "Merchant Fees Expense"],
  contractors: ["Contract Labor"],
  equipment: ["Equipment & Depreciation"],
  insurance: ["Insurance Expense - Business"],
  "health-insurance": ["Health Insurance"],
  "bank-fees": ["Bank & ATM Fee Expense"],
  professional: ["Professional Service Expense", "Tax Software & Services"],
  office: ["Office Supplies", "Office Supply Expense", "Office Kitchen Supplies"],
  travel: ["Travel Expense"],
  meals: ["Business Meals Expense"],
  utilities: ["Utilities Expense"],
  "phone-internet": ["Phone & Internet Expense"],
  software: ["Software & Web Hosting Expense"],
  "software-booking": ["Software & Web Hosting Expense"],
  education: ["Education & Training"],
  "home-office": ["Home Office Expense"],
  "california-fees": ["California LLC Fee"],
  rent: ["Rent Expense"],
  "sep-ira": ["SEP-IRA Contribution"],
  waste: ["Waste & Disposal"],
}

function DeductionsTab({ currentBusiness, stats }: { currentBusiness: BusinessData; stats: any }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Deduction Tracking & Optimization</CardTitle>
          <CardDescription>
            Monitor your {currentBusiness.profile.deductions?.length || 0} configured deduction categories to
            maximize tax savings and minimize your California tax liability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentBusiness.profile.deductions && currentBusiness.profile.deductions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentBusiness.profile.deductions.map((deduction) => {
                const mappedCategories = DEDUCTION_CATEGORY_MAP[deduction] || []
                const relatedTransactions = currentBusiness.transactions.filter(
                  (t) =>
                    !t.isIncome &&
                    (mappedCategories.some(mc => t.category === mc) ||
                      t.category.toLowerCase().includes(deduction.toLowerCase()) ||
                      t.description.toLowerCase().includes(deduction.toLowerCase())),
                )
                const totalAmount = relatedTransactions.reduce((sum, t) => sum + t.amount, 0)
                const deductPct = deduction === "meals" ? 0.5 : 1
                const deductibleAmount = totalAmount * deductPct
                const savings = Math.round(deductibleAmount * 0.35)

                return (
                  <Card key={deduction} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-sm mb-2 line-clamp-2">{DEDUCTION_LABELS[deduction] || deduction}</h4>
                      <div className="text-2xl font-bold text-blue-600 mb-1">${totalAmount.toFixed(2)}</div>
                      {deductPct < 1 && (
                        <div className="text-xs text-muted-foreground mb-1">
                          Deductible ({deductPct * 100}%): ${deductibleAmount.toFixed(2)}
                        </div>
                      )}
                      <div className="text-sm text-green-600 font-medium mb-2">
                        Tax Savings: ${savings.toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {relatedTransactions.length} transactions {"\u2022"} 2025 YTD
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No deduction categories configured. Add deduction tracking when setting up your business.
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
                <span className="font-bold text-blue-600">${stats.totalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="font-medium">Estimated Tax Savings:</span>
                <span className="font-bold text-green-600">${stats.taxSavings.toLocaleString()}</span>
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
  )
}
