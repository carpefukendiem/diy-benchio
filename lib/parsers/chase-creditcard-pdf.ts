/**
 * Chase Credit Card PDF Statement Parser
 * 
 * Handles Chase Freedom and similar Chase credit card statements.
 * 
 * Format observed:
 * - Account number ending in 4 digits (e.g., XXXX XXXX XXXX 1899)
 * - ACCOUNT SUMMARY section with balances
 * - ACCOUNT ACTIVITY section with transactions grouped:
 *   - PAYMENTS AND OTHER CREDITS
 *   - PURCHASE
 *   - FEES CHARGED
 *   - INTEREST CHARGED
 * - Transaction line format: "MM/DD     Description Amount"
 * - Dates use MM/DD with year inferred from statement period
 * - Statement period: "Opening/Closing Date MM/DD/YY - MM/DD/YY"
 */

import { ParsedTransaction } from '@/types';

interface ChaseCCParseResult {
  accountName: string;
  accountNumber: string;
  statementMonth: string;
  previousBalance: number;
  newBalance: number;
  totalPayments: number;
  totalPurchases: number;
  totalFees: number;
  totalInterest: number;
  transactions: ParsedTransaction[];
}

export function parseChaseCreditCardStatement(text: string): ChaseCCParseResult {
  const lines = text.split('\n');

  // Extract account number
  const acctMatch = text.match(/Account\s*(?:Number|number)?:?\s*(?:XXXX\s*XXXX\s*XXXX\s*)?(\d{4})/);
  const accountNumber = acctMatch ? acctMatch[1] : '';

  // Extract statement period: "Opening/Closing Date MM/DD/YY - MM/DD/YY"
  const periodMatch = text.match(/Opening\/Closing\s*Date\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  let closingYear = new Date().getFullYear();
  let closingMonth = 1;
  let closingDay = 1;
  let openingMonth = 1;

  if (periodMatch) {
    openingMonth = parseInt(periodMatch[1]);
    let yr = parseInt(periodMatch[6]);
    if (yr < 100) yr += 2000;
    closingYear = yr;
    closingMonth = parseInt(periodMatch[4]);
    closingDay = parseInt(periodMatch[5]);
  }

  const statementMonth = `${closingYear}-${closingMonth.toString().padStart(2, '0')}`;

  // Extract account summary balances
  const prevBalMatch = text.match(/Previous\s*Balance\s*\$?([\d,]+\.\d{2})/);
  const newBalMatch = text.match(/New\s*Balance\s*\$?([\d,]+\.\d{2})/);
  const paymentsMatch = text.match(/Payment,?\s*Credits?\s*-?\$?([\d,]+\.\d{2})/);
  const purchasesMatch = text.match(/Purchases\s*\+?\$?([\d,]+\.\d{2})/);
  const feesMatch = text.match(/Fees\s*Charged\s*\+?\$?([\d,]+\.\d{2})/);
  const interestMatch = text.match(/Interest\s*Charged\s*\+?\$?([\d,]+\.\d{2})/);

  const previousBalance = prevBalMatch ? parseFloat(prevBalMatch[1].replace(/,/g, '')) : 0;
  const newBalance = newBalMatch ? parseFloat(newBalMatch[1].replace(/,/g, '')) : 0;
  const totalPayments = paymentsMatch ? parseFloat(paymentsMatch[1].replace(/,/g, '')) : 0;
  const totalPurchases = purchasesMatch ? parseFloat(purchasesMatch[1].replace(/,/g, '')) : 0;
  const totalFees = feesMatch ? parseFloat(feesMatch[1].replace(/,/g, '')) : 0;
  const totalInterest = interestMatch ? parseFloat(interestMatch[1].replace(/,/g, '')) : 0;

  // Parse transactions from ACCOUNT ACTIVITY section
  const transactions: ParsedTransaction[] = [];

  // Current section tracking
  let inActivitySection = false;
  let currentSection: 'payment' | 'purchase' | 'fee' | 'interest' | 'unknown' = 'unknown';

  // Chase PDF transaction lines have varying formats:
  // "10/10     Payment Thank You - Web-225.00"  (payment, negative)
  // "10/01     PTGC LLC GOLETA GOLETA CA48.94"  (purchase, amount concatenated)
  // "10/15     PURCHASE INTEREST CHARGE132.04"   (interest, no space before amount)
  // "11/12     LATE FEE40.00"                    (fee, no space before amount)
  //
  // The amount is always at the end, and may be negative (prefixed with -)
  // The regex captures: date, then description+amount combined, we split later
  const txLineRegex = /^(\d{1,2})\/(\d{1,2})\s{2,}(.+?)(-?\d{1,3}(?:,\d{3})*\.\d{2})\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect ACCOUNT ACTIVITY section
    if (line === 'ACCOUNT ACTIVITY' || line.includes('ACCOUNT ACTIVITY')) {
      inActivitySection = true;
      continue;
    }

    // Detect end of activity section
    if (inActivitySection && (
      line.includes('Information About Your Account') ||
      line.includes('Annual Percentage Rate (APR)') ||
      line.includes('Balance Type')
    )) {
      inActivitySection = false;
      continue;
    }

    if (!inActivitySection) continue;

    // Detect sub-sections
    if (line.includes('PAYMENTS AND OTHER CREDITS') || line.includes('PAYMENT AND OTHER CREDITS')) {
      currentSection = 'payment';
      continue;
    }
    if (/^PURCHASE\b/.test(line) && !line.includes('INTEREST')) {
      currentSection = 'purchase';
      continue;
    }
    if (line === 'FEES CHARGED' || (line.includes('FEES CHARGED') && !line.includes('TOTAL'))) {
      currentSection = 'fee';
      continue;
    }
    if (line === 'INTEREST CHARGED' || (line.includes('INTEREST CHARGED') && !line.includes('TOTAL') && !line.includes('PURCHASE INTEREST'))) {
      currentSection = 'interest';
      continue;
    }

    // Skip total/summary lines and year-to-date lines
    if (line.startsWith('TOTAL ')) continue;
    if (line.startsWith('Total ')) continue;
    if (line.includes('Year-to-date')) continue;
    if (line.includes('year-to-date')) continue;

    // Try to match transaction line
    const match = txLineRegex.exec(line);

    if (match) {
      const txMonth = parseInt(match[1]);
      const txDay = parseInt(match[2]);
      let description = match[3].trim();
      const amountStr = match[4].replace(/,/g, '');
      const amount = parseFloat(amountStr);

      // Determine year from statement period
      // If tx month > closing month, it's from the previous year (e.g., Dec tx on Jan closing)
      let txYear = closingYear;
      if (txMonth > closingMonth + 1) {
        txYear = closingYear - 1;
      }

      const date = `${txYear}-${txMonth.toString().padStart(2, '0')}-${txDay.toString().padStart(2, '0')}`;

      // Determine type based on section and amount
      let type: 'credit' | 'debit' = 'debit';

      if (currentSection === 'payment') {
        type = 'credit';
      } else if (currentSection === 'purchase') {
        type = 'debit';
      } else if (currentSection === 'fee') {
        type = 'debit';
      } else if (currentSection === 'interest') {
        type = 'debit';
      }

      // Negative amounts indicate credits (e.g., payments show as -225.00)
      if (amount < 0) {
        type = 'credit';
      }

      transactions.push({
        date,
        description: cleanDescription(description),
        original_description: description,
        amount: Math.abs(amount),
        type,
        raw_line: line,
      });
    }
  }

  return {
    accountName: 'Chase Freedom',
    accountNumber,
    statementMonth,
    previousBalance,
    newBalance,
    totalPayments,
    totalPurchases,
    totalFees,
    totalInterest,
    transactions,
  };
}

function cleanDescription(desc: string): string {
  return desc
    .replace(/\s+/g, ' ')
    .replace(/\s*\d{4}\s*$/, '') // Remove trailing card last 4
    .trim();
}
