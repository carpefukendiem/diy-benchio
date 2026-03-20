"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CATEGORIES } from "@/components/interactive-transactions-list"
import { auditCategoryCoverage } from "@/lib/tax/categoryCoverage"

export function MappingCoverageAudit() {
  const issues = useMemo(() => {
    return auditCategoryCoverage(CATEGORIES)
  }, [])

  if (issues.length === 0) return null

  return (
    <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
      <CardHeader>
        <CardTitle className="text-base">Mapping Coverage Audit</CardTitle>
        <CardDescription>
          Categories not found in schedule mappings and not explicitly classified as non-deductible/personal/transfer/capital.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-yellow-900/90">
            Found {issues.length} categories with incomplete tax treatment coverage.
          </p>
          <ul className="text-sm list-disc ml-5 space-y-1">
            {issues.map((i) => (
              <li key={i.category}>
                <span className="font-medium">{i.category}</span> — {i.notes}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Tip: update the schedule mapping and/or exclusion keyword lists so deductible transactions are maximized and non-deductible items don’t reduce taxes.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

