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
  const [showWizard, setShowWizard] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState("statements")
  const currentBusiness = useMemo(
    () => businesses.find((b) => b.id === currentBusinessId),
    [businesses, currentBusinessId]
  )

  // Load from localStorage once on mount — skip wizard if any data exists
  useEffect(() => {
    try {
      const saved = localStorage.getItem("businesses")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.length > 0) {
          setBusinesses(parsed)
          const lastId = localStorage.getItem("lastBusinessId")
          setCurrentBusinessId(lastId || parsed[0].id)
          // Data found — go straight to dashboard
          setShowWizard(false)
        } else {
          // Empty array in storage — show wizard for first-time setup
          setShowWizard(true)
        }
      } else {
        // Nothing saved at all — show wizard
        setShowWizard(true)
      }
    } catch (e) {
      console.warn("Failed to load saved data:", e)
      setShowWizard(true)
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

  // --- 2025 IRS Federal Tax Brackets (Single Filer) ---
  const calculateFederalTax = (taxableIncome: number): number => {
    const brackets = [
      { limit: 11925, rate: 0.10 },
      { limit: 48475, rate: 0.12 },
      { limit: 103350, rate: 0.22 },
      { limit: 197300, rate: 0.24 },
      { limit: 250525, rate: 0.32 },
      { limit: 626350, rate: 0.35 },
      { limit: Infinity, rate: 0.37 },
    ]
    let tax = 0
    let prev = 0
    for (const b of brackets) {
      if (taxableIncome <= prev) break
      const taxable = Math.min(taxableIncome, b.limit) - prev
      tax += taxable * b.rate
      prev = b.limit
    }
    return Math.round(tax * 100) / 100
  }

  // --- 2025 California Tax Brackets (Single Filer) ---
  const calculateCaliforniaTax = (taxableIncome: number): number => {
    const brackets = [
      { limit: 10756, rate: 0.01 },
      { limit: 25499, rate: 0.02 },
      { limit: 40245, rate: 0.04 },
      { limit: 55866, rate: 0.06 },
      { limit: 70609, rate: 0.08 },
      { limit: 360659, rate: 0.093 },
      { limit: 432791, rate: 0.103 },
      { limit: 721314, rate: 0.113 },
      { limit: 1000000, rate: 0.123 },
      { limit: Infinity, rate: 0.133 },
    ]
    let tax = 0
    let prev = 0
    for (const b of brackets) {
      if (taxableIncome <= prev) break
      const taxable = Math.min(taxableIncome, b.limit) - prev
      tax += taxable * b.rate
      prev = b.limit
    }
    return Math.round(tax * 100) / 100
  }

  // Memoize expensive calculations
  const stats = useMemo(() => {
    if (!currentBusiness) return {
      totalBalance: 0, totalRevenue: 0, totalExpenses: 0, totalDeductible: 0,
      netProfit: 0, seTax: 0, seTaxDeduction: 0, qbiDeduction: 0,
      federalTax: 0, caTax: 0, caLLCFee: 0,
      taxSavings: 0, estimatedTaxLiability: 0,
    }

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
    // Apply 50% meals deduction rule per IRS
    const totalDeductible = businessExpenses.reduce((sum, t) => {
      const cl = (t.category || "").toLowerCase()
      if (cl.includes("meals")) return sum + t.amount * 0.5
      return sum + t.amount
    }, 0)

    // --- IRS-accurate tax calculation for Schedule C sole proprietor ---
    const netProfit = Math.max(0, totalRevenue - totalDeductible)

    // 1. Self-employment tax: 15.3% on 92.35% of net profit
    const seTaxableIncome = netProfit * 0.9235
    const seTax = seTaxableIncome * 0.153
    const seTaxDeduction = seTax * 0.5 // Deductible half of SE tax

    // 2. QBI deduction (Sec 199A): 20% of net profit for pass-through businesses under threshold
    const qbiDeduction = netProfit * 0.20

    // 3. Adjusted Gross Income for federal
    const agi = netProfit - seTaxDeduction

    // 4. Standard deduction 2025: $15,000 single
    const standardDeduction = 15000

    // 5. Taxable income after standard deduction + QBI
    const federalTaxableIncome = Math.max(0, agi - standardDeduction - qbiDeduction)

    // 6. 2025 Federal brackets (single filer)
    const federalTax = calculateFederalTax(federalTaxableIncome)

    // 7. California tax (single filer, 2025 brackets)
    // CA doesn't allow QBI deduction, uses its own standard deduction ($5,540)
    const caStandardDeduction = 5540
    const caTaxableIncome = Math.max(0, agi - caStandardDeduction)
    const caTax = calculateCaliforniaTax(caTaxableIncome)
    // CA LLC fee: $800 minimum if gross > $250K, otherwise $0 for most small LLCs
    // (The $800 minimum was eliminated for tax years 2024-2026 for LLCs with < $250K revenue)
    const caLLCFee = totalRevenue >= 250000 ? 800 : 0

    // Total estimated tax liability
    const estimatedTaxLiability = Math.max(0, federalTax + seTax + caTax + caLLCFee)

    // Tax savings = what you'd owe with $0 deductions minus what you actually owe
    const noDeductionProfit = totalRevenue
    const noDeductionSE = (noDeductionProfit * 0.9235) * 0.153
    const noDeductionAGI = noDeductionProfit - (noDeductionSE * 0.5)
    const noDeductionFederal = calculateFederalTax(Math.max(0, noDeductionAGI - standardDeduction - (noDeductionProfit * 0.20)))
    const noDeductionCA = calculateCaliforniaTax(Math.max(0, noDeductionAGI - caStandardDeduction))
    const taxWithoutDeductions = noDeductionFederal + noDeductionSE + noDeductionCA
    const taxSavings = Math.max(0, taxWithoutDeductions - estimatedTaxLiability)

    return {
      totalBalance, totalRevenue, totalExpenses, totalDeductible,
      netProfit, seTax, seTaxDeduction, qbiDeduction,
      federalTax, caTax, caLLCFee,
      taxSavings, estimatedTaxLiability,
    }
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
    // Quick-start: create a default business profile so user can skip the wizard
    const handleSkipWizard = () => {
      if (businesses.length > 0) {
        // Already have data, just go to dashboard
        setShowWizard(false)
        return
      }
      const defaultBusiness: BusinessData = {
        id: Date.now().toString(),
        profile: {
          businessName: "My Business",
          businessType: "service",
          entityType: "sole_proprietor",
          taxYear: "2025",
          state: "CA",
          deductions: ["vehicle", "meals", "office", "software", "phone-internet", "advertising", "professional", "bank-fees", "utilities", "home-office"],
        },
        uploadedStatements: [],
        transactions: [],
        receipts: [],
        lastSync: new Date().toISOString(),
      }
      setBusinesses([defaultBusiness])
      setCurrentBusinessId(defaultBusiness.id)
      setShowWizard(false)
      toast({
        title: "Quick start",
        description: "Default profile created. You can update your business details anytime from Settings.",
      })
    }

    return (
      <>
        <EthereumFix />
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            {businesses.length > 0 ? (
              <Button variant="ghost" onClick={() => setShowWizard(false)}>
                {"<-"} Back to Dashboard
              </Button>
            ) : (
              <div />
            )}
            <Button variant="outline" size="sm" onClick={handleSkipWizard}>
              {businesses.length > 0 ? "Back to Dashboard" : "Skip Setup -- Go to Dashboard"}
            </Button>
          </div>
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

          {/* Tax Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Schedule C Line 1</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Business Deductions</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">${stats.totalDeductible.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Meals at 50%, all other at 100%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Profit (Sched C)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Revenue minus deductions</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Est. Total Tax</CardTitle>
                <Calculator className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">${stats.estimatedTaxLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Federal + SE + CA (IRS brackets)</p>
              </CardContent>
            </Card>
          </div>

          {/* Tax Breakdown Detail Row */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">SE Tax (15.3%)</p>
              <p className="text-sm font-semibold">${stats.seTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">SE Deduction (50%)</p>
              <p className="text-sm font-semibold text-green-600">-${stats.seTaxDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">QBI Deduction (20%)</p>
              <p className="text-sm font-semibold text-green-600">-${stats.qbiDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Federal Income Tax</p>
              <p className="text-sm font-semibold">${stats.federalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">California Tax</p>
              <p className="text-sm font-semibold">${stats.caTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border p-3 bg-green-50/50 dark:bg-green-950/20">
              <p className="text-xs text-muted-foreground">Deduction Savings</p>
              <p className="text-sm font-semibold text-green-600">${stats.taxSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
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
          <CardTitle>IRS Tax Minimization Summary</CardTitle>
          <CardDescription>How your deductions reduce your tax liability using real IRS brackets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg border">
                <span className="text-sm">Gross Revenue (Line 1)</span>
                <span className="font-bold">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg border">
                <span className="text-sm">Business Deductions</span>
                <span className="font-bold text-blue-600">-${stats.totalDeductible.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg border">
                <span className="text-sm">Net Profit (Schedule C)</span>
                <span className="font-bold">${stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg border">
                <span className="text-sm">SE Tax Deduction (50%)</span>
                <span className="font-bold text-green-600">-${stats.seTaxDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg border">
                <span className="text-sm">QBI Deduction (Sec 199A, 20%)</span>
                <span className="font-bold text-green-600">-${stats.qbiDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg border">
                <span className="text-sm">Standard Deduction (Single)</span>
                <span className="font-bold text-green-600">-$15,000.00</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-2 border-green-200 dark:border-green-800">
                <span className="font-semibold">Total Tax Liability</span>
                <span className="font-bold text-green-700 dark:text-green-400">${stats.estimatedTaxLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <span className="font-semibold">Saved by Deductions</span>
                <span className="font-bold text-green-600">${stats.taxSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Tax Minimization Strategies:</h4>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">1.</span>
                  <span><strong>SEP-IRA / Solo 401(k)</strong> — Contribute up to 25% of net profit (max $69,000) before filing deadline to reduce taxable income further</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">2.</span>
                  <span><strong>Home Office (Simplified)</strong> — $5/sq ft up to 300 sq ft = $1,500 additional deduction if you have a dedicated workspace</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">3.</span>
                  <span><strong>Section 179 / Equipment</strong> — Buy business equipment before Dec 31 to deduct the full cost this tax year</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">4.</span>
                  <span><strong>Mileage Tracking</strong> — $0.70/mile for 2025. Use MileIQ or Everlance to log business drives</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">5.</span>
                  <span><strong>Health Insurance</strong> — Self-employed health premiums are 100% deductible on Schedule 1 (not Schedule C)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">6.</span>
                  <span><strong>Categorize Everything</strong> — Review uncategorized transactions; each missed deduction increases your tax bill</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
