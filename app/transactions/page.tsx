"use client";

import { useState } from "react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  Search,
  Filter,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  Tag,
  Eye,
} from "lucide-react";

// Demo transaction data — will be replaced with Supabase queries
const DEMO_TRANSACTIONS = [
  { id: "1", date: "2025-03-31", description: "Stripe Transfer St-C8U0J4N8K6U9 Ruben Ruiz", amount: 145.05, type: "credit", category: "Sales Revenue", schedule_c: "Line 1", is_personal: false, is_transfer: false, confidence: 0.95, categorized_by: "rule" },
  { id: "2", date: "2025-03-31", description: "Monthly Service Fee", amount: 10.00, type: "debit", category: "Interest & Bank Fees", schedule_c: "Line 16b", is_personal: false, is_transfer: false, confidence: 0.95, categorized_by: "rule" },
  { id: "3", date: "2025-03-31", description: "Recurring Payment - Highlevel Inc. Gohighlevel", amount: 25.00, type: "debit", category: "Software & Subscriptions", schedule_c: "Line 27a", is_personal: false, is_transfer: false, confidence: 0.95, categorized_by: "rule" },
  { id: "4", date: "2025-03-28", description: "Screaming Frog Ltd", amount: 259.00, type: "debit", category: "Software & Subscriptions", schedule_c: "Line 27a", is_personal: false, is_transfer: false, confidence: 0.95, categorized_by: "rule" },
  { id: "5", date: "2025-03-28", description: "Prime Video Channel", amount: 4.99, type: "debit", category: "Personal - Entertainment", schedule_c: null, is_personal: true, is_transfer: false, confidence: 0.85, categorized_by: "rule" },
  { id: "6", date: "2025-03-25", description: "Upwork Escrow IN EDI Pymnts Ruben Ruiz", amount: 225.00, type: "credit", category: "Freelance Income", schedule_c: "Line 1", is_personal: false, is_transfer: false, confidence: 0.95, categorized_by: "rule" },
  { id: "7", date: "2025-03-25", description: "Zelle to Ruiz Janice - Health Insurance", amount: 750.00, type: "debit", category: "Zelle / Venmo Transfer", schedule_c: null, is_personal: false, is_transfer: true, confidence: 0.80, categorized_by: "rule" },
  { id: "8", date: "2025-03-25", description: "United Fin Cas Ins Prem", amount: 88.67, type: "debit", category: "Business Insurance", schedule_c: "Line 15", is_personal: false, is_transfer: false, confidence: 0.90, categorized_by: "rule" },
  { id: "9", date: "2025-03-21", description: "Bench Accounting", amount: 299.00, type: "debit", category: "Professional Services", schedule_c: "Line 17", is_personal: false, is_transfer: false, confidence: 0.95, categorized_by: "rule" },
  { id: "10", date: "2025-03-21", description: "Webflow.Com", amount: 24.00, type: "debit", category: "Social Media & Online Presence", schedule_c: "Line 8", is_personal: false, is_transfer: false, confidence: 0.90, categorized_by: "rule" },
  { id: "11", date: "2025-03-20", description: "Cursor, Ai Powered IDE", amount: 20.00, type: "debit", category: "Software & Subscriptions", schedule_c: "Line 27a", is_personal: false, is_transfer: false, confidence: 0.90, categorized_by: "rule" },
  { id: "12", date: "2025-03-19", description: "Talevi's Wines and Spirit Santa Barbara", amount: 5.05, type: "debit", category: null, schedule_c: null, is_personal: false, is_transfer: false, confidence: 0, categorized_by: null },
  { id: "13", date: "2025-03-14", description: "Codecademy", amount: 149.99, type: "debit", category: "Education & Training", schedule_c: "Line 27a", is_personal: false, is_transfer: false, confidence: 0.90, categorized_by: "rule" },
  { id: "14", date: "2025-03-11", description: "Stripe Transfer St-T0Y0C5Z1Z4D2 Ruben Ruiz", amount: 1202.23, type: "credit", category: "Sales Revenue", schedule_c: "Line 1", is_personal: false, is_transfer: false, confidence: 0.95, categorized_by: "rule" },
  { id: "15", date: "2025-03-10", description: "Highlevel Agency Subscription Gohighlevel", amount: 497.00, type: "debit", category: "Software & Subscriptions", schedule_c: "Line 27a", is_personal: false, is_transfer: false, confidence: 0.95, categorized_by: "rule" },
];

