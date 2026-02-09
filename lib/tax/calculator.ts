/**
 * Tax Calculation Engine
 * 
 * Calculates Schedule C, Self-Employment Tax, and identifies
 * deduction opportunities for California sole proprietors.
 * 
 * DISCLAIMER: This is for informational purposes. Consult a CPA.
 */

import { Transaction, TaxSummary, DeductionOpportunity, BusinessType, ScheduleCLine } from '@/types';

// 2025 Tax Constants
const TAX_YEAR = 2025;
const SE_TAX_RATE = 0.153; // 15.3% (12.4% SS + 2.9% Medicare)
const SS_WAGE_BASE = 176100; // 2025 Social Security wage base
const SS_RATE = 0.124;
const MEDICARE_RATE = 0.029;
const ADDITIONAL_MEDICARE_THRESHOLD = 200000;
const ADDITIONAL_MEDICARE_RATE = 0.009;
const MEALS_DEDUCTION_RATE = 0.50; // 50% deductible
const MILEAGE_RATE = 0.70; // 70¢/mile for 2025
const HOME_OFFICE_SIMPLIFIED_RATE = 5; // $5/sq ft
const HOME_OFFICE_MAX_SQFT = 300;
const SECTION_179_LIMIT = 1220000; // 2025 estimate
const DE_MINIMIS_LIMIT = 2500;

// Schedule C line labels
const SCHEDULE_C_LABELS: Record<string, string> = {
  line_1: 'Gross receipts or sales',
  line_2: 'Returns and allowances',
  line_4: 'Cost of goods sold',
  line_6: 'Other income',
  line_8: 'Advertising',
  line_9: 'Car and truck expenses',
  line_10: 'Commissions and fees',
  line_11: 'Contract labor',
  line_13: 'Depreciation and Section 179',
  line_14: 'Employee benefit programs',
  line_15: 'Insurance (other than health)',
  line_16b: 'Interest (other)',
  line_17: 'Legal and professional services',
  line_18: 'Office expense',
  line_20a: 'Rent (vehicles/equipment)',
  line_20b: 'Rent (other business property)',
  line_21: 'Repairs and maintenance',
  line_22: 'Supplies',
  line_23: 'Taxes and licenses',
  line_24a: 'Travel',
  line_24b: 'Deductible meals',
  line_25: 'Utilities',
  line_26: 'Wages',
  line_27a: 'Other expenses',
  line_30: 'Business use of home',
};

export function calculateTaxSummary(
  transactions: Transaction[],
  businessName: string,
  businessType: BusinessType,
): TaxSummary {
  // Filter to non-transfer, non-duplicate transactions
  const validTx = transactions.filter(
    tx => !tx.is_transfer && !tx.duplicate_of && tx.category_id
  );

  // Separate income and expenses
  const incomeTx = validTx.filter(tx => tx.type === 'credit' && !tx.is_personal);
  const expenseTx = validTx.filter(tx => tx.type === 'debit' && !tx.is_personal);

  // Calculate gross income
  const grossIncome = incomeTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  // Calculate deductions by Schedule C line
  const lineAmounts: Record<string, number> = {};
  
  for (const tx of expenseTx) {
    const line = tx.schedule_c_line || 'line_27a';
    
    // Apply meals 50% rule
    const amount = line === 'line_24b' 
      ? Math.abs(tx.amount) * MEALS_DEDUCTION_RATE 
      : Math.abs(tx.amount);
    
    lineAmounts[line] = (lineAmounts[line] || 0) + amount;
  }

  // Build schedule C lines output
  const scheduleCLines: Record<string, { label: string; amount: number }> = {};
  
  // Income lines
  scheduleCLines['line_1'] = { 
    label: SCHEDULE_C_LABELS['line_1'], 
    amount: grossIncome 
  };
  
  // Expense lines
  for (const [line, amount] of Object.entries(lineAmounts)) {
    if (amount > 0) {
      scheduleCLines[line] = {
        label: SCHEDULE_C_LABELS[line] || 'Other',
        amount: Math.round(amount * 100) / 100,
      };
    }
  }

  const totalDeductions = Object.values(lineAmounts).reduce((sum, amt) => sum + amt, 0);
  const netProfit = grossIncome - totalDeductions;

  // Self-employment tax calculation
  const seTaxableIncome = netProfit * 0.9235; // 92.35% of net profit
  const socialSecurityTax = Math.min(seTaxableIncome, SS_WAGE_BASE) * SS_RATE;
  const medicareTax = seTaxableIncome * MEDICARE_RATE;
  const additionalMedicare = seTaxableIncome > ADDITIONAL_MEDICARE_THRESHOLD 
    ? (seTaxableIncome - ADDITIONAL_MEDICARE_THRESHOLD) * ADDITIONAL_MEDICARE_RATE 
    : 0;
  const selfEmploymentTax = socialSecurityTax + medicareTax + additionalMedicare;
  const seTaxDeduction = selfEmploymentTax * 0.5; // 50% deduction on Schedule 1

  // Quarterly estimated payments
  const estimatedQuarterly = (selfEmploymentTax + (netProfit * 0.22)) / 4; // Rough 22% income tax bracket

  // Find deduction opportunities
  const opportunities = findDeductionOpportunities(
    lineAmounts, businessType, grossIncome, netProfit
  );

  return {
    business_name: businessName,
    business_type: businessType,
    tax_year: TAX_YEAR,
    gross_income: Math.round(grossIncome * 100) / 100,
    total_deductions: Math.round(totalDeductions * 100) / 100,
    net_profit: Math.round(netProfit * 100) / 100,
    self_employment_tax: Math.round(selfEmploymentTax * 100) / 100,
    se_tax_deduction: Math.round(seTaxDeduction * 100) / 100,
    schedule_c_lines: scheduleCLines,
    estimated_quarterly_payments: Math.round(estimatedQuarterly * 100) / 100,
    deduction_opportunities: opportunities,
  };
}

