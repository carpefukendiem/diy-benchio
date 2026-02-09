/**
 * Wells Fargo PDF Statement Parser
 * 
 * Handles the specific format of Wells Fargo Business Checking
 * and Everyday Checking PDF statements.
 * 
 * Format observed:
 * - Transactions in columnar layout: Date | Check# | Description | Credits | Debits | Balance
 * - Multi-line descriptions (continuation lines lack a date prefix)
 * - Date format: M/D (month/day, year from statement header)
 * - Credits and Debits are separate columns (right-aligned numbers)
 * - Daily ending balance appears on the last transaction line of each day
 */

import { ParsedTransaction } from '@/types';

interface WellsFargoParseResult {
  accountName: string;
  accountNumber: string;
  statementMonth: string;
  beginningBalance: number;
  endingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  transactions: ParsedTransaction[];
}

export function parseWellsFargoStatement(text: string): WellsFargoParseResult {
  const lines = text.split('\n');
  
  // Extract statement metadata
  const yearMatch = text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+(\d{4})/);
  const statementYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
  
  const monthMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/);
  const monthNames: Record<string, string> = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12'
  };
  const statementMonth = monthMatch 
    ? `${statementYear}-${monthNames[monthMatch[1]] || '01'}`
    : `${statementYear}-01`;

  // Extract account info
  const accountMatch = text.match(/Account number:\s*(\d+)/);
  const accountNumber = accountMatch ? accountMatch[1] : '';
  const lastFour = accountNumber.slice(-4);
  
  const accountNameMatch = text.match(/(WELLS FARGO [A-Z ]+(?:CHECKING|SAVINGS)|Initiate Business Checking)/i);
  const accountName = accountNameMatch ? accountNameMatch[1].trim() : 'Wells Fargo Checking';

  // Extract summary
  const beginBalMatch = text.match(/Beginning balance[^$]*\$?([\d,]+\.\d{2})/);
  const endBalMatch = text.match(/Ending balance[^$]*\$?([\d,]+\.\d{2})/);
  const depositsMatch = text.match(/Deposits\/(?:Credits|Additions)\s+([\d,]+\.\d{2})/);
  const withdrawalsMatch = text.match(/Withdrawals\/(?:Debits|Subtractions)\s+-?\s*([\d,]+\.\d{2})/);

  const beginningBalance = beginBalMatch ? parseFloat(beginBalMatch[1].replace(/,/g, '')) : 0;
  const endingBalance = endBalMatch ? parseFloat(endBalMatch[1].replace(/,/g, '')) : 0;
  const totalDeposits = depositsMatch ? parseFloat(depositsMatch[1].replace(/,/g, '')) : 0;
  const totalWithdrawals = withdrawalsMatch ? parseFloat(withdrawalsMatch[1].replace(/,/g, '')) : 0;

  // Parse transactions
  const transactions: ParsedTransaction[] = [];
  
  // Find transaction section
  let inTransactionSection = false;
  let currentTransaction: Partial<ParsedTransaction> | null = null;
  let currentDateStr = '';
  
  // Regex for transaction start line: date at beginning, numbers at end
  // Format: "3/3 Description text 123.45" or "3/3 Description text 123.45 456.78"
  const txStartRegex = /^(\d{1,2})\/(\d{1,2})\s+(.+)/;
  
  // Regex for amounts - one or two amounts at end of line
  const amountRegex = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;
  
  // Detect if a line is a continuation (no date prefix, not a header/footer)
  const isHeaderLine = (line: string) => {
    return line.includes('Transaction') || 
           line.includes('Check ') ||
           line.includes('Date ') ||
           line.includes('Totals') ||
           line.includes('Page ') ||
           line.includes('continued') ||
           line.includes('Ending daily') ||
           line.includes('balance') && line.includes('Date') ||
           line.includes('The Ending Daily Balance') ||
           line.includes('Monthly service fee summary') ||
           line.includes('Account transaction');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Start of transaction section
    if (line.includes('Transaction history') || line.includes('Transaction History')) {
      inTransactionSection = true;
      continue;
    }
    
    // End of transaction section
    if (line.startsWith('Totals') || 
        line.includes('Monthly service fee summary') ||
        line.includes('Account transaction fees') ||
        line.includes('IMPORTANT ACCOUNT INFORMATION') ||
        line.includes('Overdraft Protection') && !inTransactionSection) {
      if (currentTransaction && currentTransaction.description) {
        finalizeTransaction(currentTransaction as ParsedTransaction, transactions, statementYear, currentDateStr);
      }
      inTransactionSection = false;
      continue;
    }
    
    if (!inTransactionSection) continue;
    if (isHeaderLine(line)) continue;
    if (line.length < 3) continue;
    
    const txMatch = txStartRegex.exec(line);
    
    if (txMatch) {
      // Save previous transaction
      if (currentTransaction && currentTransaction.description) {
        finalizeTransaction(currentTransaction as ParsedTransaction, transactions, statementYear, currentDateStr);
      }
      
      const month = txMatch[1];
      const day = txMatch[2];
      currentDateStr = `${month}/${day}`;
      const descriptionAndAmounts = txMatch[3];
      
      // Extract amounts from end of line
      const amounts = extractAmounts(descriptionAndAmounts);
      const description = descriptionAndAmounts.replace(/\s+[\d,]+\.\d{2}/g, '').trim();
      
      // Negative balance indicator
      const hasNegativeBalance = line.includes('-') && /^-[\d,]+\.\d{2}$/.test(amounts.balance?.toString() || '');
      
      currentTransaction = {
        date: formatDate(statementYear, parseInt(month), parseInt(day)),
        description: description,
        amount: 0,
        type: 'debit',
        balance: amounts.balance,
        raw_line: line,
      };
      
      if (amounts.credit && amounts.debit) {
        // Both credit and debit on same line (rare but happens)
        // The last amount is usually the balance
        currentTransaction.amount = amounts.credit;
        currentTransaction.type = 'credit';
        // We might need to also record the debit
      } else if (amounts.credit) {
        currentTransaction.amount = amounts.credit;
        currentTransaction.type = 'credit';
      } else if (amounts.debit) {
        currentTransaction.amount = amounts.debit;
        currentTransaction.type = 'debit';
      }
    } else if (currentTransaction) {
      // Continuation line — append to description
      // But check if this line has amounts that belong to the transaction
      const lineAmounts = [...line.matchAll(amountRegex)];
      
      if (lineAmounts.length > 0 && currentTransaction.amount === 0) {
        // This continuation line has the amounts
        const amounts = extractAmounts(line);
        const desc = line.replace(/\s*-?[\d,]+\.\d{2}\s*/g, '').trim();
        currentTransaction.description += ' ' + desc;
        
        if (amounts.credit) {
          currentTransaction.amount = amounts.credit;
          currentTransaction.type = 'credit';
        } else if (amounts.debit) {
          currentTransaction.amount = amounts.debit;
          currentTransaction.type = 'debit';
        }
        if (amounts.balance !== undefined) {
          currentTransaction.balance = amounts.balance;
        }
      } else {
        // Pure description continuation
        const desc = line.replace(/\s*-?[\d,]+\.\d{2}\s*/g, '').trim();
        if (desc && !desc.match(/^\d+$/)) {
          currentTransaction.description += ' ' + desc;
        }
        
        // Check if amounts appeared on this continuation line
        if (lineAmounts.length > 0) {
          const amounts = extractAmounts(line);
          if (amounts.balance !== undefined) {
            currentTransaction.balance = amounts.balance;
          }
        }
      }
    }
  }
  
  // Don't forget the last transaction
  if (currentTransaction && currentTransaction.description) {
    finalizeTransaction(currentTransaction as ParsedTransaction, transactions, statementYear, currentDateStr);
  }

  return {
    accountName,
    accountNumber: lastFour,
    statementMonth,
    beginningBalance,
    endingBalance,
    totalDeposits,
    totalWithdrawals,
    transactions,
  };
}

