"use client"

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

import { BUILT_IN_RULES, CATEGORY_ID_TO_NAME, matchHighPriorityDescription } from "@/lib/categorization/rules-engine"
import { computeUiExpenseTotals } from "@/lib/tax/treatment"
import { KEYWORD_MAPPING_RULES } from "@/lib/categorization/keyword-mapping"
import { RetirementOptimizer } from "@/components/retirement-optimizer"
import { EstimatedTaxSafeHarbor } from "@/components/estimated-tax-safe-harbor"
import { MappingCoverageAudit } from "@/components/mapping-coverage-audit"
import {
  calculateFederalTaxByFilingStatus,
  calculateFederalTaxSingle,
  calculateCaliforniaTaxSingle,
  CA_STANDARD_DEDUCTION,
  SS_WAGE_BASE,
  standardDeductionFederal,
  type FilingStatus,
} from "@/lib/tax/brackets"
import { computeLedgerTaxEstimate, type LedgerTaxEstimate } from "@/lib/tax/taxEstimate"
import {
  SYNTHETIC_WITHHELD_FEE_IDS_2025,
  businessHas2025LedgerActivity,
  ensureAllWithheldFeeAdjustments2025,
} from "@/lib/stripeReconciliation"
import { ensureRecoveredTransactions2025, RECOVERED_TRANSACTION_IDS_2025 } from "@/lib/recoveredTransactions2025"
import { sumCryptoInvestmentOutlayForYear } from "@/lib/tax/cryptoInvestmentsReference"

const ALL_INJECTED_LEDGER_IDS_2025 = [...SYNTHETIC_WITHHELD_FEE_IDS_2025, ...RECOVERED_TRANSACTION_IDS_2025] as readonly string[]

const EMPTY_DASHBOARD_STATS = {
  totalBalance: 0,
  totalRevenue: 0,
  totalExpenses: 0,
  totalDeductible: 0,
  schedCDeductions: 0,
  healthInsuranceTotal: 0,
  sepIraTotal: 0,
  netProfit: 0,
  seTax: 0,
  seTaxDeduction: 0,
  qbiDeduction: 0,
  federalTax: 0,
  caTax: 0,
  caLLCFee: 0,
  agi: 0,
  taxSavings: 0,
  estimatedTaxLiability: 0,
  cryptoInvestmentsOutlay2025: 0,
  cryptoInvestmentsCount2025: 0,
}

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
  /** Non-revenue credits (owner funding, loan proceeds) — omitted from revenue / Schedule C Line 1 rollups */
  exclude?: boolean
  merchantName?: string
  pending?: boolean
  /** True for rows created via Manual Entry (not from statement import) */
  manual_entry?: boolean
  /** Injected / recovered ledger rows (platform fees, dedupe recovery, manual entry) */
  source?: "manual_adjustment" | "platform_fee_import" | "recovered_import"
  /** Optional memo (manual entry, receipt context) */
  notes?: string
  /** Data URL for an attached receipt image or PDF (stored with the business in localStorage) */
  receiptImageDataUrl?: string
  receiptImageFileName?: string
  /** From categorization rules — used for Schedule C export exclusion */
  is_personal?: boolean
  is_transfer?: boolean
  /** Where this categorization came from (rule/ai/user) */
  categorized_by?: "rule" | "ai" | "user" | null
  /** Confidence for rule/AI categorization */
  confidence?: number
}
type NewTransactionInput = Omit<Transaction, "id">

interface UploadedStatement {
  id: string
  accountName: string
  accountType: "bank" | "credit_card" | "personal" | "investment" | "wf_business_csv"
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
  /** User removed these synthetic rows; do not re-inject */
  suppressedSyntheticIds?: string[]
}

type InvestmentDocumentRef = {
  id: string
  label: string
  fileName?: string
}

interface TaxProfile {
  businessName: string
  businessType: string
  entityType: string
  deductions: string[]
  /** Federal income tax filing status — drives standard deduction and bracket table */
  filingStatus?: FilingStatus
  /** Optional override for federal standard deduction (blank = use default for status/year) */
  federalStandardDeductionOverride?: number | null
  /** 2025 investment / brokerage tax documents (reference list; files live outside the app) */
  investmentDocuments2025?: InvestmentDocumentRef[]
}

const DEFAULT_INVESTMENT_DOCS_2025: InvestmentDocumentRef[] = [
  {
    id: "inv-1099-composite-1",
    label: "Brokerage — 1099 Composite & year-end summary",
    fileName: "1099 Composite and Year-End Summary - 2025_442.PDF",
  },
  {
    id: "inv-1099-composite-2",
    label: "Brokerage — 1099 Composite (dated export)",
    fileName: "1099 Composite and Year-End Summary - 2025_2026-02-06_442.PDF",
  },
  {
    id: "inv-gain-loss",
    label: "Gain / loss tax worksheet",
    fileName: "2025-5WW83146-gain_loss_tax_worksheet.csv",
  },
  {
    id: "inv-1099r",
    label: "Retirement — 1099-R",
    fileName: "2025-5WW83146-irs_1099r_tax.pdf",
  },
]

function normalizeBusinessProfile(profile: TaxProfile): TaxProfile {
  return {
    ...profile,
    filingStatus: profile.filingStatus === "married_joint" ? "married_joint" : "single",
    federalStandardDeductionOverride:
      profile.federalStandardDeductionOverride != null && profile.federalStandardDeductionOverride > 0
        ? profile.federalStandardDeductionOverride
        : null,
    investmentDocuments2025:
      profile.investmentDocuments2025 && profile.investmentDocuments2025.length > 0
        ? profile.investmentDocuments2025
        : DEFAULT_INVESTMENT_DOCS_2025,
  }
}

// Debounced localStorage save — prevents lag from serializing on every keystroke
let saveTimer: ReturnType<typeof setTimeout> | null = null
let storageWarningShown = false
function debouncedSave(key: string, value: any, delay = 500) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      const serialized = JSON.stringify(value)
      // Warn if approaching 4MB (localStorage limit is ~5-10MB depending on browser)
      if (serialized.length > 4_000_000 && !storageWarningShown) {
        storageWarningShown = true
        console.warn(`[storage] Data is ${(serialized.length / 1_000_000).toFixed(1)}MB — approaching localStorage limit. Consider removing old statements.`)
      }
      localStorage.setItem(key, serialized)
    } catch (e: any) {
      console.warn("localStorage save failed:", e)
      // QuotaExceededError — storage is full
      if (e?.name === "QuotaExceededError" || e?.code === 22) {
        console.error("[storage] localStorage full! Transactions may not persist across page reloads.")
        // Attempt to save a trimmed version: keep only transaction metadata, not raw_line
        try {
          const trimmed = JSON.parse(JSON.stringify(value))
          if (Array.isArray(trimmed)) {
            trimmed.forEach((biz: any) => {
              biz?.uploadedStatements?.forEach((stmt: any) => {
                stmt?.transactions?.forEach((t: any) => { delete t.raw_line })
              })
            })
          }
          localStorage.setItem(key, JSON.stringify(trimmed))
          console.log("[storage] Saved trimmed version (raw_line stripped)")
        } catch (e2) {
          console.error("[storage] Even trimmed save failed — too much data")
        }
      }
    }
  }, delay)
}

