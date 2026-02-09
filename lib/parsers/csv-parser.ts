/**
 * Generic CSV Statement Parser
 * Handles Wells Fargo CSV exports and other common bank CSV formats
 */

import { ParsedTransaction } from '@/types';
import Papa from 'papaparse';

interface CSVParseResult {
  transactions: ParsedTransaction[];
  detectedFormat: string;
}

// Known CSV column mappings for different banks
const COLUMN_MAPS: Record<string, {
  date: string[];
  description: string[];
  amount: string[];
  credit: string[];
  debit: string[];
  type: string[];
  balance: string[];
}> = {
  wellsfargo: {
    date: ['Date', 'Transaction Date', 'date'],
    description: ['Description', 'description', 'Narrative'],
    amount: ['Amount', 'amount'],
    credit: ['Credits', 'Deposits', 'Credit'],
    debit: ['Debits', 'Withdrawals', 'Debit'],
    type: ['Type', 'Transaction Type'],
    balance: ['Balance', 'Running Balance', 'Running Bal.'],
  },
  chase: {
    date: ['Transaction Date', 'Posting Date', 'Date'],
    description: ['Description', 'Merchant Name'],
    amount: ['Amount'],
    credit: [],
    debit: [],
    type: ['Type'],
    balance: ['Balance'],
  },
  generic: {
    date: ['Date', 'Transaction Date', 'Posted Date', 'date'],
    description: ['Description', 'Memo', 'Narrative', 'Payee', 'description'],
    amount: ['Amount', 'amount', 'Transaction Amount'],
    credit: ['Credit', 'Deposit', 'Credits'],
    debit: ['Debit', 'Withdrawal', 'Debits', 'Payment'],
    type: ['Type', 'Transaction Type'],
    balance: ['Balance', 'Running Balance'],
  },
};

export function parseCSVStatement(csvContent: string): CSVParseResult {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const headers = parsed.meta.fields || [];
  const rows = parsed.data as Record<string, string>[];

  // Detect format
  const format = detectFormat(headers);
  const colMap = COLUMN_MAPS[format] || COLUMN_MAPS.generic;

  // Find actual column names
  const dateCol = findColumn(headers, colMap.date);
  const descCol = findColumn(headers, colMap.description);
  const amountCol = findColumn(headers, colMap.amount);
  const creditCol = findColumn(headers, colMap.credit);
  const debitCol = findColumn(headers, colMap.debit);
  const balanceCol = findColumn(headers, colMap.balance);

  if (!dateCol || !descCol) {
    throw new Error('Could not identify date and description columns in CSV');
  }

  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const dateStr = row[dateCol]?.trim();
    const description = row[descCol]?.trim();

    if (!dateStr || !description) continue;

    const date = parseDate(dateStr);
    if (!date) continue;

    let amount = 0;
    let type: 'credit' | 'debit' = 'debit';

    if (creditCol && debitCol) {
      // Separate credit/debit columns
      const credit = parseAmount(row[creditCol]);
      const debit = parseAmount(row[debitCol]);
      if (credit > 0) {
        amount = credit;
        type = 'credit';
      } else if (debit > 0) {
        amount = debit;
        type = 'debit';
      }
    } else if (amountCol) {
      // Single amount column (positive = credit, negative = debit)
      amount = parseAmount(row[amountCol]);
      if (amount >= 0) {
        type = 'credit';
      } else {
        type = 'debit';
        amount = Math.abs(amount);
      }
    }

    const balance = balanceCol ? parseAmount(row[balanceCol]) : undefined;

    if (amount > 0) {
      transactions.push({
        date,
        description,
        original_description: description,
        amount,
        type,
        balance: balance || undefined,
        raw_line: JSON.stringify(row),
      });
    }
  }

  return { transactions, detectedFormat: format };
}

function detectFormat(headers: string[]): string {
  const headerStr = headers.join(' ').toLowerCase();
  
  if (headerStr.includes('wells fargo') || 
      (headerStr.includes('date') && headerStr.includes('description') && headerStr.includes('credits'))) {
    return 'wellsfargo';
  }
  if (headerStr.includes('chase') || headerStr.includes('posting date')) {
    return 'chase';
  }
  return 'generic';
}

function findColumn(headers: string[], candidates: string[]): string | null {
  for (const candidate of candidates) {
    const found = headers.find(h => h.toLowerCase() === candidate.toLowerCase());
    if (found) return found;
  }
  // Fuzzy match
  for (const candidate of candidates) {
    const found = headers.find(h => h.toLowerCase().includes(candidate.toLowerCase()));
    if (found) return found;
  }
  return null;
}

function parseAmount(str: string | undefined): number {
  if (!str) return 0;
  // Remove currency symbols, commas, spaces
  const cleaned = str.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(str: string): string | null {
  // Try common date formats
  const formats = [
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // M/D/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,
    // MM-DD-YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  ];

  for (const fmt of formats) {
    const match = fmt.exec(str);
    if (match) {
      let year: number, month: number, day: number;
      
      if (str.startsWith('20') && str.includes('-')) {
        // YYYY-MM-DD
        [, year, month, day] = match.map(Number) as [never, number, number, number];
      } else {
        // MM/DD/YYYY
        [, month, day, year] = match.map(Number) as [never, number, number, number];
        if (year < 100) year += 2000;
      }
      
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }

  // Try Date.parse as fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}
