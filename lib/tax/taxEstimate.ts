import type { UiTransactionLike } from "@/lib/tax/treatment"
import { computeUiExpenseTotals } from "@/lib/tax/treatment"
import {
  calculateCaliforniaTaxSingle,
  calculateFederalTaxByFilingStatus,
  CA_STANDARD_DEDUCTION,
  SS_WAGE_BASE,
  standardDeductionFederal,
  type FilingStatus,
  type TaxYear,
} from "@/lib/tax/brackets"

/** SEP elective deferral cap (2025); planning display. */
export const SEP_IRA_CAP_DISPLAY_2025 = 70_000

export type LedgerTaxEstimate = {
  grossRevenue: number
  scheduleCTotalDeductions: number
  netProfitScheduleC: number
  selfEmploymentTax: number
  /** Simplified check: netProfit × 0.9235 × 0.153 */
  selfEmploymentTaxSimplified: number
  halfSETaxDeduction: number
  healthInsuranceDeduction: number
  sepIraContributed: number
  qbiDeduction: number
  adjustedGrossIncome: number
  federalStandardDeduction: number
  taxableIncomeFederal: number
  federalIncomeTax: number
  californiaIncomeTax: number
  totalEstimatedTaxOwed: number
  sepIraMaxDeferral: number
  /** Rough federal income tax avoided if max SEP contributed (marginal blend). */
  estimatedFederalTaxSavedIfMaxSep: number
  filingStatus: FilingStatus
}

function revenueTx(t: UiTransactionLike): boolean {
  if (!t.isIncome || t.exclude === true) return false
  if (t.is_transfer === true || t.is_personal === true) return false
  const cl = (t.category || "").toLowerCase()
  if (["personal", "crypto", "atm withdrawal", "cash withdrawal"].some((k) => cl.includes(k))) return false
  return true
}

/**
 * Full dashboard / export tax snapshot from the transaction ledger.
 * SE tax uses SS wage base split (not a single 15.3% on all net profit).
 */
export function computeLedgerTaxEstimate(
  transactions: UiTransactionLike[],
  opts: {
    taxYear: TaxYear
    filingStatus: FilingStatus
    /** When set (positive), overrides default federal standard deduction */
    federalStandardDeductionOverride?: number | null
  },
): LedgerTaxEstimate {
  const { taxYear, filingStatus } = opts
  const grossRevenue = transactions.filter(revenueTx).reduce((s, t) => s + t.amount, 0)
  const { schedCDeductions, healthInsuranceTotal, sepIraTotal } = computeUiExpenseTotals(transactions)
  const netProfitScheduleC = Math.max(0, grossRevenue - schedCDeductions)

  const ssWageBase = SS_WAGE_BASE[taxYear]
  const seTaxableIncome = Math.min(netProfitScheduleC * 0.9235, ssWageBase)
  const ssTax = Math.min(seTaxableIncome, ssWageBase) * 0.124
  const medicareTax = netProfitScheduleC * 0.9235 * 0.029
  const selfEmploymentTax = ssTax + medicareTax
  const selfEmploymentTaxSimplified = netProfitScheduleC * 0.9235 * 0.153
  const halfSETaxDeduction = selfEmploymentTax * 0.5

  const qbiDeduction = netProfitScheduleC * 0.2
  const adjustedGrossIncome = Math.max(
    0,
    netProfitScheduleC - halfSETaxDeduction - healthInsuranceTotal - sepIraTotal,
  )

  const federalStandardDeduction =
    opts.federalStandardDeductionOverride != null && opts.federalStandardDeductionOverride > 0
      ? opts.federalStandardDeductionOverride
      : standardDeductionFederal(taxYear, filingStatus)

  const taxableIncomeFederal = Math.max(0, adjustedGrossIncome - federalStandardDeduction - qbiDeduction)
  const federalIncomeTax = calculateFederalTaxByFilingStatus(taxYear, taxableIncomeFederal, filingStatus)

  const caTaxable = Math.max(0, adjustedGrossIncome - CA_STANDARD_DEDUCTION[taxYear])
  const californiaIncomeTax = calculateCaliforniaTaxSingle(taxYear, caTaxable)

  const totalEstimatedTaxOwed = Math.max(0, federalIncomeTax + selfEmploymentTax + californiaIncomeTax)

  const sepIraMaxDeferral = Math.min(SEP_IRA_CAP_DISPLAY_2025, netProfitScheduleC * 0.25)

  const marginalApprox =
    taxableIncomeFederal < 50_000 ? 0.12 : taxableIncomeFederal < 120_000 ? 0.22 : 0.24
  const estimatedFederalTaxSavedIfMaxSep = Math.round(sepIraMaxDeferral * marginalApprox * 100) / 100

  return {
    grossRevenue,
    scheduleCTotalDeductions: schedCDeductions,
    netProfitScheduleC,
    selfEmploymentTax,
    selfEmploymentTaxSimplified,
    halfSETaxDeduction,
    healthInsuranceDeduction: healthInsuranceTotal,
    sepIraContributed: sepIraTotal,
    qbiDeduction,
    adjustedGrossIncome,
    federalStandardDeduction,
    taxableIncomeFederal,
    federalIncomeTax,
    californiaIncomeTax,
    totalEstimatedTaxOwed,
    sepIraMaxDeferral,
    estimatedFederalTaxSavedIfMaxSep,
    filingStatus,
  }
}
