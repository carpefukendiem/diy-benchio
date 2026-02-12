/**
 * Barclays Credit Card PDF Statement Parser
 * 
 * Handles Barclays View Mastercard and similar Barclays credit card statements.
 * 
 * Format observed:
 * - Account ending in 4 digits (e.g., 2163)
 * - Statement Period: MM/DD/YY - MM/DD/YY
 * - Transactions section with:
 *   - Payments
 *   - Purchase Activity for CARDHOLDER card ending XXXX
 *   - Fees and Interest
 * - Transaction format: "Transaction Date | Posting Date | Description | Points | Amount"
 *   e.g., "Dec 16Dec 17SQ *SWEET CREAMS SANTA BARBARA CA42$14.00"
 *   or  "Jan 03Jan 05Payment Received WELLS FARGO BN/A-$175.00"
 * - Fees/Interest format: "Transaction Date | Posting Date | Description | Amount"
 *   e.g., "Feb 05Feb 05LATE PAYMENT FEE$40.00"
 */

import { ParsedTransaction } from '@/types';

interface BarclaysCCParseResult {
  accountName: string;
  accountNumber: string;
  statementMonth: string;
  previousBalance: number;
  statementBalance: number;
  totalPayments: number;
  totalPurchases: number;
  totalFees: number;
  totalInterest: number;
  transactions: ParsedTransaction[];
}

const MONTH_MAP: Record<string, number> = {
  'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
  'may': 5, 'jun': 6, 'jul': 7, 'aug': 8,
  'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
};

