"use client";

import { formatCurrency } from "@/lib/utils";
import {
  Calculator,
  Download,
  AlertTriangle,
  Star,
  ChevronRight,
  PiggyBank,
} from "lucide-react";

// Demo data based on your 2024 actuals — will be replaced with live calculation
const TAX_SUMMARY = {
  business_name: "Ranking SB (CARPEFUKENDIEM, LLC)",
  tax_year: 2025,
  gross_income: 74444.84,
  total_deductions: 53277.07,
  net_profit: 21167.77,
  self_employment_tax: 2991.58,
  se_tax_deduction: 1495.79,
  estimated_quarterly: 2042.0,
  schedule_c: [
    { line: "Line 1", label: "Gross receipts or sales", amount: 75271.81 },
    { line: "Line 2", label: "Returns and allowances", amount: 827.0 },
    { line: "Line 6", label: "Other income (interest)", amount: 0.03 },
    { line: "Line 8", label: "Advertising", amount: 1200.0 },
    { line: "Line 9", label: "Car and truck expenses", amount: 2845.34 },
    { line: "Line 10", label: "Commissions and fees", amount: 1865.42 },
    { line: "Line 13", label: "Depreciation & Section 179", amount: 3200.0 },
    { line: "Line 15", label: "Insurance (other than health)", amount: 1589.04 },
    { line: "Line 16b", label: "Interest (other)", amount: 5180.23 },
    { line: "Line 17", label: "Legal and professional services", amount: 4458.0 },
    { line: "Line 18", label: "Office expense", amount: 856.0 },
    { line: "Line 23", label: "Taxes and licenses", amount: 380.0 },
    { line: "Line 24b", label: "Meals (50% deductible)", amount: 2460.0 },
    { line: "Line 25", label: "Utilities (phone/internet)", amount: 4820.0 },
    { line: "Line 27a", label: "Other expenses", amount: 24423.04 },
  ],
  opportunities: [
    {
      title: "Home Office Deduction",
      description:
        "Simplified method: $5/sq ft up to 300 sq ft = $1,500/year if you use a dedicated space.",
      savings: 450,
      action: "Measure your home office and calculate business-use percentage.",
    },
    {
      title: "SEP-IRA Retirement Contribution",
      description:
        "Contribute up to 25% of net SE income ($5,292) to reduce taxable income. Deadline extends to filing date.",
      savings: 1588,
      action: "Open a SEP-IRA at Vanguard/Fidelity before filing deadline.",
    },
    {
      title: "Vehicle Mileage Tracking",
      description:
        "2025 rate is $0.70/mile. Even 3,000 business miles = $2,100 deduction.",
      savings: 630,
      action: "Start using MileIQ or Everlance to track business miles.",
    },
    {
      title: "Self-Employed Health Insurance",
      description:
        "Deduct 100% of health/dental/vision premiums on Schedule 1. We see Zelle payments marked 'Health Insurance' — gather all premium receipts.",
      savings: 2500,
      action: "Compile all health insurance premium payments for the year.",
    },
  ],
};