function findDeductionOpportunities(
  currentDeductions: Record<string, number>,
  businessType: BusinessType,
  grossIncome: number,
  netProfit: number,
): DeductionOpportunity[] {
  const opportunities: DeductionOpportunity[] = [];

  // Home office deduction
  if (!currentDeductions['line_30'] || currentDeductions['line_30'] === 0) {
    const simplifiedDeduction = HOME_OFFICE_SIMPLIFIED_RATE * HOME_OFFICE_MAX_SQFT;
    opportunities.push({
      category: 'Home Office',
      description: `Simplified method: $5/sq ft, up to 300 sq ft = $${simplifiedDeduction.toLocaleString()}/yr. If you use a dedicated space regularly and exclusively for business.`,
      potential_savings: simplifiedDeduction * 0.30, // Estimated tax savings at ~30% effective rate
      action_required: 'Measure your home office space and calculate the percentage of your home used for business.',
      schedule_c_line: 'line_30',
    });
  }

  // Vehicle mileage
  if (!currentDeductions['line_9'] || currentDeductions['line_9'] < 1000) {
    const estimatedMiles = businessType === 'hair_stylist' ? 5000 : 3000;
    const mileageDeduction = estimatedMiles * MILEAGE_RATE;
    opportunities.push({
      category: 'Vehicle Mileage',
      description: `Standard mileage rate for 2025 is $${MILEAGE_RATE}/mile. Track business miles with an app like MileIQ or Everlance.`,
      potential_savings: mileageDeduction * 0.30,
      action_required: 'Start tracking business miles. Keep a mileage log with date, destination, business purpose, and miles driven.',
      schedule_c_line: 'line_9',
    });
  }

  // Retirement contributions (SEP-IRA / Solo 401k)
  if (netProfit > 10000) {
    const sepMax = Math.min(netProfit * 0.25, 69000); // 2025 limit
    opportunities.push({
      category: 'Retirement Contributions',
      description: `SEP-IRA: Contribute up to 25% of net self-employment income (max $69,000 for 2025). This reduces both income tax AND is off-the-top.`,
      potential_savings: Math.min(sepMax, netProfit * 0.25) * 0.30,
      action_required: 'Open a SEP-IRA (Vanguard, Fidelity, or Schwab) before tax filing deadline. Contributions can be made up to the filing deadline including extensions.',
      schedule_c_line: 'line_19' as ScheduleCLine,
    });
  }

  // Health insurance (if paying personally)
  if (!currentDeductions['line_15'] || currentDeductions['line_15'] < 2000) {
    opportunities.push({
      category: 'Self-Employed Health Insurance',
      description: 'Self-employed individuals can deduct 100% of health insurance premiums on Schedule 1 (not Schedule C). This reduces adjusted gross income.',
      potential_savings: 8500 * 0.30, // Average premium estimate
      action_required: 'Gather all health/dental/vision insurance premium receipts for the year. Deducted on Schedule 1, Line 17.',
      schedule_c_line: 'line_15' as ScheduleCLine,
    });
  }

  // Phone & Internet business percentage
  const phoneExpense = currentDeductions['line_25'] || 0;
  if (phoneExpense > 0 && phoneExpense < 1500) {
    opportunities.push({
      category: 'Phone & Internet (Full Business %)',
      description: 'Ensure you are deducting the full business-use percentage of your phone and internet bills. Digital marketing agencies typically justify 60-80% business use.',
      potential_savings: 1000 * 0.30,
      action_required: 'Review monthly phone/internet bills and determine a reasonable business-use percentage. Document how you use these services for business.',
      schedule_c_line: 'line_25',
    });
  }

  // Hair stylist specific
  if (businessType === 'hair_stylist') {
    if (!currentDeductions['line_22'] || currentDeductions['line_22'] < 500) {
      opportunities.push({
        category: 'Supplies & Tools',
        description: 'Hair products, tools (scissors, dryers, flat irons), color supplies, shampoo, conditioner — all deductible as supplies.',
        potential_savings: 2000 * 0.30,
        action_required: 'Keep receipts for all professional supplies. Separate personal-use products from business supplies.',
        schedule_c_line: 'line_22',
      });
    }

    if (!currentDeductions['line_23'] || currentDeductions['line_23'] < 100) {
      opportunities.push({
        category: 'Cosmetology License',
        description: 'Your California cosmetology license renewal fee and any continuing education required to maintain it are deductible.',
        potential_savings: 200 * 0.30,
        action_required: 'Include license renewal fees and required CE course costs.',
        schedule_c_line: 'line_23',
      });
    }
  }

  return opportunities;
}

