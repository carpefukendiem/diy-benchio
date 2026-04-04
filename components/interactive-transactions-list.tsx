"use client"

import {
  useState,
  useMemo,
  useEffect,
  useDeferredValue,
  useRef,
  useCallback,
  memo,
  type MouseEvent as ReactMouseEvent,
  type ChangeEvent,
} from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { EditableCell } from "@/components/editable-cell"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { compressImageIfNeeded, readFileAsDataUrl } from "@/lib/client/compress-image"
import { RefreshCw, Search, Download, Edit3, FileText, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  account: string
  isIncome: boolean
  notes?: string
  receiptImageDataUrl?: string
  receiptImageFileName?: string
  is_personal?: boolean
  is_transfer?: boolean
  /** Non-revenue credits — omitted from revenue / Schedule C Line 1 */
  exclude?: boolean
  categorized_by?: "rule" | "ai" | "user" | null
  confidence?: number
  plaidTransactionId?: string
  merchantName?: string
  pending?: boolean
  manual_entry?: boolean
  source?: "manual_adjustment"
}

interface InteractiveTransactionsListProps {
  transactions: Transaction[]
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  onBulkUpdate: (updates: Array<{ id: string; updates: Partial<Transaction> }>) => Promise<void>
  onRemoveTransactions: (ids: string[]) => Promise<void>
  onAddTransaction: (transaction: Omit<Transaction, "id">) => Promise<void>
  onRefresh: () => void
  isLoading: boolean
  highlightedTransactionIds?: string[]
}

type SavedAuditView = {
  id: string
  name: string
  searchTerm: string
  categoryFilter: string
  accountFilter: string
  sortBy: "category" | "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "description"
  showChangedOnly: boolean
}

export const CATEGORIES = [
  // --- Income ---
  "Sales Revenue",
  "Service Income",
  "Freelance Income",
  "Interest Income",
  "Other Income",
  "Returns & Allowances",
  "Refunds Given",
  // --- COGS ---
  "Cost of Service",
  "Retail Product Sales COGS",
  // --- Operating Expenses (Schedule C lines 8-27) ---
  "Advertising & Marketing",
  "Soccer Team Sponsorship",
  "Social Media & Online Presence",
  "Contract Labor",
  "Equipment & Depreciation",
  "Computer Equipment Expense",
  "Insurance Expense - Business",
  "Insurance Expense - Auto",
  "Health Insurance",
  "Interest Expense",
  "Bank & ATM Fee Expense",
  "License & Fee Expense",
  "California LLC Fee",
  "Depletion Expense",
  "Employee Benefit Programs Expense",
  "Mortgage Interest Expense",
  "Rent Vehicles & Equipment Expense",
  "Repairs & Maintenance Expense",
  "Supplies Expense",
  "Wages Expense",
  "Merchant Processing Fees",
  "Merchant Fees Expense",
  "Office Supplies",
  "Office Supply Expense",
  "Office Kitchen Supplies",
  "Phone & Internet Expense",
  "Professional Service Expense",
  "Tax Software & Services",
  "Software & Web Hosting Expense",
  "Rent Expense",
  "Utilities Expense",
  "Business Meals Expense",
  "Travel Expense",
  "Gas & Auto Expense",
  "Parking Expense",
  "Postage & Shipping Expense",
  "Education & Training",
  "Home Office Expense",
  "Eye Care - Business Expense",
  "Client Gifts",
  "Waste & Disposal",
  "SEP-IRA Contribution",
  // === HAIR STYLIST / SALON PROFESSIONAL ===
  "Booth Rental Expense",
  "Hair Products & Color",
  "Styling Tools & Equipment",
  "Disposable Supplies",
  "Booking & Payment Software",
  "Laundry & Cleaning",
  "Cosmetology License & Permits",
  "Professional Liability Insurance",
  // --- Non-deductible / Capital items ---
  "Nondeductible Client Entertainment",
  "Business Treasury Investment",
  "Crypto Treasury Purchase",
  "Business Loan Proceeds",
  "Loan Repayment - Principal",
  "Loan Interest Expense",
  "Uncategorized Expense",
  // --- Transfers & Owner ---
  "Owner Draw",
  "Member Drawing - Ruben Ruiz",
  "Member Contribution - Ruben Ruiz",
  "Owner's Contribution",
  "Loan Proceeds",
  "Internal Transfer",
  "Credit Card Payment",
  "Brokerage Transfer",
  "Zelle / Venmo Transfer",
  // --- Personal ---
  "Personal Expense",
  "Personal - Groceries",
  "Personal - Entertainment",
  "Personal - Shopping",
  "Personal - Food & Drink",
  "Personal - Health",
  "Crypto / Investments",
].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

const TX_TABLE_COL_WIDTHS_KEY = "diy-benchio.txTable.colWidths"

type TxColWidths = {
  checkbox: number
  date: number
  description: number
  amount: number
  category: number
  account: number
}

const DEFAULT_TX_COL_WIDTHS: TxColWidths = {
  checkbox: 44,
  date: 118,
  description: 320,
  amount: 104,
  category: 240,
  account: 200,
}

const MIN_COL = 72

function ColumnResizeHandle({ onDragStart }: { onDragStart: (e: ReactMouseEvent) => void }) {
  return (
    <div
      className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize select-none hover:bg-primary/35"
      onMouseDown={(e: ReactMouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        onDragStart(e)
      }}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize column"
    />
  )
}