export function parseBarclaysCreditCardStatement(text: string): BarclaysCCParseResult {
  const lines = text.split('\n');

  // Extract account number
  const acctMatch = text.match(/(?:Account\s*Ending|account\s*ending)\s*(\d{4})/);
  const accountNumber = acctMatch ? acctMatch[1] : '';

  // Extract statement period: "Statement Period MM/DD/YY - MM/DD/YY"
  const periodMatch = text.match(/Statement\s*Period\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  let closingYear = new Date().getFullYear();
  let closingMonth = 1;

  if (periodMatch) {
    let yr = parseInt(periodMatch[6]);
    if (yr < 100) yr += 2000;
    closingYear = yr;
    closingMonth = parseInt(periodMatch[4]);
  }

  const statementMonth = `${closingYear}-${closingMonth.toString().padStart(2, '0')}`;

  // Extract balances from Account Activity section
  const prevBalMatch = text.match(/Previous\s*Balance\s*(?:as\s*of)?\s*\d{2}\/\d{2}\/\d{2,4}\s*\$?([\d,]+\.\d{2})/);
  const stmtBalMatch = text.match(/Statement\s*Balance\s*(?:as\s*of)?\s*\d{2}\/\d{2}\/\d{2,4}\s*=?\s*\$?([\d,]+\.\d{2})/);
  const paymentsLineMatch = text.match(/Payments?\s*(?:-\s*Thank\s*You)?\s*-\s*\$?([\d,]+\.\d{2})/);
  const purchasesLineMatch = text.match(/Purchases\s*\+?\s*\$?([\d,]+\.\d{2})/);
  const feesLineMatch = text.match(/Fees\s*Charged\s*\+?\s*\$?([\d,]+\.\d{2})/);
  const interestLineMatch = text.match(/Interest\s*Charged\s*\+?\s*\$?([\d,]+\.\d{2})/);

  const previousBalance = prevBalMatch ? parseFloat(prevBalMatch[1].replace(/,/g, '')) : 0;
  const statementBalance = stmtBalMatch ? parseFloat(stmtBalMatch[1].replace(/,/g, '')) : 0;
  const totalPayments = paymentsLineMatch ? parseFloat(paymentsLineMatch[1].replace(/,/g, '')) : 0;
  const totalPurchases = purchasesLineMatch ? parseFloat(purchasesLineMatch[1].replace(/,/g, '')) : 0;
  const totalFees = feesLineMatch ? parseFloat(feesLineMatch[1].replace(/,/g, '')) : 0;
  const totalInterest = interestLineMatch ? parseFloat(interestLineMatch[1].replace(/,/g, '')) : 0;

  // Parse transactions
  const transactions: ParsedTransaction[] = [];
  let currentSection: 'payment' | 'purchase' | 'fee' | 'interest' | 'none' = 'none';
  let inTransactionArea = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect start of Transactions section
    if (line === 'Transactions' || line.startsWith('Transactions')) {
      inTransactionArea = true;
      continue;
    }

    // Detect end of transactions
    if (inTransactionArea && (
      line.includes('Year-to-Date Totals') ||
      line.includes('Interest Charge Calculation') ||
      line.includes('This Year-to-date summary')
    )) {
      inTransactionArea = false;
      continue;
    }

    if (!inTransactionArea) continue;

    // Detect sub-sections
    if (line === 'Payments' || line.startsWith('Payments')) {
      currentSection = 'payment';
      continue;
    }
    if (line.includes('Purchase Activity for') || line.startsWith('Purchase Activity')) {
      currentSection = 'purchase';
      continue;
    }
    if (line === 'Fees Charged' || line.startsWith('Fees Charged')) {
      currentSection = 'fee';
      continue;
    }
    if (line === 'Interest Charged' || line.startsWith('Interest Charged')) {
      currentSection = 'interest';
      continue;
    }
    if (line.includes('Fees and Interest') || line.startsWith('Fees and Interest')) {
      // Parent section; sub-sections follow
      continue;
    }

    // Skip headers, totals, and info lines
    if (line.startsWith('Transaction Date') || line.startsWith('Total ') || line.includes('No ') ||
        line.includes('To see activity') || line.length < 10) continue;

    // Parse Barclays transaction lines
    // Format: "Mon DDMon DDDescription[Points]$Amount" or "Mon DDMon DDDescriptionAmount"
    // e.g., "Dec 16Dec 17SQ *SWEET CREAMS SANTA BARBARA CA42$14.00"
    // e.g., "Jan 03Jan 05Payment Received WELLS FARGO BN/A-$175.00"
    // Fee/Interest: "Feb 05Feb 05LATE PAYMENT FEE$40.00"
    // Interest: "Jan 08Jan 08INTEREST CHARGE-PB PURCHASE$59.47"

    const txRegex = /^([A-Z][a-z]{2})\s+(\d{1,2})([A-Z][a-z]{2})\s+(\d{1,2})(.+?)(-?\$[\d,]+\.\d{2})\s*$/;
    const match = txRegex.exec(line);

    if (match) {
      const txMonthStr = match[1].toLowerCase();
      const txDay = parseInt(match[2]);
      const postMonthStr = match[3].toLowerCase();
      const postDay = parseInt(match[4]);
      let descAndPoints = match[5].trim();
      const amountStr = match[6].replace(/[$,]/g, '');
      const amount = parseFloat(amountStr);

      const txMonthNum = MONTH_MAP[txMonthStr];
      if (!txMonthNum) continue;

      // Determine year - if tx month is much later than closing month, it's previous year
      let txYear = closingYear;
      if (txMonthNum > closingMonth + 1) {
        txYear = closingYear - 1;
      }

      const date = `${txYear}-${txMonthNum.toString().padStart(2, '0')}-${txDay.toString().padStart(2, '0')}`;

      // Clean description - remove points column for purchases
      // In purchase lines, description ends with a number (points) before the $ amount
      // e.g., "SQ *SWEET CREAMS SANTA BARBARA CA42" -> points=42, desc = "SQ *SWEET CREAMS SANTA BARBARA CA"
      let description = descAndPoints;
      if (currentSection === 'purchase') {
        // Remove trailing points number if present
        const pointsMatch = description.match(/^(.+?)(\d+)\s*$/);
        if (pointsMatch) {
          description = pointsMatch[1].trim();
        }
        // Also handle "N/A" points (for payments within purchase section)
        description = description.replace(/N\/A\s*$/, '').trim();
      } else {
        // Fee/Interest lines don't have points
        description = description.replace(/N\/A\s*$/, '').trim();
      }

      // Determine type
      let type: 'credit' | 'debit' = 'debit';
      if (currentSection === 'payment' || amount < 0) {
        type = 'credit';
      }

      transactions.push({
        date,
        description: cleanBarclaysDescription(description),
        original_description: description,
        amount: Math.abs(amount),
        type,
        raw_line: line,
      });
    }
  }

  return {
    accountName: 'Barclays View Mastercard',
    accountNumber,
    statementMonth,
    previousBalance,
    statementBalance,
    totalPayments,
    totalPurchases,
    totalFees,
    totalInterest,
    transactions,
  };
}

function cleanBarclaysDescription(desc: string): string {
  return desc
    .replace(/\s+/g, ' ')
    .trim();
}
