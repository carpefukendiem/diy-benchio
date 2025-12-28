"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle, AlertCircle, Edit2, Trash2, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ParsedTransaction {
  date: string
  description: string
  amount: number
  category: string
  isIncome: boolean
  merchantName?: string
}

interface TransactionReviewProps {
  transactions: ParsedTransaction[]
  accountName: string
  month: string
  year: string
  fileName: string
  onApprove: (transactions: ParsedTransaction[]) => void
  onCancel: () => void
}

const CATEGORIES = [
  "Sales Revenue",
  "Interest Income",
  "Other Income",
  "Returns & Allowances",
  "Cost of Service",
  "Software & Web Hosting Expense",
  "Business Meals Expense",
  "Gas & Auto Expense",
  "Bank & ATM Fee Expense",
  "Insurance Expense - Auto",
  "Insurance Expense - Business",
  "Merchant Fees Expense",
  "Office Supply Expense",
  "Phone & Internet Expense",
  "Professional Service Expense",
  "Rent Expense",
  "Utilities Expense",
  "Member Drawing - Ruben Ruiz",
  "Member Contribution - Ruben Ruiz",
]

export function TransactionReview({
  transactions: initialTransactions,
  accountName,
  month,
  year,
  fileName,
  onApprove,
  onCancel,
}: TransactionReviewProps) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const { toast } = useToast()

  console.log("[v0] TransactionReview rendered with", transactions.length, "transactions")

  const updateTransaction = (index: number, field: keyof ParsedTransaction, value: any) => {
    const updated = [...transactions]
    updated[index] = { ...updated[index], [field]: value }

    // Auto-update isIncome based on category
    if (field === "category") {
      const revenueCategories = ["Sales Revenue", "Interest Income", "Other Income", "Member Contribution - Ruben Ruiz"]
      updated[index].isIncome = revenueCategories.includes(value)
    }

    setTransactions(updated)
  }

  const deleteTransaction = (index: number) => {
    setTransactions(transactions.filter((_, i) => i !== index))
    toast({
      title: "Transaction Removed",
      description: "Transaction has been deleted from this import",
    })
  }

  const totalIncome = transactions.filter((t) => t.isIncome).reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = transactions.filter((t) => !t.isIncome).reduce((sum, t) => sum + t.amount, 0)

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Review Parsed Transactions</CardTitle>
            <CardDescription>
              Review and edit transactions extracted from {fileName}. Make any corrections before importing.
            </CardDescription>
            <div className="flex gap-3 mt-3">
              <Badge variant="outline">
                {accountName} - {month} {year}
              </Badge>
              <Badge variant="outline">{transactions.length} transactions</Badge>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                Income: ${totalIncome.toFixed(2)}
              </Badge>
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Expenses: ${totalExpenses.toFixed(2)}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => onApprove(transactions)} size="lg" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Import {transactions.length} Transactions
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Review the transactions below. Click the edit icon to modify any incorrect data, or click "Import" when
            ready to proceed.
          </p>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[120px]">Amount</TableHead>
                <TableHead className="w-[200px]">Category</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {editingIndex === index ? (
                      <Input
                        type="date"
                        value={transaction.date}
                        onChange={(e) => updateTransaction(index, "date", e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      <span className="text-sm">{transaction.date}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingIndex === index ? (
                      <Input
                        value={transaction.description}
                        onChange={(e) => updateTransaction(index, "description", e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      <div>
                        <div className="font-medium">{transaction.description}</div>
                        {transaction.merchantName && (
                          <div className="text-xs text-muted-foreground">{transaction.merchantName}</div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingIndex === index ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={transaction.amount}
                        onChange={(e) => updateTransaction(index, "amount", Number.parseFloat(e.target.value))}
                        className="h-8"
                      />
                    ) : (
                      <span className={`font-semibold ${transaction.isIncome ? "text-green-600" : "text-red-600"}`}>
                        {transaction.isIncome ? "+" : "-"}${transaction.amount.toFixed(2)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingIndex === index ? (
                      <Select
                        value={transaction.category}
                        onValueChange={(value) => updateTransaction(index, "category", value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">{transaction.category}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={transaction.isIncome ? "default" : "secondary"}>
                      {transaction.isIncome ? "Income" : "Expense"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {editingIndex === index ? (
                        <Button size="sm" variant="ghost" onClick={() => setEditingIndex(null)}>
                          <Save className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setEditingIndex(index)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => deleteTransaction(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Transactions</h3>
            <p className="text-muted-foreground">All transactions have been removed. Cancel to try again.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
