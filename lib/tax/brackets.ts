export type TaxYear = 2024 | 2025

/** Federal income tax filing status for standard deduction and bracket tables. */
export type FilingStatus = "single" | "married_joint"

const FEDERAL_BRACKETS_SINGLE_2024 = [
  { limit: 11600, rate: 0.10 },
  { limit: 47150, rate: 0.12 },
  { limit: 100525, rate: 0.22 },
  { limit: 191950, rate: 0.24 },
  { limit: 243725, rate: 0.32 },
  { limit: 609350, rate: 0.35 },
  { limit: Infinity, rate: 0.37 },
] as const

const FEDERAL_BRACKETS_SINGLE_2025 = [
  { limit: 11925, rate: 0.10 },
  { limit: 48475, rate: 0.12 },
  { limit: 103350, rate: 0.22 },
  { limit: 197300, rate: 0.24 },
  { limit: 250525, rate: 0.32 },
  { limit: 626350, rate: 0.35 },
  { limit: Infinity, rate: 0.37 },
] as const

/** 2025 ordinary income — married filing jointly (IRS). */
const FEDERAL_BRACKETS_MFJ_2025 = [
  { limit: 23850, rate: 0.10 },
  { limit: 96950, rate: 0.12 },
  { limit: 206700, rate: 0.22 },
  { limit: 394600, rate: 0.24 },
  { limit: 501050, rate: 0.32 },
  { limit: 751600, rate: 0.35 },
  { limit: Infinity, rate: 0.37 },
] as const

/** 2024 MFJ (approx. from IRS Rev. Proc.). */
const FEDERAL_BRACKETS_MFJ_2024 = [
  { limit: 23200, rate: 0.10 },
  { limit: 94300, rate: 0.12 },
  { limit: 201050, rate: 0.22 },
  { limit: 383900, rate: 0.24 },
  { limit: 487450, rate: 0.32 },
  { limit: 731200, rate: 0.35 },
  { limit: Infinity, rate: 0.37 },
] as const

const CA_BRACKETS_SINGLE_2024 = [
  { limit: 10412, rate: 0.01 },
  { limit: 24684, rate: 0.02 },
  { limit: 38959, rate: 0.04 },
  { limit: 54081, rate: 0.06 },
  { limit: 68350, rate: 0.08 },
  { limit: 349137, rate: 0.093 },
  { limit: 418961, rate: 0.103 },
  { limit: 698271, rate: 0.113 },
  { limit: 1000000, rate: 0.123 },
  { limit: Infinity, rate: 0.133 },
] as const

const CA_BRACKETS_SINGLE_2025 = [
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
] as const

/** Federal standard deduction — single. */
export const STANDARD_DEDUCTION_SINGLE: Record<TaxYear, number> = {
  2024: 14600,
  2025: 14600,
}

/** Federal standard deduction — married filing jointly. */
export const STANDARD_DEDUCTION_MFJ: Record<TaxYear, number> = {
  2024: 29200,
  2025: 29200,
}

/** @deprecated Use standardDeductionFederal(year, status) */
export const STANDARD_DEDUCTION: Record<TaxYear, number> = STANDARD_DEDUCTION_SINGLE

export function standardDeductionFederal(year: TaxYear, status: FilingStatus): number {
  return status === "married_joint" ? STANDARD_DEDUCTION_MFJ[year] : STANDARD_DEDUCTION_SINGLE[year]
}

// Simplified model: CA uses the same “standard deduction” subtraction constant in your current app-page logic.
export const CA_STANDARD_DEDUCTION: Record<TaxYear, number> = {
  2024: 5540,
  2025: 5540,
}

export const SS_WAGE_BASE: Record<TaxYear, number> = {
  2024: 168600,
  2025: 176100,
}

function progressiveTaxSingle(taxableIncome: number, brackets: ReadonlyArray<{ limit: number; rate: number }>): number {
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

export function calculateFederalTaxSingle(taxYear: TaxYear, taxableIncome: number): number {
  const brackets = taxYear === 2024 ? FEDERAL_BRACKETS_SINGLE_2024 : FEDERAL_BRACKETS_SINGLE_2025
  return progressiveTaxSingle(taxableIncome, brackets)
}

export function calculateFederalTaxMFJ(taxYear: TaxYear, taxableIncome: number): number {
  const brackets = taxYear === 2024 ? FEDERAL_BRACKETS_MFJ_2024 : FEDERAL_BRACKETS_MFJ_2025
  return progressiveTaxSingle(taxableIncome, brackets)
}

export function calculateFederalTaxByFilingStatus(
  taxYear: TaxYear,
  taxableIncome: number,
  status: FilingStatus,
): number {
  return status === "married_joint"
    ? calculateFederalTaxMFJ(taxYear, taxableIncome)
    : calculateFederalTaxSingle(taxYear, taxableIncome)
}

export function calculateCaliforniaTaxSingle(taxYear: TaxYear, taxableIncome: number): number {
  const brackets = taxYear === 2024 ? CA_BRACKETS_SINGLE_2024 : CA_BRACKETS_SINGLE_2025
  return progressiveTaxSingle(taxableIncome, brackets)
}

