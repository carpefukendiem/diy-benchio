// ============================================
// DIY Bench.io — Core Type Definitions
// ============================================

export type BusinessType = 'digital_marketing' | 'hair_stylist';

export interface Business {
  id: string;
  user_id: string;
  name: string;
  type: BusinessType;
  entity_type: 'sole_prop' | 'llc' | 'scorp';
  ein?: string;
  created_at: string;
}

export interface Account {
  id: string;
  business_id: string;
  name: string;
  institution: string;
  account_type: 'checking' | 'savings' | 'credit_card';
  last_four: string;
  is_primary: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  business_id: string;
  date: string;
  description: string;
  original_description: string;
  amount: number; // positive = income/credit, negative = expense/debit
  type: 'credit' | 'debit';
  category_id: string | null;
  schedule_c_line: string | null;
  is_personal: boolean;
  is_transfer: boolean;
  confidence: number; // 0-1, how confident the categorization is
  categorized_by: 'rule' | 'ai' | 'user' | null;
  notes: string | null;
  duplicate_of: string | null;
  statement_month: string; // e.g. "2025-03"
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  schedule_c_line: ScheduleCLine | null;
  type: 'income' | 'expense' | 'transfer' | 'personal';
  business_types: BusinessType[]; // which business types this applies to
  description: string;
  keywords: string[]; // for rule-based matching
}

// Schedule C line items for tax mapping
export type ScheduleCLine =
  | 'line_1'    // Gross receipts or sales
  | 'line_2'    // Returns and allowances
  | 'line_4'    // Cost of goods sold
  | 'line_6'    // Other income
  | 'line_8'    // Advertising
  | 'line_9'    // Car and truck expenses
  | 'line_10'   // Commissions and fees
  | 'line_11'   // Contract labor
  | 'line_12'   // Depletion
  | 'line_13'   // Depreciation / Section 179
  | 'line_14'   // Employee benefit programs
  | 'line_15'   // Insurance (other than health)
  | 'line_16a'  // Mortgage interest
  | 'line_16b'  // Other interest
  | 'line_17'   // Legal and professional services
  | 'line_18'   // Office expense
  | 'line_19'   // Pension/profit-sharing plans
  | 'line_20a'  // Rent — vehicles/machinery/equipment
  | 'line_20b'  // Rent — other business property
  | 'line_21'   // Repairs and maintenance
  | 'line_22'   // Supplies
  | 'line_23'   // Taxes and licenses
  | 'line_24a'  // Travel
  | 'line_24b'  // Meals (50% deductible)
  | 'line_25'   // Utilities
  | 'line_26'   // Wages
  | 'line_27a'  // Other expenses
  | 'line_30'   // Business use of home;

export interface CategorizationRule {
  id: string;
  business_id: string;
  pattern: string; // regex or keyword match
  match_type: 'contains' | 'starts_with' | 'exact' | 'regex';
  category_id: string;
  is_personal: boolean;
  is_transfer: boolean;
  priority: number; // higher = checked first
  created_by: 'system' | 'user' | 'ai';
  created_at: string;
}

export interface StatementUpload {
  id: string;
  business_id: string;
  account_id: string;
  filename: string;
  file_type: 'pdf' | 'csv';
  statement_month: string;
  status: 'processing' | 'parsed' | 'categorized' | 'reviewed' | 'error';
  transaction_count: number;
  error_message: string | null;
  uploaded_at: string;
}

// Parsed transaction from PDF/CSV before saving to DB
export interface ParsedTransaction {
  date: string;
  description: string;
  original_description?: string;
  amount: number;
  type: 'credit' | 'debit';
  balance?: number;
  check_number?: string;
  raw_line: string;
  }

// Financial report types
export interface IncomeStatement {
  period: string;
  revenue: {
    gross_sales: number;
    returns: number;
    other_income: number;
    total_revenue: number;
  };
  cost_of_sales: number;
  gross_profit: number;
  expenses: Record<string, number>;
  total_expenses: number;
  net_profit: number;
}

export interface BalanceSheet {
  as_of: string;
  assets: {
    checking: number;
    savings: number;
    accounts_receivable: number;
    other_assets: number;
    total_assets: number;
  };
  liabilities: {
    credit_cards: number;
    loans: number;
    accounts_payable: number;
    total_liabilities: number;
  };
  equity: {
    owner_contribution: number;
    owner_draws: number;
    retained_earnings: number;
    net_income: number;
    total_equity: number;
  };
}

export interface TaxSummary {
  business_name: string;
  business_type: BusinessType;
  tax_year: number;
  gross_income: number;
  total_deductions: number;
  net_profit: number;
  self_employment_tax: number;
  se_tax_deduction: number; // 50% of SE tax
  schedule_c_lines: Record<string, { label: string; amount: number }>;
  estimated_quarterly_payments: number;
  deduction_opportunities: DeductionOpportunity[];
}

export interface DeductionOpportunity {
  category: string;
  description: string;
  potential_savings: number;
  action_required: string;
  schedule_c_line: ScheduleCLine;
}

// Dashboard stats
export interface DashboardStats {
  total_income: number;
  total_expenses: number;
  net_profit: number;
  uncategorized_count: number;
  total_transactions: number;
  monthly_breakdown: {
    month: string;
    income: number;
    expenses: number;
    profit: number;
  }[];
  top_expense_categories: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  tax_savings_found: number;
}

// User profile
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}