const CATEGORY_OPTIONS = [
  { label: "Sales Revenue", id: "income" },
  { label: "Software & Subscriptions", id: "software" },
  { label: "Business Meals (50%)", id: "meals" },
  { label: "Advertising", id: "advertising" },
  { label: "Phone & Internet", id: "phone" },
  { label: "Gas & Auto", id: "auto" },
  { label: "Professional Services", id: "professional" },
  { label: "Business Insurance", id: "insurance" },
  { label: "Education & Training", id: "education" },
  { label: "Interest & Bank Fees", id: "fees" },
  { label: "Personal Expense", id: "personal" },
  { label: "Owner Draw / Transfer", id: "transfer" },
];

type FilterType = "all" | "uncategorized" | "business" | "personal" | "transfer";

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedTx, setSelectedTx] = useState<string | null>(null);

  const filtered = DEMO_TRANSACTIONS.filter((tx) => {
    if (search) {
      const q = search.toLowerCase();
      if (!tx.description.toLowerCase().includes(q) && !tx.category?.toLowerCase().includes(q)) {
        return false;
      }
    }
    switch (filter) {
      case "uncategorized":
        return !tx.category;
      case "business":
        return !tx.is_personal && !tx.is_transfer && tx.category;
      case "personal":
        return tx.is_personal;
      case "transfer":
        return tx.is_transfer;
      default:
        return true;
    }
  });

  const filterCounts = {
    all: DEMO_TRANSACTIONS.length,
    uncategorized: DEMO_TRANSACTIONS.filter((t) => !t.category).length,
    business: DEMO_TRANSACTIONS.filter((t) => !t.is_personal && !t.is_transfer && t.category).length,
    personal: DEMO_TRANSACTIONS.filter((t) => t.is_personal).length,
    transfer: DEMO_TRANSACTIONS.filter((t) => t.is_transfer).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review, categorize, and manage all imported transactions
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {(["all", "uncategorized", "business", "personal", "transfer"] as FilterType[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                filter === f
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {f}
              <span className="ml-1.5 text-[10px] opacity-60">
                {filterCounts[f]}
              </span>
            </button>
          )
        )}

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-card/80">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Description
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">
                Amount
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Category
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Schedule C
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr
                key={tx.id}
                className="border-t border-border transaction-row cursor-pointer"
                onClick={() =>
                  setSelectedTx(selectedTx === tx.id ? null : tx.id)
                }
              >
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(tx.date)}
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs font-medium truncate max-w-xs">
                    {tx.description}
                  </p>
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-xs font-mono font-medium text-right whitespace-nowrap",
                    tx.type === "credit"
                      ? "amount-positive"
                      : "amount-negative"
                  )}
                >
                  {tx.type === "credit" ? "+" : "-"}
                  {formatCurrency(tx.amount)}
                </td>
                <td className="px-4 py-3">
                  {tx.category ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium",
                        tx.is_personal
                          ? "bg-rose-500/10 text-rose-400"
                          : tx.is_transfer
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      )}
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tx.category}
                    </span>
                  ) : (
                    <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors">
                      <AlertCircle className="w-2.5 h-2.5" />
                      Categorize
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {tx.schedule_c || "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {tx.categorized_by === "rule" && (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Auto
                    </span>
                  )}
                  {tx.categorized_by === "ai" && (
                    <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      AI
                    </span>
                  )}
                  {tx.categorized_by === "user" && (
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      Manual
                    </span>
                  )}
                  {!tx.categorized_by && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">
            No transactions match your filters
          </p>
        </div>
      )}
    </div>
  );
}
