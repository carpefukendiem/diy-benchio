import type { UiTransactionLike } from "@/lib/tax/treatment"
import { computeUiExpenseTotals } from "@/lib/tax/treatment"
import {
  calculateFederalTaxSingle,
  calculateCaliforniaTaxSingle,
  CA_STANDARD_DEDUCTION,
  SS_WAGE_BASE,
  STANDARD_DEDUCTION_SINGLE,
  type TaxYear,
} from "@/lib/tax/brackets"

/** SEP-IRA ceiling (2025) — actual limit depends on net earnings from self-employment; show as planning hint only. */
export const SEP_IRA_HINT_MAX_2025 = 69_000

export type TaxOptimizationSnapshot = {
  grossRevenue: number
  scheduleCTotalDeductions: number
  netProfitScheduleC: number
  estimatedSETax: number
  estimatedIncomeTaxFederal: number
  estimatedIncomeTaxCA: number
  totalEstimatedTaxOwed: number
  healthInsuranceAboveLine: number
  sepIraAboveLine: number
  federalStandardDeduction: number
  /** Simplified: extra federal tax avoided per $1 contributed (marginal approximation 22%). */
  sepIraMarginalSavingsPerDollar: number
}

function revenueTx(t: UiTransactionLike): boolean {
  if (!t.isIncome || t.exclude === true) return false
  if (t.is_transfer === true || t.is_personal === true) return false
  const cl = (t.category || "").toLowerCase()
  if (["personal", "crypto", "atm withdrawal", "cash withdrawal"].some((k) => cl.includes(k))) return false
  return true
}

/**
 * Aligns with dashboard `stats` (Schedule C net, SE tax split, AGI, federal + CA income tax).
 * Recalculates whenever `transactions` changes.
 */
export function computeTaxOptimizationSnapshot(
  transactions: UiTransactionLike[],
  taxYear: TaxYear = 2025,
): TaxOptimizationSnapshot {
  const grossRevenue = transactions.filter(revenueTx).reduce((s, t) => s + t.amount, 0)
  const { schedCDeductions, healthInsuranceTotal, sepIraTotal } = computeUiExpenseTotals(transactions)
  const netProfitScheduleC = Math.max(0, grossRevenue - schedCDeductions)

  const ssWageBase = SS_WAGE_BASE[taxYear]
  const seTaxableIncome = Math.min(netProfitScheduleC * 0.9235, ssWageBase)
  const ssTax = Math.min(seTaxableIncome, ssWageBase) * 0.124
  const medicareTax = netProfitScheduleC * 0.9235 * 0.029
  const estimatedSETax = ssTax + medicareTax
  const seTaxDeduction = estimatedSETax * 0.5

  const qbiDeduction = netProfitScheduleC * 0.2
  const agi = Math.max(0, netProfitScheduleC - seTaxDeduction - healthInsuranceTotal - sepIraTotal)
  const federalStandard = STANDARD_DEDUCTION_SINGLE[taxYear]
  const federalTaxable = Math.max(0, agi - federalStandard - qbiDeduction)
  const estimatedIncomeTaxFederal = calculateFederalTaxSingle(taxYear, federalTaxable)

  const caTaxable = Math.max(0, agi - CA_STANDARD_DEDUCTION[taxYear])
  const estimatedIncomeTaxCA = calculateCaliforniaTaxSingle(taxYear, caTaxable)

  const totalEstimatedTaxOwed = Math.max(0, estimatedIncomeTaxFederal + estimatedSETax + estimatedIncomeTaxCA)

  return {
    grossRevenue,
    scheduleCTotalDeductions: schedCDeductions,
    netProfitScheduleC,
    estimatedSETax,
    estimatedIncomeTaxFederal,
    estimatedIncomeTaxCA,
    totalEstimatedTaxOwed,
    healthInsuranceAboveLine: healthInsuranceTotal,
    sepIraAboveLine: sepIraTotal,
    federalStandardDeduction: federalStandard,
    sepIraMarginalSavingsPerDollar: 0.22,
  }
}