export default function TaxSummaryPage() {
  const totalOpportunitySavings = TAX_SUMMARY.opportunities.reduce(
    (sum, o) => sum + o.savings,
    0
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tax Summary
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {TAX_SUMMARY.business_name} — {TAX_SUMMARY.tax_year} Tax Year
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-xs font-medium transition-colors">
          <Download className="w-3.5 h-3.5" />
          Export PDF
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Gross Income",
            value: TAX_SUMMARY.gross_income,
            color: "text-emerald-400",
          },
          {
            label: "Total Deductions",
            value: TAX_SUMMARY.total_deductions,
            color: "text-blue-400",
          },
          {
            label: "Net Profit",
            value: TAX_SUMMARY.net_profit,
            color: "text-primary",
          },
          {
            label: "SE Tax (15.3%)",
            value: TAX_SUMMARY.self_employment_tax,
            color: "text-rose-400",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="p-4 rounded-xl border border-border bg-card/80"
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`text-lg font-semibold mt-1 ${card.color}`}>
              {formatCurrency(card.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Schedule C Breakdown */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 bg-card/80 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Schedule C Line Items
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-card/50">
              <th className="text-left px-6 py-2.5 text-xs font-medium text-muted-foreground">
                Line
              </th>
              <th className="text-left px-6 py-2.5 text-xs font-medium text-muted-foreground">
                Description
              </th>
              <th className="text-right px-6 py-2.5 text-xs font-medium text-muted-foreground">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Income Section */}
            <tr className="bg-emerald-500/5">
              <td
                colSpan={3}
                className="px-6 py-2 text-xs font-semibold text-emerald-400"
              >
                INCOME
              </td>
            </tr>
            {TAX_SUMMARY.schedule_c
              .filter((l) =>
                ["Line 1", "Line 2", "Line 6"].includes(l.line)
              )
              .map((line) => (
                <tr
                  key={line.line}
                  className="border-t border-border/50 transaction-row"
                >
                  <td className="px-6 py-3 text-xs font-mono text-muted-foreground">
                    {line.line}
                  </td>
                  <td className="px-6 py-3 text-xs">{line.label}</td>
                  <td className="px-6 py-3 text-xs font-mono text-right amount-positive">
                    {formatCurrency(line.amount)}
                  </td>
                </tr>
              ))}

            {/* Expenses Section */}
            <tr className="bg-rose-500/5">
              <td
                colSpan={3}
                className="px-6 py-2 text-xs font-semibold text-rose-400"
              >
                EXPENSES
              </td>
            </tr>
            {TAX_SUMMARY.schedule_c
              .filter(
                (l) =>
                  !["Line 1", "Line 2", "Line 6"].includes(l.line)
              )
              .map((line) => (
                <tr
                  key={line.line}
                  className="border-t border-border/50 transaction-row"
                >
                  <td className="px-6 py-3 text-xs font-mono text-muted-foreground">
                    {line.line}
                  </td>
                  <td className="px-6 py-3 text-xs">{line.label}</td>
                  <td className="px-6 py-3 text-xs font-mono text-right amount-negative">
                    {formatCurrency(line.amount)}
                  </td>
                </tr>
              ))}

            {/* Totals */}
            <tr className="border-t-2 border-primary/30 bg-primary/5">
              <td colSpan={2} className="px-6 py-3 text-xs font-semibold">
                Net Profit (Line 31)
              </td>
              <td className="px-6 py-3 text-sm font-mono font-bold text-right text-primary">
                {formatCurrency(TAX_SUMMARY.net_profit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SE Tax Breakdown */}
      <div className="p-6 rounded-xl border border-border bg-card/80">
        <h2 className="text-sm font-semibold mb-4">Self-Employment Tax</h2>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Net profit × 92.35%</span>
            <span className="font-mono">
              {formatCurrency(TAX_SUMMARY.net_profit * 0.9235)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              SE Tax (12.4% SS + 2.9% Medicare)
            </span>
            <span className="font-mono text-rose-400">
              {formatCurrency(TAX_SUMMARY.self_employment_tax)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              50% SE Tax Deduction (Schedule 1)
            </span>
            <span className="font-mono text-emerald-400">
              -{formatCurrency(TAX_SUMMARY.se_tax_deduction)}
            </span>
          </div>
          <div className="border-t border-border pt-3 flex justify-between font-medium">
            <span>Estimated Quarterly Payment</span>
            <span className="font-mono">
              {formatCurrency(TAX_SUMMARY.estimated_quarterly)}
            </span>
          </div>
        </div>
      </div>

      {/* Deduction Opportunities */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-amber-500/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-amber-400" />
            Deduction Opportunities
          </h2>
          <span className="text-xs font-medium text-amber-400">
            Est. {formatCurrency(totalOpportunitySavings)} in additional savings
          </span>
        </div>
        <div className="divide-y divide-amber-500/10">
          {TAX_SUMMARY.opportunities.map((opp) => (
            <div key={opp.title} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <h3 className="text-sm font-medium">{opp.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {opp.description}
                  </p>
                  <p className="text-xs text-amber-400/80 mt-2 flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    {opp.action}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-amber-400">
                    ~{formatCurrency(opp.savings)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    est. tax savings
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card/30">
        <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          This tax summary is for informational purposes only and does not
          constitute tax advice. Consult a licensed CPA or tax professional
          before filing. Self-employment tax calculations are estimates based on
          current year data and may not account for all deductions, credits, or
          state-specific rules.
        </p>
      </div>
    </div>
  );
}