const ReceiptAttachmentCell = memo(function ReceiptAttachmentCell({
  transaction,
  onChange,
}: {
  transaction: Transaction
  onChange: (id: string, payload: { receiptImageDataUrl: string; receiptImageFileName: string } | null) => void
}) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const { toast } = useToast()
  const inputId = `receipt-file-${transaction.id}`

  const hasAttachment = Boolean(transaction.receiptImageDataUrl?.trim())
  const url = transaction.receiptImageDataUrl || ""
  const isImage = url.startsWith("data:image")

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    const ok =
      f.type.startsWith("image/") || f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    if (!ok) {
      toast({ title: "Unsupported file", description: "Use an image or PDF.", variant: "destructive" })
      return
    }
    try {
      const toRead = f.type.startsWith("image/") ? await compressImageIfNeeded(f) : f
      const dataUrl = await readFileAsDataUrl(toRead)
      onChange(transaction.id, { receiptImageDataUrl: dataUrl, receiptImageFileName: toRead.name })
      toast({ title: "Receipt attached", description: toRead.name })
    } catch {
      toast({ title: "Could not read file", variant: "destructive" })
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {hasAttachment && isImage && (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="shrink-0 rounded border overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <img src={url} alt="" className="w-11 h-11 object-cover" />
          </button>
        )}
        {hasAttachment && !isImage && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setViewerOpen(true)}>
            View PDF
          </Button>
        )}
        <label htmlFor={inputId} className="text-[10px] text-primary cursor-pointer underline decoration-primary/60">
          {hasAttachment ? "Replace" : "Attach receipt"}
        </label>
        <input id={inputId} type="file" accept="image/*,.pdf,application/pdf" className="sr-only" onChange={pickFile} />
        {hasAttachment && (
          <button
            type="button"
            className="text-[10px] text-destructive hover:underline"
            onClick={() => onChange(transaction.id, null)}
          >
            Remove
          </button>
        )}
      </div>
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[min(95vw,56rem)] max-h-[90vh] overflow-hidden flex flex-col gap-2">
          <DialogHeader>
            <DialogTitle className="text-sm">{transaction.receiptImageFileName || "Receipt"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[min(75vh,720px)] rounded border bg-muted/30">
            {isImage ? (
              <img src={url} alt="Receipt" className="max-w-full h-auto mx-auto" />
            ) : (
              <iframe
                src={url}
                className="w-full min-h-[560px] bg-white"
                title={transaction.receiptImageFileName || "Receipt PDF"}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})

const TransactionTableRow = memo(function TransactionTableRow({
  transaction,
  gridTemplate,
  isHighlighted,
  isSelected,
  onToggleSelect,
  onUpdate,
  onReceiptAttachmentChange,
  accounts,
  onDelete,
}: {
  transaction: Transaction
  gridTemplate: string
  isHighlighted: boolean
  isSelected: boolean
  onToggleSelect: () => void
  onUpdate: (id: string, field: keyof Transaction, value: unknown) => void
  onReceiptAttachmentChange: (id: string, payload: { receiptImageDataUrl: string; receiptImageFileName: string } | null) => void
  accounts: string[]
  onDelete?: () => void
}) {
  const isManualRow = Boolean(
    transaction.manual_entry || transaction.source === "manual_adjustment" || transaction.id.startsWith("manual-"),
  )
  const accountOptions = useMemo(() => {
    const set = new Set(accounts)
    if (transaction.account) set.add(transaction.account)
    return Array.from(set)
  }, [accounts, transaction.account])
  return (
    <div
      className={`gap-2 p-3 border rounded-lg hover:bg-muted transition-colors ${
        isSelected ? "bg-accent border-border" : ""
      } ${isHighlighted ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700" : ""} ${
        transaction.source === "manual_adjustment" ? "border-l-4 border-l-violet-500/80" : ""
      }`}
      style={{ display: "grid", gridTemplateColumns: gridTemplate, alignItems: "start" }}
    >
      <div className="flex items-start pt-1">
        <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect()} />
      </div>

      <div className="min-w-0 flex items-start pt-0.5">
        <EditableCell value={transaction.date} type="date" onSave={(value) => onUpdate(transaction.id, "date", value)} />
      </div>

      <div className="min-w-0 flex flex-col gap-1">
        <EditableCell
          value={transaction.description}
          type="text"
          noTruncate
          onSave={(value) => onUpdate(transaction.id, "description", value)}
        />
        <div className="flex flex-wrap gap-1">
          {isManualRow && (
            <Badge variant="secondary" className="text-[10px] w-fit">
              {transaction.source === "manual_adjustment" ? "Manual adjustment" : "Manual Entry"}
            </Badge>
          )}
          {transaction.merchantName && (
            <Badge variant="outline" className="text-xs w-fit max-w-full whitespace-normal break-words">
              {transaction.merchantName}
            </Badge>
          )}
          {transaction.exclude === true && (
            <Badge variant="secondary" className="text-[10px] w-fit">
              Non-revenue
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">Notes</span>
        <EditableCell
          value={transaction.notes || ""}
          type="text"
          noTruncate
          onSave={(value) => onUpdate(transaction.id, "notes", value)}
        />
        <ReceiptAttachmentCell transaction={transaction} onChange={onReceiptAttachmentChange} />
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive gap-1 w-fit"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>

      <div className="min-w-0 flex flex-col gap-1 items-stretch pt-0.5">
        <div className={`font-semibold ${transaction.isIncome ? "text-green-600" : "text-red-600"}`}>
          {transaction.isIncome ? "+" : "-"}$
          <EditableCell
            value={transaction.amount.toString()}
            type="number"
            onSave={(value) => onUpdate(transaction.id, "amount", Number.parseFloat(value))}
            className="inline"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[10px] px-2 w-full max-w-[9rem]"
          title="Flip whether this row counts as money in (+) or money out (−) for reports"
          onClick={(e) => {
            e.stopPropagation()
            void onUpdate(transaction.id, "isIncome", !transaction.isIncome)
          }}
        >
          {transaction.isIncome ? "Mark as expense (−)" : "Mark as income (+)"}
        </Button>
      </div>

      <div className="min-w-0 flex flex-col gap-1">
        <EditableCell
          value={transaction.category}
          type="select"
          options={CATEGORIES}
          noTruncate
          selectTriggerClassName="max-w-full"
          onSave={(value) => onUpdate(transaction.id, "category", value)}
        />
        {transaction.categorized_by && (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="text-[10px] whitespace-nowrap">
              {transaction.categorized_by === "rule" ? "Rules" : transaction.categorized_by === "ai" ? "AI" : "Manual"}
            </Badge>
            {typeof transaction.confidence === "number" && (
              <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                {Math.round(transaction.confidence * 100)}%
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex items-start pt-0.5">
        {isManualRow ? (
          <EditableCell
            value={transaction.account}
            type="text"
            noTruncate
            onSave={(value) => onUpdate(transaction.id, "account", value)}
          />
        ) : (
          <EditableCell
            value={transaction.account}
            type="select"
            options={accountOptions}
            noTruncate
            selectTriggerClassName="max-w-full"
            onSave={(value) => onUpdate(transaction.id, "account", value)}
          />
        )}
      </div>
    </div>
  )
})

export function InteractiveTransactionsList({
  transactions,
  onUpdateTransaction,
  onBulkUpdate,
  onRemoveTransactions,
  onAddTransaction,
  onRefresh,
  isLoading,
  highlightedTransactionIds = [],
}: InteractiveTransactionsListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [accountFilter, setAccountFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"category" | "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "description">("category")
  const [showChangedOnly, setShowChangedOnly] = useState(false)
  const [txViewTab, setTxViewTab] = useState<"all" | "manual">("all")
  const [savedViews, setSavedViews] = useState<SavedAuditView[]>([])
  const [newViewName, setNewViewName] = useState("")
  const [recurringCategory, setRecurringCategory] = useState("Phone & Internet Expense")
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set())
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkCategory, setBulkCategory] = useState("Phone & Internet Expense")
  const [bulkAccount, setBulkAccount] = useState("")
  const [colWidths, setColWidths] = useState<TxColWidths>(DEFAULT_TX_COL_WIDTHS)
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0])
  const [manualDescription, setManualDescription] = useState("")
  const [manualAmount, setManualAmount] = useState("")
  const [manualCategory, setManualCategory] = useState("Phone & Internet Expense")
  const [manualEntryType, setManualEntryType] = useState<"income" | "business_expense" | "personal" | "transfer">(
    "business_expense",
  )
  const [manualIsIncome, setManualIsIncome] = useState(false)
  const [manualAccountText, setManualAccountText] = useState("")
  const [manualNotes, setManualNotes] = useState("")
  const [manualReceiptFile, setManualReceiptFile] = useState<File | null>(null)
  const [auditToolkitExpanded, setAuditToolkitExpanded] = useState(false)
  const { toast } = useToast()

  const highlightedSet = useMemo(() => new Set(highlightedTransactionIds), [highlightedTransactionIds])
  const deferredSearch = useDeferredValue(searchTerm)
  const colWidthsRef = useRef(colWidths)
  colWidthsRef.current = colWidths

  const manualReceiptPreviewUrl = useMemo(() => {
    if (!manualReceiptFile || !manualReceiptFile.type.startsWith("image/")) return null
    return URL.createObjectURL(manualReceiptFile)
  }, [manualReceiptFile])

  useEffect(() => {
    return () => {
      if (manualReceiptPreviewUrl) URL.revokeObjectURL(manualReceiptPreviewUrl)
    }
  }, [manualReceiptPreviewUrl])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TX_TABLE_COL_WIDTHS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<TxColWidths>
      setColWidths((prev) => ({ ...prev, ...parsed }))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("transactions.savedAuditViews")
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) setSavedViews(parsed)
    } catch {
      // ignore localStorage parse errors
    }
  }, [])

  const persistViews = (views: SavedAuditView[]) => {
    setSavedViews(views)
    try {
      localStorage.setItem("transactions.savedAuditViews", JSON.stringify(views))
    } catch {
      // ignore localStorage write errors
    }
  }

  const filteredTransactions = useMemo(() => {
    const ledger =
      txViewTab === "manual"
        ? transactions.filter(
            (t) => t.manual_entry || t.source === "manual_adjustment" || t.id.startsWith("manual-"),
          )
        : transactions
    const filtered = ledger.filter((transaction) => {
      const sl = deferredSearch.toLowerCase()
      const matchesSearch = !deferredSearch.trim() ||
        transaction.description.toLowerCase().includes(sl) ||
        transaction.merchantName?.toLowerCase().includes(sl) ||
        transaction.category?.toLowerCase().includes(sl) ||
        transaction.amount.toString().includes(deferredSearch)
      const matchesCategory = categoryFilter === "all" || 
        (categoryFilter === "uncategorized" ? (!transaction.category || transaction.category === "Uncategorized Expense") : transaction.category === categoryFilter)
      const matchesAccount = accountFilter === "all" || transaction.account === accountFilter
      const matchesChangedOnly = !showChangedOnly || highlightedSet.has(transaction.id)
      return matchesSearch && matchesCategory && matchesAccount && matchesChangedOnly
    })

    // Keep ordering deterministic so category edits re-position rows immediately.
    return filtered.slice().sort((a, b) => {
      const dateA = Date.parse(a.date || "")
      const dateB = Date.parse(b.date || "")
      const catA = (a.category || "").toLowerCase()
      const catB = (b.category || "").toLowerCase()

      if (sortBy === "category" && catA !== catB) return catA.localeCompare(catB)
      if (sortBy === "date_desc" && Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateB - dateA
      if (sortBy === "date_asc" && Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateA - dateB
      if (sortBy === "amount_desc" && a.amount !== b.amount) return b.amount - a.amount
      if (sortBy === "amount_asc" && a.amount !== b.amount) return a.amount - b.amount
      if (sortBy === "description") return (a.description || "").localeCompare(b.description || "")

      // Stable fallback order
      if (catA !== catB) return catA.localeCompare(catB)
      if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateB - dateA
      if (a.amount !== b.amount) return b.amount - a.amount
      return (a.description || "").localeCompare(b.description || "")
    })
  }, [transactions, txViewTab, deferredSearch, categoryFilter, accountFilter, sortBy, showChangedOnly, highlightedSet])

  const accounts = useMemo(() => Array.from(new Set(transactions.map((t) => t.account))), [transactions])
  const defaultAccount = accounts[0] || "Business Checking"
  useEffect(() => {
    if (accounts.length === 0) return
    setBulkAccount((prev) => (prev && accounts.includes(prev) ? prev : accounts[0]))
  }, [accounts])

  const businessAccounts = useMemo(
    () =>
      accounts.filter((a) => {
        const x = a.toLowerCase()
        return !x.includes("personal") && !x.includes("investment")
      }),
    [accounts],
  )
  const [businessTargetAccount, setBusinessTargetAccount] = useState("")

  useEffect(() => {
    if (businessAccounts.length === 0) return
    try {
      const s = localStorage.getItem("transactions.businessTargetAccount")
      if (s && businessAccounts.includes(s)) {
        setBusinessTargetAccount(s)
        return
      }
    } catch {
      // ignore
    }
    setBusinessTargetAccount((prev) => (prev && businessAccounts.includes(prev) ? prev : businessAccounts[0]))
  }, [businessAccounts])

  const persistBusinessTargetAccount = useCallback((v: string) => {
    setBusinessTargetAccount(v)
    try {
      localStorage.setItem("transactions.businessTargetAccount", v)
    } catch {
      // ignore
    }
  }, [])

  const gridTemplate = useMemo(
    () =>
      `${colWidths.checkbox}px ${colWidths.date}px ${colWidths.description}px ${colWidths.amount}px ${colWidths.category}px ${colWidths.account}px`,
    [colWidths],
  )

  const scrollParentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: filteredTransactions.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 200,
    overscan: 12,
  })
  const virtualItems = rowVirtualizer.getVirtualItems()
  const firstVisibleIndex = virtualItems[0]?.index ?? 0
  const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? 0
  const visibleStart = filteredTransactions.length === 0 ? 0 : firstVisibleIndex + 1
  const visibleEnd = filteredTransactions.length === 0 ? 0 : Math.min(lastVisibleIndex + 1, filteredTransactions.length)
  const scrollProgressPct =
    filteredTransactions.length <= 1 ? 0 : Math.round((firstVisibleIndex / (filteredTransactions.length - 1)) * 100)
  const filteredNetSum = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + (t.isIncome ? t.amount : -t.amount), 0),
    [filteredTransactions],
  )

  const persistColWidths = useCallback((w: TxColWidths) => {
    try {
      localStorage.setItem(TX_TABLE_COL_WIDTHS_KEY, JSON.stringify(w))
    } catch {
      // ignore
    }
  }, [])

  const startResize = useCallback(
    (key: keyof TxColWidths) => (e: ReactMouseEvent) => {
      const startX = e.clientX
      const startW = colWidthsRef.current[key]
      const onMove = (ev: globalThis.MouseEvent) => {
        const next = Math.max(MIN_COL, Math.round(startW + (ev.clientX - startX)))
        setColWidths((prev) => ({ ...prev, [key]: next }))
      }
      const onUp = () => {
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
        persistColWidths(colWidthsRef.current)
      }
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
    },
    [persistColWidths],
  )

  const auditYear = useMemo(() => {
    const years = transactions
      .map((t) => Number((t.date || "").slice(0, 4)))
      .filter((y) => Number.isFinite(y) && y > 2000)
    if (years.length === 0) return new Date().getFullYear()
    return years.sort((a, b) => b - a)[0]
  }, [transactions])

  const phoneInternetHints = useMemo(
    () => [
      "cox",
      "verizon",
      "spectrum",
      "xfinity",
      "comcast",
      "frontier",
      "at&t",
      "t-mobile",
      "tmobile",
      "sonic",
      "google fiber",
      "starlink",
      "earthlink",
      "optimum",
      "centurylink",
      "lumen",
      "breezeline",
      "mediacom",
    ],
    [],
  )

  const phoneTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const isYear = (t.date || "").startsWith(String(auditYear))
      if (!isYear) return false
      const dl = (t.description || "").toLowerCase()
      if (t.category === "Phone & Internet Expense") return true
      return phoneInternetHints.some((h) => dl.includes(h))
    })
  }, [transactions, auditYear, phoneInternetHints])

  const missingPhoneMonths = useMemo(() => {
    const present = new Set(
      phoneTransactions
        .map((t) => Number((t.date || "").slice(5, 7)))
        .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12)
    )
    const missing: number[] = []
    for (let m = 1; m <= 12; m++) if (!present.has(m)) missing.push(m)
    return missing
  }, [phoneTransactions])

  const cryptoExchangeTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const dl = (t.description || "").toLowerCase()
      return dl.includes("kraken") || dl.includes("coinbase")
    })
  }, [transactions])

  const upworkAudit = useMemo(() => {
    const candidates = transactions.filter((t) => {
      const text = `${t.description || ""} ${t.merchantName || ""}`.toLowerCase().replace(/\s+/g, " ")
      const explicitUpwork = text.includes("upwork") || text.includes("upwk") || text.includes("from upwork ca")
      const transferPhrase = text.includes("money transfer authorized")
      const likelyUpworkTransfer = transferPhrase && text.includes("from upwork")
      return explicitUpwork || likelyUpworkTransfer
    })
    const totalAmount = candidates.reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0)
    const miscategorized = candidates.filter(
      (t) => t.category !== "Freelance Income" || t.isIncome !== true || t.is_personal === true || t.is_transfer === true,
    )
    const miscategorizedAmount = miscategorized.reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0)
    return { candidates, totalAmount, miscategorized, miscategorizedAmount }
  }, [transactions])

  const allDuplicateGroups = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const merchantish = (t.merchantName || t.description || "").toLowerCase().replace(/\s+/g, " ").trim()
      const key = `${t.date}|${Number(t.amount).toFixed(2)}|${merchantish}`
      const arr = groups.get(key) || []
      arr.push(t)
      groups.set(key, arr)
    }
    return Array.from(groups.values())
      .filter((g) => g.length > 1)
      .sort((a, b) => b.length - a.length)
  }, [transactions])
  const duplicateGroups = useMemo(() => (auditToolkitExpanded ? allDuplicateGroups : []), [allDuplicateGroups, auditToolkitExpanded])

  const handleRemoveDuplicateTransactions = useCallback(async () => {
    if (transactions.length === 0) return

    const groups = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const merchantish = (t.merchantName || t.description || "").toLowerCase().replace(/\s+/g, " ").trim()
      const key = `${t.date}|${Number(t.amount).toFixed(2)}|${merchantish}`
      const arr = groups.get(key) || []
      arr.push(t)
      groups.set(key, arr)
    }
    const duplicateSets = Array.from(groups.values()).filter((g) => g.length > 1)
    if (duplicateSets.length === 0) {
      toast({ title: "No duplicates found", description: "Every transaction appears unique by date + amount + description." })
      return
    }

    const score = (t: Transaction): number => {
      const account = (t.account || "").toLowerCase()
      const accountScore = account.includes("personal") ? -3 : 3
      const provenanceScore = t.categorized_by === "user" ? 4 : t.categorized_by === "ai" ? 2 : t.categorized_by === "rule" ? 1 : 0
      const confidenceScore = Math.round((t.confidence ?? 0) * 10)
      const attachmentScore = t.receiptImageDataUrl ? 2 : 0
      const notesScore = t.notes?.trim() ? 1 : 0
      return accountScore + provenanceScore + confidenceScore + attachmentScore + notesScore
    }

    const toRemove: string[] = []
    for (const set of duplicateSets) {
      const sorted = [...set].sort((a, b) => score(b) - score(a))
      toRemove.push(...sorted.slice(1).map((t) => t.id))
    }
    if (toRemove.length === 0) return

    await onRemoveTransactions(toRemove)
    toast({
      title: "Duplicates removed",
      description: `Removed ${toRemove.length} duplicate row(s) across ${duplicateSets.length} duplicate set(s).`,
    })
  }, [transactions, onRemoveTransactions, toast])

  const recurringCoverage = useMemo(() => {
    if (!auditToolkitExpanded) return { count: 0, coveredMonths: 0, missingMonths: [] as number[] }
    const tx = transactions.filter((t) => {
      const isYear = (t.date || "").startsWith(String(auditYear))
      return isYear && (t.category || "") === recurringCategory
    })
    const present = new Set(
      tx.map((t) => Number((t.date || "").slice(5, 7))).filter((m) => Number.isFinite(m) && m >= 1 && m <= 12)
    )
    const missing: number[] = []
    for (let m = 1; m <= 12; m++) if (!present.has(m)) missing.push(m)
    return { count: tx.length, coveredMonths: present.size, missingMonths: missing }
  }, [transactions, auditYear, recurringCategory, auditToolkitExpanded])

  const handleAddManualTransaction = async () => {
    const amount = Number(manualAmount)
    if (!manualDate || !manualDescription.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Missing fields", description: "Date, description, and amount are required.", variant: "destructive" })
      return
    }
    try {
      const inferFlags = (category: string) => {
        const c = (category || "").toLowerCase()
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
        const exclude = category === "Owner's Contribution" || category === "Loan Proceeds"
        return { is_personal, is_transfer, exclude }
      }

      let receiptImageDataUrl: string | undefined
      let receiptImageFileName: string | undefined
      if (manualReceiptFile) {
        const toRead = manualReceiptFile.type.startsWith("image/")
          ? await compressImageIfNeeded(manualReceiptFile)
          : manualReceiptFile
        receiptImageDataUrl = await readFileAsDataUrl(toRead)
        receiptImageFileName = toRead.name
      }

      const revenueCategories = new Set([
        "Sales Revenue",
        "Service Income",
        "Freelance Income",
        "Interest Income",
        "Other Income",
        "Refunds Given",
        "Member Contribution - Ruben Ruiz",
      ])

      let isIncome = manualIsIncome
      let is_personal = false
      let is_transfer = false

      if (manualEntryType === "income") {
        isIncome = true
        is_personal = false
        is_transfer = false
      } else if (manualEntryType === "business_expense") {
        isIncome = false
      } else if (manualEntryType === "personal") {
        isIncome = false
        is_personal = true
        is_transfer = false
      } else if (manualEntryType === "transfer") {
        isIncome = false
        is_transfer = true
      }

      const cf = inferFlags(manualCategory)
      if (cf.is_transfer) is_transfer = true
      if (cf.is_personal) is_personal = true
      if (revenueCategories.has(manualCategory)) isIncome = true
      if (cf.exclude) isIncome = false

      await onAddTransaction({
        date: manualDate,
        description: manualDescription.trim(),
        amount: Math.abs(amount),
        category: manualCategory,
        account: manualAccountText.trim() || defaultAccount,
        isIncome,
        exclude: cf.exclude,
        notes: manualNotes.trim(),
        ...(receiptImageDataUrl
          ? { receiptImageDataUrl, receiptImageFileName: receiptImageFileName ?? "receipt" }
          : {}),
        is_personal,
        is_transfer,
        categorized_by: "user" as const,
        confidence: 1,
      })
      toast({ title: "Manual transaction added", description: "You can edit category, notes, or attach a receipt on the row anytime." })
      setManualDescription("")
      setManualAmount("")
      setManualNotes("")
      setManualAccountText("")
      setManualEntryType("business_expense")
      setManualReceiptFile(null)
      setShowManualForm(false)
    } catch {
      toast({ title: "Error", description: "Failed to add manual transaction", variant: "destructive" })
    }
  }

  const handleMarkCryptoPersonal = async () => {
    if (cryptoExchangeTransactions.length === 0) return
    const updates = cryptoExchangeTransactions.map((t) => ({
      id: t.id,
      updates: {
        category: "Crypto / Investments",
        isIncome: false,
        is_personal: true,
        is_transfer: true,
        categorized_by: "user" as const,
        confidence: 1,
      },
    }))
    await onBulkUpdate(updates)
    toast({
      title: "Crypto exchange transactions updated",
      description: `${updates.length} transaction${updates.length === 1 ? "" : "s"} marked as personal/excluded.`,
    })
  }

  const handleFixUpworkPayouts = async () => {
    if (upworkAudit.miscategorized.length === 0) {
      toast({
        title: "Upwork payouts already clean",
        description: `Audited ${upworkAudit.candidates.length} candidate payout(s).`,
      })
      return
    }
    const updates = upworkAudit.miscategorized.map((t) => ({
      id: t.id,
      updates: {
        category: "Freelance Income",
        isIncome: true,
        is_personal: false,
        is_transfer: false,
        categorized_by: "rule" as const,
        confidence: 0.99,
      },
    }))
    await onBulkUpdate(updates)
    toast({
      title: "Upwork payouts fixed",
      description: `${updates.length} transaction(s) moved to Freelance Income.`,
    })
  }

  const resetFilters = () => {
    setSearchTerm("")
    setCategoryFilter("all")
    setAccountFilter("all")
    setSortBy("category")
    setShowChangedOnly(false)
  }

  const saveCurrentView = () => {
    const name = newViewName.trim()
    if (!name) return
    const view: SavedAuditView = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name,
      searchTerm,
      categoryFilter,
      accountFilter,
      sortBy,
      showChangedOnly,
    }
    persistViews([view, ...savedViews].slice(0, 12))
    setNewViewName("")
    toast({ title: "Audit view saved", description: `"${name}" added.` })
  }

  const applySavedView = (view: SavedAuditView) => {
    setSearchTerm(view.searchTerm)
    setCategoryFilter(view.categoryFilter)
    setAccountFilter(view.accountFilter)
    setSortBy(view.sortBy)
    setShowChangedOnly(view.showChangedOnly)
  }

  const deleteSavedView = (id: string) => {
    persistViews(savedViews.filter((v) => v.id !== id))
  }

  const handleTransactionUpdate = useCallback(
    async (transactionId: string, field: keyof Transaction, value: unknown) => {
      try {
        if (field === "isIncome") {
          await onUpdateTransaction(transactionId, {
            isIncome: Boolean(value),
            categorized_by: "user",
            confidence: 1,
          })
          return
        }

        if (field === "notes") {
          await onUpdateTransaction(transactionId, {
            notes: String(value ?? ""),
            categorized_by: "user",
            confidence: 1,
          })
          return
        }

        const updates: Partial<Transaction> = { [field]: value } as Partial<Transaction>

        // Auto-detect income vs expense based on category
        if (field === "category") {
          const revenueCategories = [
            "Sales Revenue",
            "Service Income",
            "Freelance Income",
            "Interest Income",
            "Other Income",
            "Refunds Given",
            "Member Contribution - Ruben Ruiz",
          ]
          const cat = String(value || "")
          updates.isIncome = revenueCategories.includes(cat)
          const c = cat.toLowerCase()
          updates.is_personal = c.includes("personal") || c.includes("crypto / investments")
          updates.is_transfer =
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
          updates.exclude = cat === "Owner's Contribution" || cat === "Loan Proceeds"
          updates.categorized_by = "user"
          updates.confidence = 1
        }

        await onUpdateTransaction(transactionId, updates)
      } catch {
        toast({
          title: "Error",
          description: "Failed to update transaction",
          variant: "destructive",
        })
      }
    },
    [onUpdateTransaction, toast],
  )

  const handleReceiptAttachmentChange = useCallback(
    async (id: string, payload: { receiptImageDataUrl: string; receiptImageFileName: string } | null) => {
      await onUpdateTransaction(id, {
        receiptImageDataUrl: payload?.receiptImageDataUrl ?? "",
        receiptImageFileName: payload?.receiptImageFileName ?? "",
        categorized_by: "user",
        confidence: 1,
      })
    },
    [onUpdateTransaction],
  )

  const handleBulkCategoryUpdate = async (category: string) => {
    if (selectedTransactions.size === 0) return

    const c = (category || "").toLowerCase()
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
    const exclude = category === "Owner's Contribution" || category === "Loan Proceeds"

    const updates = Array.from(selectedTransactions).map((id) => ({
      id,
      updates: {
        category,
        isIncome: [
          "Sales Revenue",
          "Service Income",
          "Freelance Income",
          "Interest Income",
          "Other Income",
          "Refunds Given",
          "Member Contribution - Ruben Ruiz",
        ].includes(category),
        is_personal,
        is_transfer,
        exclude,
        categorized_by: "user" as const,
        confidence: 1,
      },
    }))

    await onBulkUpdate(updates)
    setSelectedTransactions(new Set())
    setBulkEditMode(false)
  }

  const handleBulkAccountUpdate = async (account: string) => {
    if (selectedTransactions.size === 0 || !account) return
    const updates = Array.from(selectedTransactions).map((id) => ({
      id,
      updates: {
        account,
        categorized_by: "user" as const,
        confidence: 1,
      },
    }))
    await onBulkUpdate(updates)
    setSelectedTransactions(new Set())
    setBulkEditMode(false)
    toast({
      title: "Account updated",
      description: `${updates.length} transaction(s) moved to ${account}.`,
    })
  }

  const handleMoveSelectedToBusinessBooks = useCallback(async () => {
    if (selectedTransactions.size === 0 || !businessTargetAccount) {
      toast({
        title: "Choose a business account",
        description: "Select rows and pick which business account should own these transactions.",
        variant: "destructive",
      })
      return
    }
    const updates = Array.from(selectedTransactions).map((id) => ({
      id,
      updates: {
        account: businessTargetAccount,
        is_personal: false,
        is_transfer: false,
        categorized_by: "user" as const,
        confidence: 1,
      },
    }))
    await onBulkUpdate(updates)
    setSelectedTransactions(new Set())
    setBulkEditMode(false)
    toast({
      title: "Moved to business books",
      description: `${updates.length} transaction(s) assigned to ${businessTargetAccount} (not personal / not transfer). Set category if needed.`,
    })
  }, [selectedTransactions, businessTargetAccount, onBulkUpdate, toast])

  const toggleTransactionSelection = (transactionId: string) => {
    const newSelection = new Set(selectedTransactions)
    if (newSelection.has(transactionId)) {
      newSelection.delete(transactionId)
    } else {
      newSelection.add(transactionId)
    }
    setSelectedTransactions(newSelection)
  }

  const selectAllVisible = () => {
    setSelectedTransactions(new Set(filteredTransactions.map((t) => t.id)))
  }

  const clearSelection = () => {
    setSelectedTransactions(new Set())
    setBulkEditMode(false)
  }

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Description",
      "Merchant",
      "Amount",
      "Category",
      "Account",
      "Type",
      "Source",
      "Notes",
      "Receipt file",
    ]
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map((t) =>
        [
          t.date,
          `"${t.description}"`,
          `"${t.merchantName || ""}"`,
          t.amount,
          `"${t.category}"`,
          `"${t.account}"`,
          t.isIncome ? "Income" : "Expense",
          `"${t.source === "manual_adjustment" ? "manual_adjustment" : "statement"}"`,
          `"${(t.notes || "").replace(/"/g, '""')}"`,
          `"${(t.receiptImageFileName || "").replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const exportToPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" })

      // Title
      doc.setFontSize(16)
      doc.text("Transaction Report", 14, 15)
      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text(`Generated: ${new Date().toLocaleDateString()} | ${filteredTransactions.length} transactions`, 14, 21)
      doc.setTextColor(0)

      // Summary
      const totalIncome = filteredTransactions.filter(t => t.isIncome).reduce((s, t) => s + t.amount, 0)
      const totalExpenses = filteredTransactions.filter(t => !t.isIncome).reduce((s, t) => s + t.amount, 0)
      doc.setFontSize(10)
      doc.text(`Total Income: $${totalIncome.toLocaleString("en", { minimumFractionDigits: 2 })}`, 14, 28)
      doc.text(`Total Expenses: $${totalExpenses.toLocaleString("en", { minimumFractionDigits: 2 })}`, 100, 28)
      doc.text(`Net: $${(totalIncome - totalExpenses).toLocaleString("en", { minimumFractionDigits: 2 })}`, 200, 28)

      const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)
      // Table
      const tableRows = filteredTransactions.map((t) => [
        t.date,
        trunc(t.description, 36),
        trunc(t.merchantName || "", 22),
        `$${t.amount.toLocaleString("en", { minimumFractionDigits: 2 })}`,
        trunc(t.category, 26),
        trunc(t.account, 18),
        t.isIncome ? "Income" : "Expense",
        trunc(t.notes || "", 22),
        t.receiptImageFileName ? trunc(t.receiptImageFileName, 14) : "",
      ])

      autoTable(doc, {
        startY: 33,
        head: [["Date", "Description", "Merchant", "Amount", "Category", "Account", "Type", "Notes", "Receipt"]],
        body: tableRows,
        styles: { fontSize: 6.5, cellPadding: 1.2 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 48 },
          2: { cellWidth: 26 },
          3: { cellWidth: 22, halign: "right" },
          4: { cellWidth: 32 },
          5: { cellWidth: 22 },
          6: { cellWidth: 16 },
          7: { cellWidth: 28 },
          8: { cellWidth: 18 },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data: any) => {
          if (data.column.index === 6 && data.section === "body") {
            data.cell.styles.textColor = data.cell.raw === "Income" ? [22, 163, 74] : [220, 38, 38]
          }
        },
      })

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text(`DIY Bench.io | Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 7)
      }

      doc.save(`transactions-${new Date().toISOString().split("T")[0]}.pdf`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export to PDF",
        variant: "destructive",
      })
    }
  }

  const exportToExcel = async () => {
    try {
      const response = await fetch("/api/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: filteredTransactions }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `transactions-${new Date().toISOString().split("T")[0]}.xlsx`
        a.click()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export to Excel",
        variant: "destructive",
      })
    }
  }

  const uncategorizedCount = useMemo(() => {
    return transactions.filter(t => !t.category || t.category === "Uncategorized Expense" || t.category === "").length
  }, [transactions])

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="space-y-2 min-w-0">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              Live Transaction Editor
              {uncategorizedCount > 0 && (
                <Badge variant="destructive" className="text-xs cursor-pointer" onClick={() => setCategoryFilter("uncategorized")}>
                  {uncategorizedCount} uncategorized
                </Badge>
              )}
            </CardTitle>
            <Tabs value={txViewTab} onValueChange={(v) => setTxViewTab(v as "all" | "manual")}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-3">
                  All transactions
                </TabsTrigger>
                <TabsTrigger value="manual" className="text-xs px-3">
                  Manual entry
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <CardDescription>
              Click any cell to edit {"\u2022"} Use Manual entry to add or review hand-entered lines {"\u2022"} Select multiple for
              bulk actions ({filteredTransactions.length} shown)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Sync
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters and Bulk Actions */}
        <div className="space-y-4 mb-6">
          <div className="rounded-lg border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-700 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">
                <p className="font-medium">Audit & Quick Fix</p>
                <p className="text-muted-foreground">
                  Phone/Internet in {auditYear}: {phoneTransactions.length} txn across {12 - missingPhoneMonths.length}/12 months
                  {missingPhoneMonths.length > 0 ? ` (missing ${missingPhoneMonths.length})` : ""}
                </p>
                <p className="text-xs text-muted-foreground pt-1">
                  Upwork audit: {upworkAudit.candidates.length} candidate payout(s), total $
                  {upworkAudit.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {upworkAudit.miscategorized.length > 0
                    ? ` • ${upworkAudit.miscategorized.length} miscategorized ($${upworkAudit.miscategorizedAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                    : " • all categorized as Freelance Income"}
                </p>
                <p className="text-xs text-muted-foreground pt-1">
                  Transfers between your own accounts are usually categorized as Internal Transfer, Credit Card Payment, Zelle / Venmo
                  Transfer, Member Drawing, Member Contribution, Owner Draw, or Brokerage Transfer (and marked as transfer in the sheet).
                  Search those category names or descriptions like “online transfer,” “payment thank you,” or “zelle.”
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleFixUpworkPayouts}
                  disabled={upworkAudit.miscategorized.length === 0}
                >
                  Fix Upwork payouts
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowManualForm((v) => !v)}>
                  {showManualForm ? "Hide manual entry form" : "Manual entry form"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAuditToolkitExpanded((v) => !v)}
                  title="Show/hide heavy audit panels"
                >
                  {auditToolkitExpanded ? "Hide details" : "Show details"}
                </Button>
              </div>
            </div>
            {cryptoExchangeTransactions.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{cryptoExchangeTransactions.length} Kraken/Coinbase txn detected</Badge>
                <Button size="sm" variant="secondary" onClick={handleMarkCryptoPersonal}>
                  Mark Kraken/Coinbase as Personal/Excluded
                </Button>
              </div>
            )}
            {missingPhoneMonths.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Missing months (phone/internet): {missingPhoneMonths.map((m) => String(m).padStart(2, "0")).join(", ")}
              </p>
            )}

            {auditToolkitExpanded && (
              <>
                <div className="pt-1 border-t border-amber-200/80 dark:border-amber-800/60">
                  <p className="text-xs font-medium mb-1">Monthly completeness checker</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={recurringCategory} onValueChange={setRecurringCategory}>
                      <SelectTrigger className="w-[250px] h-8">
                        <SelectValue placeholder="Pick category to audit" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="outline">{recurringCoverage.coveredMonths}/12 months covered</Badge>
                    {recurringCoverage.missingMonths.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Missing: {recurringCoverage.missingMonths.map((m) => String(m).padStart(2, "0")).join(", ")}
                      </span>
                    ) : (
                      <span className="text-xs text-green-700 dark:text-green-300">No missing months</span>
                    )}
                  </div>
                </div>

                <div className="pt-1 border-t border-amber-200/80 dark:border-amber-800/60">
                  <p className="text-xs font-medium mb-1">Duplicate detector</p>
                  {duplicateGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No obvious duplicates by date + amount + merchant/description.</p>
                  ) : (
                    <div className="space-y-2">
                      <Button size="sm" variant="secondary" onClick={handleRemoveDuplicateTransactions}>
                        Remove duplicate rows (full ledger)
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        Keeps the strongest row per duplicate set (prefers business account + manual edits + receipts/notes).
                      </p>
                      {duplicateGroups.slice(0, 5).map((group, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          {group.length}x — {group[0].date} — ${group[0].amount.toFixed(2)} — {(group[0].merchantName || group[0].description).slice(0, 80)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {showManualForm && (
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Add business expenses paid from personal accounts, cash, or anything missing from statements. You can attach a receipt
                image or PDF; it is saved with this business in your browser (large libraries can fill storage—compress photos if needed).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-2 flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                </div>
                <div className="md:col-span-4 flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Input
                    placeholder="e.g. Office supplies, client lunch"
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Amount (positive)</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} />
                </div>
                <div className="md:col-span-2 flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select value={manualEntryType} onValueChange={(v) => setManualEntryType(v as typeof manualEntryType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="business_expense">Business expense</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 flex flex-col gap-1 min-w-0">
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <Select
                    value={manualCategory}
                    onValueChange={(v) => {
                      setManualCategory(v)
                      setManualIsIncome(
                        [
                          "Sales Revenue",
                          "Service Income",
                          "Freelance Income",
                          "Interest Income",
                          "Other Income",
                          "Refunds Given",
                          "Member Contribution - Ruben Ruiz",
                        ].includes(v),
                      )
                    }}
                  >
                    <SelectTrigger className="min-w-0">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-12 flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Account (free text)</Label>
                  <Input
                    placeholder="e.g. Personal Checking, Wife's Chase Card, Cash"
                    value={manualAccountText}
                    onChange={(e) => setManualAccountText(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-start">
                <div className="md:col-span-4 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Notes (optional)</span>
                  <textarea
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="e.g. Q4 toner, client lunch with Jane"
                    rows={3}
                    className="flex min-h-[4.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-2 rounded-md border border-dashed p-3">
                  <span className="text-xs text-muted-foreground">Receipt image or PDF (optional)</span>
                  {manualReceiptPreviewUrl ? (
                    <img src={manualReceiptPreviewUrl} alt="" className="w-full max-h-32 object-contain rounded border bg-muted/40" />
                  ) : manualReceiptFile ? (
                    <span className="text-xs break-all">{manualReceiptFile.name}</span>
                  ) : null}
                  <label className="text-xs text-primary cursor-pointer underline w-fit">
                    Choose file
                    <input
                      type="file"
                      accept="image/*,.pdf,application/pdf"
                      className="sr-only"
                      onChange={(e) => setManualReceiptFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {manualReceiptFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs w-fit px-2"
                      onClick={() => setManualReceiptFile(null)}
                    >
                      Clear file
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowManualForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAddManualTransaction}>
                  Save transaction
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions or merchants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="uncategorized">⚠ Uncategorized Only</SelectItem>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account} value={account}>
                    {account}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[210px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Sort: Category (A-Z)</SelectItem>
                <SelectItem value="date_desc">Sort: Date (Newest)</SelectItem>
                <SelectItem value="date_asc">Sort: Date (Oldest)</SelectItem>
                <SelectItem value="amount_desc">Sort: Amount (High-Low)</SelectItem>
                <SelectItem value="amount_asc">Sort: Amount (Low-High)</SelectItem>
                <SelectItem value="description">Sort: Description (A-Z)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showChangedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowChangedOnly((v) => !v)}
              disabled={highlightedTransactionIds.length === 0}
              title="Show only recently changed rows (e.g. after Force All)"
            >
              Only Changed
            </Button>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="Save current filters as..."
              className="w-[220px] h-8"
            />
            <Button size="sm" variant="outline" onClick={saveCurrentView} disabled={!newViewName.trim()}>
              Save View
            </Button>
            {savedViews.map((view) => (
              <div key={view.id} className="inline-flex items-center gap-1 rounded border px-2 py-1">
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => applySavedView(view)}>
                  {view.name}
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => deleteSavedView(view.id)}>
                  x
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {filteredTransactions.length} of {transactions.length} transactions
            {searchTerm !== deferredSearch ? (
              <span className="ml-2 text-amber-700 dark:text-amber-300">Updating search…</span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleRemoveDuplicateTransactions}>
              Remove duplicates (full ledger)
            </Button>
            <span className="text-xs text-muted-foreground">
              {allDuplicateGroups.length > 0
                ? `${allDuplicateGroups.length} duplicate set(s) detected`
                : "No duplicate sets detected"}
            </span>
          </div>

          {/* Bulk Actions */}
          {selectedTransactions.size > 0 && (
            <div className="flex flex-wrap items-center gap-4 p-3 bg-accent rounded-lg border">
              <span className="text-sm font-medium">{selectedTransactions.size} selected</span>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1 min-w-0 flex-1 max-w-xl">
                  <span className="text-xs text-muted-foreground">Category</span>
                  <Select value={bulkCategory} onValueChange={setBulkCategory}>
                    <SelectTrigger className="min-h-10 h-auto text-xs text-left [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:break-words">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={() => handleBulkCategoryUpdate(bulkCategory)}>
                  Apply to Selected
                </Button>
                <Button size="sm" onClick={selectAllVisible}>
                  Select All Visible
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection}>
                  Clear Selection
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkEditMode(!bulkEditMode)}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  More actions
                </Button>
                {businessAccounts.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 border-l pl-3 ml-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Business account</span>
                      <Select value={businessTargetAccount} onValueChange={persistBusinessTargetAccount}>
                        <SelectTrigger className="h-8 w-[min(220px,70vw)] text-xs">
                          <SelectValue placeholder="Pick account" />
                        </SelectTrigger>
                        <SelectContent>
                          {businessAccounts.map((a) => (
                            <SelectItem key={a} value={a}>
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="secondary" onClick={handleMoveSelectedToBusinessBooks}>
                        Book on business
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bulk Edit Panel */}
          {bulkEditMode && selectedTransactions.size > 0 && (
            <div className="p-4 bg-muted rounded-lg border space-y-4">
              <div className="border-t pt-3">
                <h4 className="font-medium mb-3">Bulk move account</h4>
                <div className="flex flex-col gap-1 min-w-0 flex-1 max-w-xl">
                  <span className="text-xs text-muted-foreground">Account</span>
                  <Select value={bulkAccount} onValueChange={setBulkAccount}>
                    <SelectTrigger className="min-h-10 h-auto text-xs text-left [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:break-words">
                      <SelectValue placeholder="Pick account" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {accounts.map((account) => (
                        <SelectItem key={account} value={account}>
                          {account}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => handleBulkAccountUpdate(bulkAccount)}>
                  Move {selectedTransactions.size} selected to account
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Transactions Table — resizable columns + virtualized rows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
            <div className="flex items-center gap-3">
              <span className={filteredNetSum >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                Sum All (net): ${filteredNetSum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span>
                Viewing rows {visibleStart}-{visibleEnd} of {filteredTransactions.length}
              </span>
            </div>
            <span>{scrollProgressPct}% from top</span>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-muted/30">
            <div
              className="min-w-full"
              style={{
                minWidth: colWidths.checkbox + colWidths.date + colWidths.description + colWidths.amount + colWidths.category + colWidths.account + 48,
              }}
            >
              <div
                className="grid gap-2 p-3 bg-muted rounded-t-lg font-medium text-xs items-center"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div className="relative flex items-center justify-center pr-1 min-h-8">
                  <Checkbox
                    checked={selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) selectAllVisible()
                      else clearSelection()
                    }}
                  />
                  <ColumnResizeHandle onDragStart={startResize("checkbox")} />
                </div>
                <div className="relative flex items-center pl-1 pr-2 text-muted-foreground">
                  Date
                  <ColumnResizeHandle onDragStart={startResize("date")} />
                </div>
                <div className="relative flex items-center pl-1 pr-2">
                  Description
                  <ColumnResizeHandle onDragStart={startResize("description")} />
                </div>
                <div className="relative flex items-center justify-end pl-1 pr-2">
                  Amount
                  <ColumnResizeHandle onDragStart={startResize("amount")} />
                </div>
                <div className="relative flex items-center pl-1 pr-2 min-w-0">
                  <span className="truncate">Category</span>
                  <ColumnResizeHandle onDragStart={startResize("category")} />
                </div>
                <div className="relative flex items-center pl-1 pr-2 min-w-0">
                  Account
                  <ColumnResizeHandle onDragStart={startResize("account")} />
                </div>
              </div>

              <div
                ref={scrollParentRef}
                className="max-h-[min(70vh,560px)] overflow-auto rounded-b-lg border-t bg-background"
              >
                {filteredTransactions.length === 0 ? null : (
                  <div
                    className="relative w-full"
                    style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                  >
                    {virtualItems.map((virtualRow) => {
                      const transaction = filteredTransactions[virtualRow.index]
                      return (
                        <div
                          key={transaction.id}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          className="absolute left-0 top-0 w-full box-border px-0 py-1"
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                            minHeight: Math.max(virtualRow.size, 1),
                          }}
                        >
                          <TransactionTableRow
                            transaction={transaction}
                            gridTemplate={gridTemplate}
                            isHighlighted={highlightedSet.has(transaction.id)}
                            isSelected={selectedTransactions.has(transaction.id)}
                            onToggleSelect={() => toggleTransactionSelection(transaction.id)}
                            onUpdate={handleTransactionUpdate}
                            onReceiptAttachmentChange={handleReceiptAttachmentChange}
                            accounts={accounts}
                            onDelete={
                              transaction.manual_entry ||
                              transaction.source === "manual_adjustment" ||
                              transaction.id.startsWith("manual-")
                                ? () => void onRemoveTransactions([transaction.id])
                                : undefined
                            }
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No transactions found matching your criteria.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