function dedupeTransactions(transactions: Transaction[]): { deduped: Transaction[]; removedCount: number } {
  if (!transactions || transactions.length === 0) return { deduped: [], removedCount: 0 }

  const groups = new Map<string, Transaction[]>()
  for (const t of transactions) {
    // Full normalized description + income flag — avoids collapsing distinct Amazon MKTPL* rows
    // that shared the same parsed merchantName (e.g. "Amazon").
    const descNorm = (t.description || "").toLowerCase().replace(/\s+/g, " ").trim()
    const key = `${t.date}|${Number(t.amount).toFixed(2)}|${t.isIncome ? "i" : "e"}|${descNorm}`
    const arr = groups.get(key) || []
    arr.push(t)
    groups.set(key, arr)
  }

  const score = (t: Transaction): number => {
    const account = (t.account || "").toLowerCase()
    const accountScore =
      account.includes("business") || account.includes("checking") || account.includes("credit")
        ? 3
        : account.includes("personal")
          ? -3
          : 0
    const provenanceScore =
      t.categorized_by === "user" ? 4 : t.categorized_by === "ai" ? 2 : t.categorized_by === "rule" ? 1 : 0
    const confidenceScore = Math.round((t.confidence ?? 0) * 10)
    const attachmentScore = t.receiptImageDataUrl ? 2 : 0
    const notesScore = t.notes?.trim() ? 1 : 0
    return accountScore + provenanceScore + confidenceScore + attachmentScore + notesScore
  }

  const deduped: Transaction[] = []
  let removedCount = 0
  for (const set of groups.values()) {
    if (set.length === 1) {
      deduped.push(set[0])
      continue
    }
    const sorted = [...set].sort((a, b) => score(b) - score(a))
    deduped.push(sorted[0])
    removedCount += sorted.length - 1
  }
  return { deduped, removedCount }
}