/**
 * Generate a plain-text Schedule C summary for export/printing
 */
export function generateScheduleCText(summary: TaxSummary): string {
  let text = '';
  text += `${'='.repeat(60)}\n`;
  text += `SCHEDULE C SUMMARY — ${summary.business_name}\n`;
  text += `Tax Year: ${summary.tax_year}\n`;
  text += `${'='.repeat(60)}\n\n`;

  text += `INCOME\n`;
  text += `${'─'.repeat(40)}\n`;
  
  const incomeLines = ['line_1', 'line_2', 'line_4', 'line_6'];
  for (const line of incomeLines) {
    if (summary.schedule_c_lines[line]) {
      const { label, amount } = summary.schedule_c_lines[line];
      text += `  ${label.padEnd(35)} $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
    }
  }
  
  text += `\n  Gross Income:${' '.repeat(21)} $${summary.gross_income.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;

  text += `\nEXPENSES\n`;
  text += `${'─'.repeat(40)}\n`;
  
  const expenseLines = Object.entries(summary.schedule_c_lines)
    .filter(([line]) => !incomeLines.includes(line))
    .sort(([a], [b]) => a.localeCompare(b));
  
  for (const [, { label, amount }] of expenseLines) {
    text += `  ${label.padEnd(35)} $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
  }

  text += `\n  Total Deductions:${' '.repeat(17)} $${summary.total_deductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
  text += `\n${'═'.repeat(40)}\n`;
  text += `  NET PROFIT:${' '.repeat(22)} $${summary.net_profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
  text += `${'═'.repeat(40)}\n`;

  text += `\nSELF-EMPLOYMENT TAX\n`;
  text += `${'─'.repeat(40)}\n`;
  text += `  SE Tax (15.3%):${' '.repeat(18)} $${summary.self_employment_tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
  text += `  SE Tax Deduction (50%):${' '.repeat(10)} $${summary.se_tax_deduction.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
  text += `  Est. Quarterly Payment:${' '.repeat(10)} $${summary.estimated_quarterly_payments.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;

  if (summary.deduction_opportunities.length > 0) {
    text += `\n\nDEDUCTION OPPORTUNITIES\n`;
    text += `${'─'.repeat(40)}\n`;
    for (const opp of summary.deduction_opportunities) {
      text += `\n  ★ ${opp.category}\n`;
      text += `    ${opp.description}\n`;
      text += `    Est. tax savings: $${opp.potential_savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
      text += `    Action: ${opp.action_required}\n`;
    }
  }

  text += `\n\n⚠️  DISCLAIMER: This summary is for informational purposes only.\n`;
  text += `   Consult a licensed CPA for final tax filing.\n`;

  return text;
}
