"use client";

import { formatCurrency } from "@/lib/utils";
import { FileText, Download, Calculator, Scale, BookOpen, TrendingUp } from "lucide-react";
import Link from "next/link";

const REPORTS = [
  { title: "Income Statement (P&L)", description: "Revenue, expenses, and net profit for selected period", icon: TrendingUp, href: "/reports/income-statement", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { title: "Balance Sheet", description: "Assets, liabilities, and equity snapshot", icon: Scale, href: "/reports/balance-sheet", color: "text-blue-400", bg: "bg-blue-400/10" },
  { title: "Tax Summary (Schedule C)", description: "Deductions mapped to Schedule C lines for tax filing", icon: Calculator, href: "/reports/tax", color: "text-amber-400", bg: "bg-amber-400/10" },
  { title: "General Ledger", description: "Complete chronological record of all transactions", icon: BookOpen, href: "/reports/general-ledger", color: "text-purple-400", bg: "bg-purple-400/10" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Financial statements and tax reports for 2025</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <Link key={report.title} href={report.href} className="group p-6 rounded-xl border border-border bg-card/50 hover:bg-card/80 hover:border-primary/30 transition-all">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${report.bg}`}>
                <report.icon className={`w-5 h-5 ${report.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm group-hover:text-primary transition-colors">{report.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