export default function CaliforniaBusinessAccounting() {
  const [businesses, setBusinesses] = useState<BusinessData[]>([])
  const [currentBusinessId, setCurrentBusinessId] = useState<string>("")
  const [showWizard, setShowWizard] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [highlightedTransactionIds, setHighlightedTransactionIds] = useState<string[]>([])
  const [forceAllUndoState, setForceAllUndoState] = useState<{
    previousTransactions: Transaction[]
    changedIds: string[]
  } | null>(null)
  const { toast } = useToast()

  // Retroactive rule fixes should apply once per business dataset.
  const amazonRetroFixedBusinessIdsRef = useRef<Set<string>>(new Set())

  const [activeTab, setActiveTab] = useState("statements")

  const markDirty = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return
    setHighlightedTransactionIds(prev => {
      const s = new Set(prev)
      ids.forEach(id => s.add(id))
      return Array.from(s)
    })
  }, [])
  const currentBusiness = useMemo(
    () => businesses.find((b) => b.id === currentBusinessId),
    [businesses, currentBusinessId]
  )

  // Auto-heal legacy duplicated rows already in localStorage/cloud snapshots.
  useEffect(() => {
    if (!currentBusiness) return
    const { deduped, removedCount } = dedupeTransactions(currentBusiness.transactions || [])
    if (removedCount <= 0) return
    setBusinesses((prev) =>
      prev.map((b) => (b.id === currentBusinessId ? { ...b, transactions: deduped } : b)),
    )
    setHighlightedTransactionIds([])
    setForceAllUndoState(null)
    toast({
      title: "Duplicates removed",
      description: `${removedCount} duplicate row(s) were removed automatically from your current ledger.`,
    })
  }, [currentBusiness, currentBusinessId, toast])

  // Load from localStorage once on mount — skip wizard if any data exists
  useEffect(() => {
    try {
      const saved = localStorage.getItem("businesses")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.length > 0) {
          const cleaned = parsed.map((b: BusinessData) => {
            const { deduped } = dedupeTransactions(b.transactions || [])
            const has2025 = businessHas2025LedgerActivity({
              transactions: deduped,
              uploadedStatements: b.uploadedStatements,
            })
            let transactions = ensureAllWithheldFeeAdjustments2025(deduped, {
              suppressedIds: b.suppressedSyntheticIds ?? [],
              has2025Activity: has2025,
            })
            transactions = ensureRecoveredTransactions2025(transactions, {
              suppressedIds: b.suppressedSyntheticIds ?? [],
              has2025Activity: has2025,
            })
            return { ...b, transactions }
          })
          setBusinesses(cleaned)
          const lastId = localStorage.getItem("lastBusinessId")
          setCurrentBusinessId(lastId || cleaned[0].id)
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

  // On load: if any existing rows were previously categorized as "Personal - Entertainment"
  // but look like Amazon purchases, move them to "Software & Web Hosting Expense".
  useEffect(() => {
    if (!isHydrated || !currentBusiness || !currentBusinessId) return
    if (amazonRetroFixedBusinessIdsRef.current.has(currentBusinessId)) return
    amazonRetroFixedBusinessIdsRef.current.add(currentBusinessId)

    const amazonRe = /\bamzn\b|\bamazon\b|amazon\.com|amazon web services|\baws\b|prime\s*video/i
    const targetCategory = "Personal - Entertainment"
    const newCategory = "Software & Web Hosting Expense"

    let updated = 0
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id !== currentBusinessId) return b
        const txs = b.transactions.map((t) => {
          const cat = (t.category || "").trim()
          const isPersonalEntertainment = cat === targetCategory
          if (!isPersonalEntertainment) return t

          const text = `${t.description || ""} ${t.merchantName || ""}`.toLowerCase()
          if (!amazonRe.test(text)) return t

          updated++
          return {
            ...t,
            category: newCategory,
            isIncome: false,
            is_personal: false,
            is_transfer: false,
            exclude: false,
            categorized_by: "rule" as const,
            confidence: 0.99,
          }
        })

        return { ...b, transactions: txs }
      }),
    )

    if (updated > 0) {
      toast({
        title: "Amazon recategorization applied",
        description: `Updated ${updated} transaction(s) from "${targetCategory}" to "${newCategory}".`,
      })
    }
  }, [isHydrated, currentBusiness, currentBusinessId, toast])

  // One-time per business: 2025 audit fixes (Prime Video → software if misfiled as personal, soccer → advertising, apparel → personal shopping).
  useEffect(() => {
    if (!isHydrated || !currentBusinessId || !currentBusiness) return
    const storageKey = `diy-benchio-2025-tax-audit-migration-v3:${currentBusinessId}`
    try {
      if (localStorage.getItem(storageKey)) return
    } catch {
      return
    }

    let changed = 0
    const nextTx = currentBusiness.transactions.map((t) => {
      if (!t.date.startsWith("2025")) return t
      const desc = `${t.description || ""} ${t.merchantName || ""}`
      const dl = desc.toLowerCase()

      if (t.category === "Personal - Entertainment" && /prime\s*video/i.test(desc)) {
        changed++
        return {
          ...t,
          category: "Software & Web Hosting Expense",
          isIncome: false,
          is_personal: false,
          is_transfer: false,
          exclude: false,
          categorized_by: "rule" as const,
          confidence: 0.99,
        }
      }
      if (t.category === "Soccer Team Sponsorship") {
        changed++
        return {
          ...t,
          category: "Advertising & Marketing",
          isIncome: false,
          is_personal: false,
          is_transfer: false,
          exclude: false,
          categorized_by: "rule" as const,
          confidence: 0.99,
        }
      }
      if (
        (dl.includes("shapermint") || dl.includes("honeylove")) &&
        (t.category !== "Personal - Shopping" || t.is_personal !== true)
      ) {
        changed++
        return {
          ...t,
          category: "Personal - Shopping",
          isIncome: false,
          is_personal: true,
          is_transfer: false,
          exclude: false,
          categorized_by: "rule" as const,
          confidence: 0.99,
        }
      }
      return t
    })

    try {
      localStorage.setItem(storageKey, "1")
    } catch {
      /* ignore */
    }
    if (changed === 0) return

    setBusinesses((prev) =>
      prev.map((b) => (b.id === currentBusinessId ? { ...b, transactions: nextTx } : b)),
    )
    toast({
      title: "2025 ledger updates applied",
      description: `${changed} transaction(s) were recategorized (Prime Video, sponsorship, or personal apparel).`,
    })
  }, [isHydrated, currentBusinessId, currentBusiness, toast])

  // Debounced save to localStorage
  useEffect(() => {
    if (!isHydrated || businesses.length === 0) return
    // While there are unsaved edits (highlighted rows), we intentionally skip auto-persisting
    // so the user must click SaveIndicator.
    if (highlightedTransactionIds.length > 0) return
    debouncedSave("businesses", businesses)
  }, [businesses, isHydrated, highlightedTransactionIds.length])

  useEffect(() => {
    if (currentBusinessId) {
      localStorage.setItem("lastBusinessId", currentBusinessId)
    }
  }, [currentBusinessId])

  // NOTE: highlightedTransactionIds now represent "unsaved edits".
  // They must stay highlighted until the user clicks Save.

  const handleWizardComplete = useCallback((profile: TaxProfile) => {
    const newBusiness: BusinessData = {
      id: Date.now().toString(),
      profile: normalizeBusinessProfile({
        businessName: profile.businessName,
        businessType: profile.businessType,
        entityType: profile.entityType,
        deductions: profile.deductions,
        filingStatus: "single",
        federalStandardDeductionOverride: null,
        investmentDocuments2025: DEFAULT_INVESTMENT_DOCS_2025,
      }),
      uploadedStatements: [],
      transactions: [],
      receipts: [],
      lastSync: "",
      suppressedSyntheticIds: [],
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

  const updateBusinessProfile = useCallback(
    (updates: Partial<TaxProfile>) => {
      setBusinesses((prev) =>
        prev.map((b) =>
          b.id === currentBusinessId
            ? { ...b, profile: normalizeBusinessProfile({ ...b.profile, ...updates }) }
            : b,
        ),
      )
    },
    [currentBusinessId],
  )

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
    markDirty([transactionId])
    setForceAllUndoState(null)
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
    markDirty(updates.map(u => u.id))
    setForceAllUndoState(null)
  }, [currentBusinessId])

  const removeTransactions = useCallback(async (ids: string[]) => {
    if (!ids || ids.length === 0) return
    const idSet = new Set(ids)
    const syntheticRemoved = ids.filter((id) => ALL_INJECTED_LEDGER_IDS_2025.includes(id))
    setBusinesses((prev) =>
      prev.map((b) =>
        b.id === currentBusinessId
          ? {
              ...b,
              transactions: b.transactions.filter((t) => !idSet.has(t.id)),
              suppressedSyntheticIds:
                syntheticRemoved.length > 0
                  ? Array.from(new Set([...(b.suppressedSyntheticIds ?? []), ...syntheticRemoved]))
                  : b.suppressedSyntheticIds,
            }
          : b,
      ),
    )
    setHighlightedTransactionIds([])
    setForceAllUndoState(null)
  }, [currentBusinessId])

  const addManualTransaction = useCallback(async (txn: NewTransactionInput) => {
    const manualId = `manual-${Date.now()}-${Math.floor(Math.random() * 100000)}`
    setBusinesses((prev) =>
      prev.map((b) =>
        b.id === currentBusinessId
          ? { ...b, transactions: [{ ...txn, id: manualId, manual_entry: true }, ...b.transactions] }
          : b
      )
    )
    markDirty([manualId])
    setForceAllUndoState(null)
  }, [currentBusinessId])

  const handleStatementsUpdate = useCallback((statements: UploadedStatement[]) => {
    const statementTransactions = statements.flatMap((statement) => statement.transactions)
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id !== currentBusinessId) return b
        const receiptTxns = b.transactions.filter((t) => t.id.startsWith("receipt-txn-"))
        const { deduped } = dedupeTransactions([...statementTransactions, ...receiptTxns])
        const has2025 =
          statementTransactions.some((t) => t.date.startsWith("2025")) ||
          statements.some((s) => s.year === "2025")
        let transactions = ensureAllWithheldFeeAdjustments2025(deduped, {
          suppressedIds: b.suppressedSyntheticIds ?? [],
          has2025Activity: has2025,
        })
        transactions = ensureRecoveredTransactions2025(transactions, {
          suppressedIds: b.suppressedSyntheticIds ?? [],
          has2025Activity: has2025,
        })
        return {
          ...b,
          uploadedStatements: statements,
          transactions,
          lastSync: new Date().toLocaleString(),
        }
      }),
    )
  }, [currentBusinessId])

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
    const keywordRules = [...KEYWORD_MAPPING_RULES].sort((a, b) => b.priority - a.priority)
    const withExclude = currentBusiness.transactions.map(t => {
      if (
        t.source === "manual_adjustment" ||
        t.source === "platform_fee_import" ||
        t.source === "recovered_import"
      ) {
        return t
      }

      const dl = `${t.description || ""} ${t.merchantName || ""}`.toLowerCase()
      const dlNorm = dl.replace(/\s+/g, " ")
      const absAmt = Math.abs(t.amount || 0)

      // Explicit bank transfer phrasing for Upwork payouts.
      // Example: "Money Transfer authorized on 11/06 From Upwork CA ..."
      if (dlNorm.includes("money transfer authorized") && dlNorm.includes("from upwork ca")) {
        updated++
        return {
          ...t,
          category: "Freelance Income",
          isIncome: true,
          is_personal: false,
          is_transfer: false,
          categorized_by: "rule",
          confidence: 0.99,
        }
      }

      // Align with server rules engine: high-priority patterns first (non-revenue credits, Prime Video, crypto, DLR, etc.)
      const combinedDesc = `${t.description || ""} ${t.merchantName || ""}`.replace(/\s+/g, " ").trim()
      const hp = matchHighPriorityDescription(combinedDesc, absAmt, { isCredit: t.isIncome })
      if (hp && (forceAll || t.categorized_by !== "user")) {
        const catInfo = CATEGORY_ID_TO_NAME[hp.category_id]
        if (catInfo) {
          updated++
          const cat = catInfo.name
          const exclude =
            cat === "Owner's Contribution" || cat === "Loan Proceeds" || cat === "Business Loan Proceeds"
          return {
            ...t,
            category: cat,
            isIncome: catInfo.isIncome,
            is_personal: hp.is_personal,
            is_transfer: hp.is_transfer,
            exclude,
            categorized_by: "rule",
            confidence: hp.confidence,
          }
        }
      }

      const isUpworkLike =
        dl.includes("upwork") ||
        dl.includes("upwk") ||
        dl.includes("from upwork ca") ||
        dl.includes("upwork ca") ||
        /up\s*work/.test(dl)

      // Skip user-categorized transactions unless forceAll (don't override manual edits).
      // Rule/AI-tagged rows may be re-processed so improved patterns (e.g. GHL / messaging credits) can fix Sales Revenue.
      if (
        !forceAll &&
        t.categorized_by === "user" &&
        t.category &&
        t.category !== "Uncategorized Expense" &&
        t.category !== ""
      ) {
        if (isUpworkLike && t.category !== "Freelance Income") {
          updated++
          return { ...t, category: "Freelance Income", isIncome: true, is_personal: false, is_transfer: false, categorized_by: "rule", confidence: 0.9 }
        }
        return t
      }

      // Upwork should consistently land in Freelance Income (not generic Sales Revenue).
      if (isUpworkLike && t.category !== "Freelance Income") {
        updated++
        return { ...t, category: "Freelance Income", isIncome: true, is_personal: false, is_transfer: false, categorized_by: "rule", confidence: 0.95 }
      }
      
      // Keyword mapping layer (customRules) — applied before built-in rules
      for (const rule of keywordRules) {
        const pattern = rule.pattern.toLowerCase()
        let matched = false
        if (rule.match_type === "contains") matched = dl.includes(pattern)
        else if (rule.match_type === "starts_with") matched = dl.startsWith(pattern)
        else if (rule.match_type === "exact") matched = dl === pattern
        else if (rule.match_type === "regex") {
          try {
            matched = new RegExp(pattern, "i").test(dl)
          } catch {}
        }

        if (matched) {
          const catInfo = CATEGORY_ID_TO_NAME[rule.category_id]
          if (catInfo) {
            updated++
            return {
              ...t,
              category: catInfo.name,
              isIncome: catInfo.isIncome,
              is_personal: rule.is_personal,
              is_transfer: rule.is_transfer,
              categorized_by: "rule",
              confidence: 0.9,
            }
          }
        }
      }

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
              is_personal: rule.is_personal,
              is_transfer: rule.is_transfer,
              categorized_by: "rule",
              confidence: rule.confidence ?? 0.85,
            }
          }
        }
      }

      // Smart fallback — try keyword heuristics before leaving uncategorized
      const amount = t.amount || 0
      const absAmount = Math.abs(amount)

      // Credits/deposits
      if (t.isIncome) {
        if (dl.includes('payment') || dl.includes('credit') || dl.includes('refund')) {
          updated++
          return { ...t, category: "Credit Card Payment", isIncome: false, is_personal: false, is_transfer: true, categorized_by: "rule", confidence: 0.4 }
        }
        if (amount > 500) {
          updated++
          return { ...t, category: "Other Income", isIncome: true, is_personal: false, is_transfer: false, categorized_by: "rule", confidence: 0.4 }
        }
        updated++
        const isRefundLike = dl.includes('refund') || dl.includes('return') || dl.includes('purchase return')
        return { ...t, category: isRefundLike ? "Refunds Given" : "Other Income", isIncome: true, is_personal: false, is_transfer: false, categorized_by: "rule", confidence: 0.4 }
      }

      // Debits with keyword hints
      if (dl.includes('fee') || dl.includes('charge') || dl.includes('penalty')) {
        updated++
        return { ...t, category: "Bank & ATM Fee Expense", isIncome: false, is_personal: false, is_transfer: false, categorized_by: "rule", confidence: 0.4 }
      }
      if (dl.includes('dlr ') || dl.includes('dlr*')) {
        updated++
        return { ...t, category: "Personal - Entertainment", isIncome: false, is_personal: true, is_transfer: false, categorized_by: "rule", confidence: 0.4 }
      }

      // POS purchases: small ones → Office Supplies, larger → Personal Shopping
      if (dl.includes('purchase authorized') || dl.includes('pos purchase') || dl.includes('pos debit')) {
        updated++
        if (absAmount < 50) {
          return { ...t, category: "Office Supplies", isIncome: false, is_personal: false, is_transfer: false, categorized_by: "rule", confidence: 0.4 }
        }
        return { ...t, category: "Personal - Shopping", isIncome: false, is_personal: true, is_transfer: false, categorized_by: "rule", confidence: 0.4 }
      }

      // Short merchant names with state abbreviations → likely restaurant
      if (absAmount < 30 && dl.length < 40 && /\b(ca|az|nv|tx|ny|fl|wa|or|co)\b/.test(dl)) {
        updated++
        return { ...t, category: "Business Meals Expense", isIncome: false, is_personal: false, is_transfer: false, categorized_by: "rule", confidence: 0.4 }
      }

      return t
    })
    const newTransactions = withExclude.map((t) => ({
      ...t,
      exclude:
        t.category === "Owner's Contribution" ||
        t.category === "Loan Proceeds" ||
        t.category === "Business Loan Proceeds",
    })) as Transaction[]

    const changedIds = newTransactions
      .filter((next, idx) => {
        const prev = currentBusiness.transactions[idx]
        if (!prev) return false
        return prev.category !== next.category ||
          prev.isIncome !== next.isIncome ||
          prev.is_personal !== next.is_personal ||
          prev.is_transfer !== next.is_transfer ||
          Boolean(prev.exclude) !== Boolean(next.exclude)
      })
      .map((t) => t.id)

    if (forceAll) {
      setForceAllUndoState({
        previousTransactions: currentBusiness.transactions,
        changedIds,
      })
      setHighlightedTransactionIds(changedIds)
    } else if (changedIds.length > 0) {
      markDirty(changedIds)
    }

    updateCurrentBusiness({ transactions: newTransactions })
    toast({
      title: `Re-categorized ${updated} transactions`,
      description: updated > 0 ? "Review the changes in the Transactions tab" : "All transactions already categorized",
    })
  }, [currentBusiness, updateCurrentBusiness, toast])

  const handleUndoForceAll = useCallback(() => {
    if (!forceAllUndoState) {
      toast({ title: "Nothing to undo", description: "No Force All changes available to revert." })
      return
    }

    updateCurrentBusiness({ transactions: forceAllUndoState.previousTransactions })
    setHighlightedTransactionIds([])
    setForceAllUndoState(null)
    toast({
      title: "Force All reverted",
      description: "Previous transaction categories were restored.",
    })
  }, [forceAllUndoState, updateCurrentBusiness, toast])

  // Cloud load handler — replaces localStorage data with Supabase data
  const handleCloudLoad = useCallback((cloudBusinesses: BusinessData[]) => {
    if (cloudBusinesses && cloudBusinesses.length > 0) {
      const cleaned = cloudBusinesses.map((b) => {
        const { deduped } = dedupeTransactions(b.transactions || [])
        const has2025 = businessHas2025LedgerActivity({
          transactions: deduped,
          uploadedStatements: b.uploadedStatements,
        })
        let transactions = ensureAllWithheldFeeAdjustments2025(deduped, {
          suppressedIds: b.suppressedSyntheticIds ?? [],
          has2025Activity: has2025,
        })
        transactions = ensureRecoveredTransactions2025(transactions, {
          suppressedIds: b.suppressedSyntheticIds ?? [],
          has2025Activity: has2025,
        })
        return { ...b, profile: normalizeBusinessProfile(b.profile), transactions }
      })
      setBusinesses(cleaned)
      setCurrentBusinessId(cleaned[0].id)
      setShowWizard(false)
      setHighlightedTransactionIds([])
      setForceAllUndoState(null)
    }
  }, [])

  // Receipts: keep receipt images + sync cash-expense lines into the transaction ledger
  const handleReceiptsUpdate = useCallback(
    (receipts: any[]) => {
      setBusinesses((prev) =>
        prev.map((b) => {
          if (b.id !== currentBusinessId) return b
          const nonReceiptTxns = b.transactions.filter((t) => !t.id.startsWith("receipt-txn-"))
          const receiptTxns = receipts
            .filter((r) => (r.amount || 0) > 0 && r.includeInLedger !== false)
            .map((r) => ({
              id: `receipt-txn-${r.id}`,
              date: r.date,
              description: `Cash receipt — ${r.merchantName || "Receipt"}`,
              amount: r.amount,
              category: r.category || "Uncategorized Expense",
              isIncome: false,
              account: "Cash / Receipt",
              merchantName: r.merchantName,
              notes: r.notes || "",
              receiptImageDataUrl: r.fileUrl,
              receiptImageFileName: r.fileName,
              categorized_by: "user" as const,
              confidence: 1,
            }))
          return { ...b, receipts, transactions: [...nonReceiptTxns, ...receiptTxns] }
        }),
      )
    },
    [currentBusinessId],
  )

  // Tax bracket helpers now live in `lib/tax/brackets.ts`

  // Memoize expensive calculations + full ledger tax estimate (filing status / std deduction aware)
  const { stats, ledgerTaxEstimate } = useMemo((): {
    stats: typeof EMPTY_DASHBOARD_STATS
    ledgerTaxEstimate: LedgerTaxEstimate | null
  } => {
    if (!currentBusiness) return { stats: EMPTY_DASHBOARD_STATS, ledgerTaxEstimate: null }

    const filing: FilingStatus =
      currentBusiness.profile.filingStatus === "married_joint" ? "married_joint" : "single"
    const ledgerTaxEstimate = computeLedgerTaxEstimate(currentBusiness.transactions, {
      taxYear: 2025,
      filingStatus: filing,
      federalStandardDeductionOverride: currentBusiness.profile.federalStandardDeductionOverride,
    })

    const totalBalance = currentBusiness.uploadedStatements.reduce((sum, statement) => {
      return sum + statement.transactions.reduce((acc, t) => acc + (t.isIncome ? t.amount : -t.amount), 0)
    }, 0)

    const { totalExpenses, schedCDeductions, healthInsuranceTotal, sepIraTotal } = computeUiExpenseTotals(
      currentBusiness.transactions,
    )
    const totalDeductible =
      ledgerTaxEstimate.scheduleCTotalDeductions +
      ledgerTaxEstimate.healthInsuranceDeduction +
      ledgerTaxEstimate.sepIraContributed

    const ssWageBase2025 = SS_WAGE_BASE[2025]
    const caLLCFee = ledgerTaxEstimate.grossRevenue >= 250000 ? 800 : 0
    const estimatedTaxLiability = ledgerTaxEstimate.totalEstimatedTaxOwed + caLLCFee

    const defaultStd = standardDeductionFederal(2025, filing)
    const noDeductionProfit = ledgerTaxEstimate.grossRevenue
    const noDeductionSEIncome = Math.min(noDeductionProfit * 0.9235, ssWageBase2025)
    const noDeductionSE = noDeductionSEIncome * 0.124 + noDeductionProfit * 0.9235 * 0.029
    const noDeductionAGI = noDeductionProfit - noDeductionSE * 0.5
    const noDeductionFederal = calculateFederalTaxByFilingStatus(
      2025,
      Math.max(0, noDeductionAGI - defaultStd - noDeductionProfit * 0.2),
      filing,
    )
    const noDeductionCA = calculateCaliforniaTaxSingle(
      2025,
      Math.max(0, noDeductionAGI - CA_STANDARD_DEDUCTION[2025]),
    )
    const taxWithoutDeductions = noDeductionFederal + noDeductionSE + noDeductionCA
    const taxSavings = Math.max(0, taxWithoutDeductions - estimatedTaxLiability)

    const { total: cryptoInvestmentsOutlay2025, count: cryptoInvestmentsCount2025 } =
      sumCryptoInvestmentOutlayForYear(currentBusiness.transactions, "2025")

    return {
      stats: {
        totalBalance,
        totalRevenue: ledgerTaxEstimate.grossRevenue,
        totalExpenses,
        totalDeductible,
        schedCDeductions,
        healthInsuranceTotal,
        sepIraTotal,
        netProfit: ledgerTaxEstimate.netProfitScheduleC,
        seTax: ledgerTaxEstimate.selfEmploymentTax,
        seTaxDeduction: ledgerTaxEstimate.halfSETaxDeduction,
        qbiDeduction: ledgerTaxEstimate.qbiDeduction,
        federalTax: ledgerTaxEstimate.federalIncomeTax,
        caTax: ledgerTaxEstimate.californiaIncomeTax,
        caLLCFee,
        agi: ledgerTaxEstimate.adjustedGrossIncome,
        taxSavings,
        estimatedTaxLiability,
        cryptoInvestmentsOutlay2025,
        cryptoInvestmentsCount2025,
      },
      ledgerTaxEstimate,
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
        profile: normalizeBusinessProfile({
          businessName: "My Business",
          businessType: "service",
          entityType: "sole_proprietor",
          deductions: ["vehicle", "meals", "office", "software", "phone-internet", "advertising", "professional", "bank-fees", "utilities", "home-office"],
          filingStatus: "single",
          federalStandardDeductionOverride: null,
          investmentDocuments2025: DEFAULT_INVESTMENT_DOCS_2025,
        }),
        uploadedStatements: [],
        transactions: [],
        receipts: [],
        lastSync: new Date().toISOString(),
        suppressedSyntheticIds: [],
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
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleUndoForceAll}
                  disabled={!forceAllUndoState}
                  title="Revert the most recent Force All changes"
                >
                  Undo Force All
                </Button>
                {forceAllUndoState && (
                  <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700">
                    {forceAllUndoState.changedIds.length} changes highlighted
                  </Badge>
                )}
                <SaveIndicator
                  businesses={businesses}
                  onLoad={handleCloudLoad}
                  onAfterSave={() => {
                    setHighlightedTransactionIds([])
                    setForceAllUndoState(null)
                  }}
                />
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
                <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">${stats.totalDeductible.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">
                  Sched C: ${stats.schedCDeductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  {stats.healthInsuranceTotal > 0 && ` + Health: $${stats.healthInsuranceTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Profit (Sched C)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Revenue - Sched C expenses (Line 31)</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Est. Total Tax</CardTitle>
                <Calculator className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">${stats.estimatedTaxLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.totalRevenue > 0
                    ? `Effective rate: ${((stats.estimatedTaxLiability / stats.totalRevenue) * 100).toFixed(1)}% of revenue`
                    : "Federal + SE + CA (IRS brackets)"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mb-6 rounded-lg border border-orange-200/90 dark:border-orange-900/80 bg-orange-50/40 dark:bg-orange-950/25 px-4 py-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">2025 crypto &amp; investment outlays (reference)</p>
              <p className="text-xs text-muted-foreground">
                Total of expense rows in Crypto / Investments, Personal - Investments, Crypto Treasury Purchase, and Business
                Treasury Investment — not included in Schedule C or net profit.
              </p>
            </div>
            <div className="flex items-baseline gap-2 shrink-0">
              <span className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                $
                {stats.cryptoInvestmentsOutlay2025.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {stats.cryptoInvestmentsCount2025} transaction{stats.cryptoInvestmentsCount2025 === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* Tax Breakdown Detail Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Sched C Expenses</p>
              <p className="text-sm font-semibold text-blue-600">${stats.schedCDeductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Health Ins (S1-17)</p>
              <p className="text-sm font-semibold text-green-600">${stats.healthInsuranceTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">1/2 SE Tax Ded.</p>
              <p className="text-sm font-semibold text-green-600">${stats.seTaxDeduction.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">QBI (Sec 199A)</p>
              <p className="text-sm font-semibold text-green-600">${stats.qbiDeduction.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">SE Tax (SS+Med)</p>
              <p className="text-sm font-semibold">${stats.seTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Federal Tax</p>
              <p className="text-sm font-semibold">${stats.federalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">California Tax</p>
              <p className="text-sm font-semibold">${stats.caTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="rounded-lg border p-3 bg-green-50/50 dark:bg-green-950/20">
              <p className="text-xs text-muted-foreground">You Save</p>
              <p className="text-sm font-semibold text-green-600">${stats.taxSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>

          {ledgerTaxEstimate && currentBusiness && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tax Estimate (2025)</CardTitle>
                  <CardDescription>
                    Updates live with your ledger. Configure filing status and optional federal standard deduction.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Filing status</Label>
                      <Select
                        value={currentBusiness.profile.filingStatus === "married_joint" ? "married_joint" : "single"}
                        onValueChange={(v) =>
                          updateBusinessProfile({ filingStatus: v === "married_joint" ? "married_joint" : "single" })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="married_joint">Married filing jointly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Federal standard deduction override</Label>
                      <Input
                        className="h-9"
                        placeholder={`Default $${standardDeductionFederal(2025, currentBusiness.profile.filingStatus === "married_joint" ? "married_joint" : "single").toLocaleString()}`}
                        value={
                          currentBusiness.profile.federalStandardDeductionOverride != null &&
                          currentBusiness.profile.federalStandardDeductionOverride > 0
                            ? String(currentBusiness.profile.federalStandardDeductionOverride)
                            : ""
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/,/g, "").trim()
                          if (raw === "") {
                            updateBusinessProfile({ federalStandardDeductionOverride: null })
                            return
                          }
                          const n = Number.parseFloat(raw)
                          updateBusinessProfile({
                            federalStandardDeductionOverride: Number.isFinite(n) && n > 0 ? n : null,
                          })
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 border-t pt-3">
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
                  </div>
                  <div className="space-y-1.5 border-t pt-3 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Self-employment tax</span>
                      <span className="font-mono text-foreground">${ledgerTaxEstimate.selfEmploymentTax.toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Check: net profit × 0.9235 × 0.153 = ${ledgerTaxEstimate.selfEmploymentTaxSimplified.toFixed(2)}
                    </p>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">½ SE tax deduction (Schedule 1)</span>
                      <span className="font-mono text-foreground">−${ledgerTaxEstimate.halfSETaxDeduction.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Health insurance (Schedule 1 Line 17)</span>
                      <span className="font-mono text-foreground">−${ledgerTaxEstimate.healthInsuranceDeduction.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Adjusted gross income (AGI)</span>
                      <span className="font-mono text-foreground">${ledgerTaxEstimate.adjustedGrossIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Standard deduction (federal)</span>
                      <span className="font-mono text-foreground">−${ledgerTaxEstimate.federalStandardDeduction.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Taxable income (federal, after QBI)</span>
                      <span className="font-mono text-foreground">${ledgerTaxEstimate.taxableIncomeFederal.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 border-t pt-3">
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
                    <div className="flex justify-between gap-2 font-semibold border-t pt-2">
                      <span>Total estimated tax owed</span>
                      <span className="font-mono">${(ledgerTaxEstimate.totalEstimatedTaxOwed + stats.caLLCFee).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-3 text-xs space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">SEP-IRA max deferral (25% of net, cap $70,000)</span>
                      <span className="font-mono">${ledgerTaxEstimate.sepIraMaxDeferral.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Est. federal tax saved if max SEP (planning)</span>
                      <span className="font-mono">${ledgerTaxEstimate.estimatedFederalTaxSavedIfMaxSep.toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground pt-1">
                      SEP figures support 2026 planning; confirm with your CPA and IRS limits for your situation.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">2025 investment tax documents</CardTitle>
                  <CardDescription>
                    Reference list for brokerage and retirement forms (store files in your tax folder).
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                    {(currentBusiness.profile.investmentDocuments2025 ?? DEFAULT_INVESTMENT_DOCS_2025).map((doc) => (
                      <li key={doc.id}>
                        <span className="text-foreground">{doc.label}</span>
                        {doc.fileName && (
                          <span className="block text-xs font-mono text-muted-foreground">{doc.fileName}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

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
                    onRemoveTransactions={removeTransactions}
                    onAddTransaction={addManualTransaction}
                    onRefresh={() => {}}
                    isLoading={isLoading}
                    highlightedTransactionIds={highlightedTransactionIds}
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
                    onBulkUpdate={bulkUpdateTransactions}
                    businessName={currentBusiness.profile.businessName}
                    dateRange={{ start: "2025-01-01", end: "2025-12-31" }}
                    highlightedTransactionIds={highlightedTransactionIds}
                    ledgerTaxEstimate={ledgerTaxEstimate}
                    caLLCFee={stats.caLLCFee}
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
  "auto-insurance": "Auto Insurance",
  "merchant-fees": "Merchant & Platform Fees",
  contractors: "Contract Labor (1099s)",
  equipment: "Equipment & Depreciation",
  insurance: "Business Insurance",
  "health-insurance": "Self-Employed Health Insurance (Sched 1)",
  "bank-fees": "Bank & ATM Fees",
  interest: "Interest Expense",
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
  "license-fees": "License & Fee Expense",
  rent: "Rent Expense",
  "sep-ira": "SEP-IRA / Solo 401(k) (Sched 1)",
  waste: "Waste & Disposal",
  postage: "Postage & Shipping",
  cogs: "Cost of Service / COGS",
  depletion: "Depletion",
  "employee-benefit-programs": "Employee Benefit Programs",
  "mortgage-interest": "Mortgage Interest",
  "rent-vehicles-equipment": "Rent (Vehicles & Equipment)",
  "repairs-maintenance": "Repairs & Maintenance",
  supplies: "Supplies",
  wages: "Wages",
}

// Map wizard deduction IDs to actual transaction category names
const DEDUCTION_CATEGORY_MAP: Record<string, string[]> = {
  advertising: ["Advertising & Marketing", "Social Media & Online Presence", "Soccer Team Sponsorship"],
  marketing: ["Advertising & Marketing", "Social Media & Online Presence", "Soccer Team Sponsorship"],
  vehicle: ["Gas & Auto Expense", "Parking Expense"],
  "auto-insurance": ["Insurance Expense - Auto"],
  "merchant-fees": ["Merchant Processing Fees", "Merchant Fees Expense"],
  contractors: ["Contract Labor"],
  equipment: ["Equipment & Depreciation", "Computer Equipment Expense"],
  insurance: ["Insurance Expense - Business"],
  "health-insurance": ["Health Insurance"],
  "bank-fees": ["Bank & ATM Fee Expense"],
  interest: ["Interest Expense"],
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
  "license-fees": ["License & Fee Expense"],
  rent: ["Rent Expense"],
  "sep-ira": ["SEP-IRA Contribution"],
  waste: ["Waste & Disposal", "Waste & Sanitation Expense"],
  postage: ["Postage & Shipping Expense"],
  cogs: ["Cost of Service"],
  depletion: ["Depletion Expense"],
  "employee-benefit-programs": ["Employee Benefit Programs Expense"],
  "mortgage-interest": ["Mortgage Interest Expense"],
  "rent-vehicles-equipment": ["Rent Vehicles & Equipment Expense"],
  "repairs-maintenance": ["Repairs & Maintenance Expense"],
  supplies: ["Supplies Expense"],
  wages: ["Wages Expense"],
}

function DeductionsTab({ currentBusiness, stats }: { currentBusiness: BusinessData; stats: any }) {
  const deductionIds = currentBusiness.profile.deductions || []
  const deductionCardsData = deductionIds.map((deduction) => {
    const mappedCategories = DEDUCTION_CATEGORY_MAP[deduction] || []
    const relatedTransactions = currentBusiness.transactions.filter(
      (t) =>
        !t.isIncome &&
        t.is_personal !== true &&
        t.is_transfer !== true &&
        (mappedCategories.some((mc) => t.category === mc) ||
          (t.category || "").toLowerCase().includes(deduction.toLowerCase()) ||
          (t.description || "").toLowerCase().includes(deduction.toLowerCase())),
    )
    const totalAmount = relatedTransactions.reduce((sum, t) => sum + t.amount, 0)
    const deductPct = deduction === "meals" ? 0.5 : 1
    const deductibleAmount = totalAmount * deductPct
    return { deduction, relatedTransactions, totalAmount, deductibleAmount, deductPct }
  })

  const emptyDeductionCards = deductionCardsData.filter((d) => d.relatedTransactions.length === 0 || d.totalAmount === 0)
  const uncategorizedCount = currentBusiness.transactions.filter(
    (t) => !t.isIncome && (!t.category || t.category === "Uncategorized Expense" || t.category === ""),
  ).length

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
          {deductionIds.length > 0 ? (
            <div className="space-y-4">
              {(emptyDeductionCards.length > 0 || uncategorizedCount > 0) && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  {emptyDeductionCards.length > 0 && (
                    <p className="text-sm font-semibold text-yellow-800">
                      Configured but empty: {emptyDeductionCards.map((d) => DEDUCTION_LABELS[d.deduction] || d.deduction).join(", ")}
                    </p>
                  )}
                  {uncategorizedCount > 0 && (
                    <p className="text-xs text-yellow-800/80 mt-1">
                      {uncategorizedCount} uncategorized transactions need review to maximize deductions.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deductionCardsData.map(({ deduction, relatedTransactions, totalAmount, deductibleAmount, deductPct }) => {
                  // Effective marginal rate: ~15.3% SE + ~12% federal + ~4-6% CA for this income range
                  const effectiveRate = stats.totalRevenue > 0 ? Math.min(stats.estimatedTaxLiability / stats.totalRevenue, 0.40) : 0.25
                  const savings = Math.round(deductibleAmount * effectiveRate)

                  return (
                    <Card key={deduction} className={emptyDeductionCards.some((d) => d.deduction === deduction) ? "border-yellow-200 bg-yellow-50/30 hover:shadow-md transition-shadow" : "hover:shadow-md transition-shadow"}>
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
                        {relatedTransactions.length === 0 && (
                          <p className="text-xs text-yellow-800/80 mt-1">No matching transactions yet</p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
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
          <CardTitle>IRS Tax Minimization Waterfall</CardTitle>
          <CardDescription>Step-by-step: how your deductions reduce taxable income (bench.io-style P&L)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Income Statement (Schedule C)</p>
              <div className="flex justify-between items-center p-2.5 rounded-lg border">
                <span className="text-sm">Gross Revenue (Line 1)</span>
                <span className="font-bold">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg border">
                <span className="text-sm">Schedule C Expenses</span>
                <span className="font-bold text-blue-600">-${stats.schedCDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg border-2 border-foreground/20 font-semibold">
                <span className="text-sm">Net Profit (Line 31)</span>
                <span>${stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-1">Above-the-Line Deductions (Schedule 1)</p>
              <div className="flex justify-between items-center p-2.5 rounded-lg border">
                <span className="text-sm">1/2 Self-Employment Tax</span>
                <span className="font-bold text-green-600">-${stats.seTaxDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg border">
                <span className="text-sm">SE Health Insurance (Line 17)</span>
                <span className="font-bold text-green-600">-${stats.healthInsuranceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {stats.sepIraTotal > 0 && (
                <div className="flex justify-between items-center p-2.5 rounded-lg border">
                  <span className="text-sm">SEP-IRA (Line 16)</span>
                  <span className="font-bold text-green-600">-${stats.sepIraTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between items-center p-2.5 rounded-lg border">
                <span className="text-sm">QBI Deduction (Sec 199A, 20%)</span>
                <span className="font-bold text-green-600">-${stats.qbiDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg border">
                <span className="text-sm">Standard Deduction (Single, 2025)</span>
                <span className="font-bold text-green-600">-$15,000.00</span>
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-1">Tax Liability</p>
              <div className="flex justify-between items-center p-2.5 rounded-lg border">
                <span className="text-sm">Self-Employment Tax (SS + Medicare)</span>
                <span className="font-bold">${stats.seTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg border">
                <span className="text-sm">Federal Income Tax</span>
                <span className="font-bold">${stats.federalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg border">
                <span className="text-sm">California Income Tax</span>
                <span className="font-bold">${stats.caTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-2 border-green-200 dark:border-green-800 mt-2">
                <span className="font-bold">Total Estimated Tax</span>
                <span className="font-bold text-lg text-green-700 dark:text-green-400">${stats.estimatedTaxLiability.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-green-50/50 dark:bg-green-950/20">
                <span className="text-sm font-semibold">Saved by Your Deductions</span>
                <span className="font-bold text-green-600">${stats.taxSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Tax Minimization Strategies:</h4>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">1.</span>
                  <span><strong>SEP-IRA / Solo 401(k)</strong> — Contribute up to 25% of net self-employment earnings (max $70,000 for 2025). Can contribute until April filing deadline. At your income, this could save $2,000-$4,000+ in taxes.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">2.</span>
                  <span><strong>Home Office (Simplified)</strong> — $5/sq ft up to 300 sq ft = $1,500 additional deduction. Your bench.io shows $2,249 in facility/utilities -- make sure home office % is applied.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">3.</span>
                  <span><strong>Business Travel (Dec trip)</strong> — Flights, lodging, ground transport, 50% of meals while traveling are fully deductible. Document the business purpose for each day.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">4.</span>
                  <span><strong>Mileage Tracking</strong> — $0.70/mile for 2025. Your bench.io showed $1,600 gas + $1,805 auto insurance. Standard mileage may yield a higher deduction.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">5.</span>
                  <span><strong>Health Insurance (Sched 1)</strong> — Your $11K+ in premiums are deducted above-the-line, reducing AGI before all other calculations. This is already being applied.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">6.</span>
                  <span><strong>Section 179 / Equipment</strong> — Buy needed business equipment before Dec 31 to deduct the full cost this tax year instead of depreciating.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">7.</span>
                  <span><strong>Categorize Everything</strong> — Each uncategorized transaction is a potential missed deduction. Your bench.io 2024 showed $558 in "Awaiting Category" -- every dollar counts.</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      <RetirementOptimizer stats={stats} />
      <EstimatedTaxSafeHarbor transactions={currentBusiness.transactions} />
      <MappingCoverageAudit />
    </div>
  )
}
