"use client"

import { useEffect, useMemo, useState } from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateCaliforniaTaxSingle, calculateFederalTaxSingle, CA_STANDARD_DEDUCTION, SS_WAGE_BASE, STANDARD_DEDUCTION } from "@/lib/tax/brackets"

type RetirementStats = {
  netProfit: number
  seTax: number
  seTaxDeduction: number
  healthInsuranceTotal: number
  sepIraTotal: number
  totalRevenue: number
  estimatedTaxLiability: number
}

const SEP_IRA_LIMIT_2025 = 69000
const CA_LLC_FEE_THRESHOLD = 250000
const CA_LLC_FEE_AMOUNT = 800

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function RetirementOptimizer({ stats }: { stats: RetirementStats }) {
  const existingSep = stats.sepIraTotal || 0
  const netProfit = Math.max(0, stats.netProfit || 0)

  const sepMax = useMemo(() => {
    // Self-employed effective SEP rate is ~20% of (net profit - 1/2 SE tax).
    // This avoids a circular worksheet and incorporates SE-tax-driven net earnings for the plan limit.
    const compensationBase = Math.max(0, netProfit - (stats.seTaxDeduction || 0))
    return Math.min(compensationBase * 0.2, SEP_IRA_LIMIT_2025)
  }, [netProfit, stats.seTaxDeduction])

  const maxAdditional = useMemo(() => Math.max(0, sepMax - existingSep), [sepMax, existingSep])

  const [extraContribution, setExtraContribution] = useState(0)

  // Keep slider within bounds when underlying stats change.
  useEffect(() => {
    setExtraContribution((prev) => Math.min(maxAdditional, Math.max(0, prev)))
  }, [maxAdditional])

  const boundedExtraContribution = Math.min(maxAdditional, Math.max(0, extraContribution))

  const projection = useMemo(() => {
    const totalSep = existingSep + boundedExtraContribution

    // Baseline and projection both model how retirement contributions affect SE tax base
    // (so income tax uses a recalculated half-SE-tax deduction via AGI).
    const computeSelfEmployment = (sepAmount: number) => {
      const netForSe = Math.max(0, netProfit - sepAmount)
      const seTaxableIncome = Math.min(netForSe * 0.9235, SS_WAGE_BASE[2025])
      const ssTax = seTaxableIncome * 0.124
      const medicareTax = (netForSe * 0.9235) * 0.029
      const seTax = ssTax + medicareTax
      return { seTax, seTaxDeduction: seTax * 0.5 }
    }

    const qbiDeduction = netProfit * 0.2 // matches existing app assumptions
    const healthInsuranceTotal = stats.healthInsuranceTotal || 0
    const caLLCFee = (stats.totalRevenue || 0) >= CA_LLC_FEE_THRESHOLD ? CA_LLC_FEE_AMOUNT : 0

    const baseline = (() => {
      const { seTax, seTaxDeduction } = computeSelfEmployment(existingSep)
      const agi = Math.max(0, netProfit - seTaxDeduction - healthInsuranceTotal - existingSep)
      const federalTaxableIncome = Math.max(0, agi - STANDARD_DEDUCTION[2025] - qbiDeduction)
      const federalTax = calculateFederalTaxSingle(2025, federalTaxableIncome)
      const caTaxableIncome = Math.max(0, agi - CA_STANDARD_DEDUCTION[2025])
      const caTax = calculateCaliforniaTaxSingle(2025, caTaxableIncome)
      const estimatedTotalTaxLiability = Math.max(0, federalTax + seTax + caTax + caLLCFee)
      return { estimatedTotalTaxLiability }
    })()

    const projected = (() => {
      const { seTax, seTaxDeduction } = computeSelfEmployment(totalSep)
      const agi = Math.max(0, netProfit - seTaxDeduction - healthInsuranceTotal - totalSep)
      const federalTaxableIncome = Math.max(0, agi - STANDARD_DEDUCTION[2025] - qbiDeduction)
      const federalTax = calculateFederalTaxSingle(2025, federalTaxableIncome)
      const caTaxableIncome = Math.max(0, agi - CA_STANDARD_DEDUCTION[2025])
      const caTax = calculateCaliforniaTaxSingle(2025, caTaxableIncome)
      const estimatedTotalTaxLiability = Math.max(0, federalTax + seTax + caTax + caLLCFee)
      return { estimatedTotalTaxLiability }
    })()
    const projectedEstimatedTaxLiability = projected.estimatedTotalTaxLiability
    const taxSavingsFromBaseline = Math.max(0, baseline.estimatedTotalTaxLiability - projectedEstimatedTaxLiability)

    return {
      totalSep,
      projectedEstimatedTaxLiability,
      taxSavingsFromBaseline,
    }
  }, [
    boundedExtraContribution,
    existingSep,
    netProfit,
    stats.healthInsuranceTotal,
    stats.totalRevenue,
  ])

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle>Solo 401(k) / SEP-IRA Optimizer</CardTitle>
        <CardDescription>
          Slide to estimate how additional retirement contributions can reduce your federal + California tax. Limit shown reflects the effective self-employed SEP cap (based on net earnings after 1/2 SE tax).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">Existing SEP/IRA</p>
            <p className="text-lg font-semibold">${formatCurrency(existingSep)}</p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">Max allowed (2025)</p>
            <p className="text-lg font-semibold">${formatCurrency(sepMax)}</p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">Additional room</p>
            <p className="text-lg font-semibold">${formatCurrency(maxAdditional)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">
              Additional contribution: <span className="text-blue-700">${formatCurrency(boundedExtraContribution)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Total projected SEP/IRA: ${formatCurrency(projection.totalSep)}
            </div>
          </div>

          <SliderPrimitive.Root
            className="relative flex items-center select-none touch-none w-full h-5"
            value={[boundedExtraContribution]}
            min={0}
            max={maxAdditional}
            step={100}
            disabled={maxAdditional <= 0}
            onValueChange={(v) => setExtraContribution(v[0] ?? 0)}
          >
            <SliderPrimitive.Track className="bg-blue-100 relative grow rounded-full h-1">
              <SliderPrimitive.Range className="absolute bg-blue-500 rounded-full h-1" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="block w-4 h-4 bg-blue-600 rounded-full shadow" />
          </SliderPrimitive.Root>

          {maxAdditional <= 0 ? (
            <p className="text-xs text-muted-foreground">
              Based on your current net profit and categorized SEP/IRA, you appear to be at/over the effective 2025 SEP limit. Increase deductions to raise allowable contributions.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Projection recalculates self-employment tax and applies the resulting half-SE-tax deduction to AGI (so income tax reflects the updated half-SE-tax amount).
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">Projected estimated total tax</p>
            <p className="text-lg font-semibold text-blue-800">${formatCurrency(projection.projectedEstimatedTaxLiability)}</p>
          </div>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">Estimated tax savings vs baseline</p>
            <p className="text-lg font-semibold text-green-700">${formatCurrency(projection.taxSavingsFromBaseline)}</p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground leading-relaxed">
          Disclaimer: This is an estimate for planning purposes only and uses simplified 2025 single-filer bracket assumptions (matching the current app model). Consult a CPA for the final Schedule C / Schedule 1 and retirement plan worksheets.
        </div>
      </CardContent>
    </Card>
  )
}