interface ExtractedAmounts {
  credit?: number;
  debit?: number;
  balance?: number;
}

function extractAmounts(text: string): ExtractedAmounts {
  // Find all dollar amounts in the text
  const amounts: number[] = [];
  const matches = [...text.matchAll(/(-?[\d,]+\.\d{2})/g)];
  
  for (const match of matches) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    amounts.push(val);
  }
  
  if (amounts.length === 0) return {};
  
  // Wells Fargo format: the rightmost number is the daily ending balance
  // If 3 numbers: credit, debit, balance  
  // If 2 numbers: could be (credit/debit, balance) or (credit, debit)
  // If 1 number: credit or debit (balance on same line as another tx)
  
  // Heuristic: the last number in a daily group is the balance
  // For now, we'll handle common cases:
  
  if (amounts.length === 3) {
    return { credit: amounts[0], debit: amounts[1], balance: amounts[2] };
  } else if (amounts.length === 2) {
    // The second is likely the balance
    return { debit: amounts[0], balance: amounts[1] };
  } else if (amounts.length === 1) {
    // Single amount — could be credit or debit
    // We determine this from context (description keywords)
    return { debit: amounts[0] };
  }
  
  return {};
}

function finalizeTransaction(
  tx: ParsedTransaction, 
  transactions: ParsedTransaction[],
  year: number,
  dateStr: string,
) {
  // Clean up description
  tx.description = tx.description
    .replace(/\s+/g, ' ')
    .replace(/Card \d{4}$/, '')
    .replace(/S\d{15,}/, '')
    .replace(/P\d{15,}/, '')
    .trim();
  
  tx.original_description = tx.description;
  
  // Determine credit vs debit from description keywords
  const creditKeywords = [
    'stripe transfer', 'zelle from', 'online transfer from', 
    'upwork escrow', 'deposit', 'purchase return', 'refund',
    'overdraft protection from', 'instant pmt from',
  ];
  
  const debitKeywords = [
    'purchase authorized', 'recurring payment', 'online transfer to',
    'atm withdrawal', 'zelle to', 'overdraft fee', 'monthly service fee',
    'chase credit crd', 'so cal edison', 'vz wireless',
    'recurring transfer to', 'save as you go',
    'united fin cas',
  ];
  
  const descLower = tx.description.toLowerCase();
  
  const isCredit = creditKeywords.some(k => descLower.includes(k));
  const isDebit = debitKeywords.some(k => descLower.includes(k));
  
  if (isCredit && !isDebit) {
    tx.type = 'credit';
  } else if (isDebit && !isCredit) {
    tx.type = 'debit';
  }
  // If both or neither, keep the heuristic from amount extraction
  
  // Ensure amount is positive (we use type field for direction)
  tx.amount = Math.abs(tx.amount || 0);
  
  if (tx.amount > 0) {
    transactions.push({ ...tx });
  }
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/**
 * Deduplicate transactions across statement uploads
 */
export function deduplicateTransactions(
  existing: ParsedTransaction[],
  incoming: ParsedTransaction[]
): ParsedTransaction[] {
  const existingKeys = new Set(
    existing.map(t => `${t.date}|${t.amount}|${t.description.slice(0, 30)}`)
  );
  
  return incoming.filter(t => {
    const key = `${t.date}|${t.amount}|${t.description.slice(0, 30)}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });
}
