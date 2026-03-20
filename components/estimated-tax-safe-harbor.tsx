"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { computeUiExpenseTotals } from "@/lib/tax/treatment"
import { calculateCaliforniaTaxSingle, calculateFederalTaxSingle, CA_STANDARD_DEDUCTION, SS_WAGE_BASE, STANDARD_DEDUCTION, type TaxYear } from "@/lib/tax/brackets"

type Tx = {
  date: string
  category: string
  amount: number
  isIncome: boolean
  description?: string
}

const PRIOR_YEAR = 2024
const CURRENT_YEAR = 2025

// 2025 CA LLC fee logic (same waiver years as current app), but safe-harbor base uses the prior-year transactions’ revenue.
const CA_LLC_FEE_THRESHOLD = 250000
const CA_LLC_FEE_AMOUNT = 800

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function computeYearTax(transactions: Tx[], year: TaxYear) {
  const yearTx = transactions.filter((t) => (t.date ?? "").startsWith(String(year)))
  const totalRevenue = yearTx.filter((t) => t.isIncome).reduce((sum, t) => sum + t.amount, 0)

  const { schedCDeductions, healthInsuranceTotal, sepIraTotal } = computeUiExpenseTotals(yearTx as any)
  const netProfit = Math.max(0, totalRevenue - schedCDeductions)

  const qbiDeduction = netProfit * 0.2

  // Self-employment tax (matches the dashboard’s simplified model)
  const seTaxableIncome = netProfit * 0.9235
  const ssWageBase = SS_WAGE_BASE[year]
  const ssTax = Math.min(seTaxableIncome, ssWageBase) * 0.124
  const medicareTax = seTaxableIncome * 0.029
  const seTax = ssTax + medicareTax
  const seTaxDeduction = seTax * 0.5

  const agi = Math.max(0, netProfit - seTaxDeduction - healthInsuranceTotal - sepIraTotal)

  const standardDeduction = STANDARD_DEDUCTION[year]
  const federalTaxableIncome = Math.max(0, agi - standardDeduction - qbiDeduction)
  const federalTax = calculateFederalTaxSingle(year, federalTaxableIncome)

  // CA standard deduction is the same for 2024/2025 in this simplified model (still kept as variable).
  const caStandardDeduction = CA_STANDARD_DEDUCTION[year]
  const caTaxableIncome = Math.max(0, agi - caStandardDeduction)
  const caTax = calculateCaliforniaTaxSingle(year, caTaxableIncome)

  const caLLCFee = totalRevenue >= CA_LLC_FEE_THRESHOLD ? CA_LLC_FEE_AMOUNT : 0

  const federalTotal = federalTax + seTax
  const caTotal = caTax + caLLCFee
  const total = federalTotal + caTotal

  return { totalRevenue, schedCDeductions, healthInsuranceTotal, sepIraTotal, netProfit, seTax, seTaxDeduction, qbiDeduction, agi, federalTax, caTax, caLLCFee, federalTotal, caTotal, total }
}

export function EstimatedTaxSafeHarbor({ transactions }: { transactions: Tx[] }) {
  const computed = useMemo(() => {
    const hasPrior = transactions.some((t) => t.date?.startsWith(String(PRIOR_YEAR)))
    const hasCurrent = transactions.some((t) => t.date?.startsWith(String(CURRENT_YEAR)))
    if (!hasPrior) {
      return { hasPrior: false, hasCurrent, prior: null as any, current: null as any, quarters: [] as any[] }
    }
    const prior = computeYearTax(transactions, PRIOR_YEAR)
    const current = hasCurrent ? computeYearTax(transactions, CURRENT_YEAR) : null

    // Safe harbor: pay 100% of prior-year “total tax” using prior-year tax as required annual payment.
    // Federal schedule: 25% each quarter.
    const federalAnnual = prior.federalTotal
    const federalInstallment = federalAnnual / 4

    // California schedule (standard front-loaded for safe harbor): 30% / 40% / 0% / 30%.
    const caAnnual = prior.caTotal
    const caInstallments = [0.3, 0.4, 0.0, 0.3].map((pct) => caAnnual * pct)

    const quarters = [
      { label: "Q1 (Apr 15)", federal: federalInstallment, ca: caInstallments[0] },
      { label: "Q2 (Jun 15)", federal: federalInstallment, ca: caInstallments[1] },
      { label: "Q3 (Sep 15)", federal: federalInstallment, ca: caInstallments[2] },
      { label: "Q4 (Jan 15)", federal: federalInstallment, ca: caInstallments[3] },
    ].map((q) => ({
      ...q,
      total: q.federal + q.ca,
    }))

    return { hasPrior: true, hasCurrent, prior, current, quarters }
  }, [transactions])

  return (
    <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
      <CardHeader>
        <CardTitle>Quarterly Estimated Tax (Safe Harbor)</CardTitle>
        <CardDescription>
          Estimates required payments for the current year using your computed prior-year tax (100% safe harbor).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!computed.hasPrior ? (
          <p className="text-sm text-muted-foreground">
            Add transactions from {PRIOR_YEAR} to compute your safe-harbor base.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Prior-year (federal + SE)</p>
                <p className="text-lg font-semibold">${formatCurrency(computed.prior.federalTotal)}</p>
              </div>
              <div className="rounded-lg border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Prior-year (CA)</p>
                <p className="text-lg font-semibold">${formatCurrency(computed.prior.caTotal)}</p>
              </div>
              <div className="rounded-lg border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Prior-year total tax base</p>
                <p className="text-lg font-semibold">${formatCurrency(computed.prior.total)}</p>
              </div>
            </div>

            <div className="rounded-lg border bg-background/50 p-3 space-y-2">
              <p className="text-sm font-medium">Required safe-harbor payments</p>
              {computed.quarters.map((q: any) => (
                <div key={q.label} className="flex items-center justify-between gap-3 py-2 border-t first:border-t-0">
                  <div className="text-sm">{q.label}</div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      Federal+SE: ${formatCurrency(q.federal)} · CA: ${formatCurrency(q.ca)}
                    </div>
                    <div className="text-sm font-semibold">${formatCurrency(q.total)}</div>
                  </div>
                </div>
              ))}
            </div>

            {computed.current && (
              <div className="rounded-lg border bg-background/50 p-3">
                <p className="text-sm font-medium mb-2">Current-year projection vs safe harbor</p>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Projected total tax ({CURRENT_YEAR})</div>
                  <div className="text-sm font-semibold">${formatCurrency(computed.current.total)}</div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm text-muted-foreground">Safe-harbor base ({PRIOR_YEAR})</div>
                  <div className="text-sm font-semibold">${formatCurrency(computed.prior.total)}</div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

