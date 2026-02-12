/**
 * Rule-Based Categorization Engine
 * 
 * First pass: matches transactions against known patterns.
 * Handles ~70-80% of transactions automatically.
 */

import { ParsedTransaction, CategorizationRule } from '@/types';

export interface CategorizedTransaction extends ParsedTransaction {
  category_id: string | null;
  schedule_c_line: string | null;
  is_personal: boolean;
  is_transfer: boolean;
  confidence: number;
  categorized_by: 'rule' | 'ai' | 'user' | null;
}

// Built-in rules for Ranking SB business account
const BUILT_IN_RULES: Array<{
  pattern: string;
  match: 'contains' | 'starts_with';
  category_id: string;
  is_personal: boolean;
  is_transfer: boolean;
  confidence: number;
}> = [
  // === INCOME ===
  { pattern: 'stripe transfer', match: 'contains', category_id: '00000000-0000-0000-0001-000000000001', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'upwork escrow', match: 'contains', category_id: '00000000-0000-0000-0001-000000000004', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'purchase return', match: 'contains', category_id: '00000000-0000-0000-0001-000000000002', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'instant pmt from coinbase', match: 'contains', category_id: '00000000-0000-0000-0004-000000000009', is_personal: true, is_transfer: false, confidence: 0.90 },

  // === SOFTWARE & SUBSCRIPTIONS (Line 27a) ===
  { pattern: 'highlevel', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'gohighlevel', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'sinch mailgun', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'mailgun', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'openai', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'cursor', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'loom subscription', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'screaming frog', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'google*gsuite', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'google *google one', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'webflow', match: 'contains', category_id: '00000000-0000-0000-0002-000000000002', is_personal: false, is_transfer: false, confidence: 0.90 },

  // === SOCIAL MEDIA / ADVERTISING (Line 8) ===
  { pattern: 'x corp', match: 'contains', category_id: '00000000-0000-0000-0002-000000000002', is_personal: false, is_transfer: false, confidence: 0.85 },

  // === EDUCATION (Line 27a) ===
  { pattern: 'codecademy', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.90 },

  // === PROFESSIONAL SERVICES (Line 17) ===
  { pattern: 'bench accounting', match: 'contains', category_id: '00000000-0000-0000-0002-000000000011', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'coinledger', match: 'contains', category_id: '00000000-0000-0000-0002-000000000012', is_personal: false, is_transfer: false, confidence: 0.90 },

  // === PHONE & INTERNET (Line 25) ===
  { pattern: 'vz wireless', match: 'contains', category_id: '00000000-0000-0000-0002-000000000021', is_personal: false, is_transfer: false, confidence: 0.85 },

  // === UTILITIES (Line 25) ===
  { pattern: 'so cal edison', match: 'contains', category_id: '00000000-0000-0000-0002-000000000020', is_personal: false, is_transfer: false, confidence: 0.85 },

  // === INSURANCE (Line 15) ===
  { pattern: 'united fin cas', match: 'contains', category_id: '00000000-0000-0000-0002-000000000008', is_personal: false, is_transfer: false, confidence: 0.90 },

  // === GAS / AUTO (Line 9) ===
  { pattern: 'fuel', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.85 },

  // === OFFICE SUPPLIES (Line 18) ===
  { pattern: 'ups store', match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.85 },

  // === WASTE (Line 27a) ===
  { pattern: 'marborg', match: 'contains', category_id: '00000000-0000-0000-0002-000000000025', is_personal: false, is_transfer: false, confidence: 0.90 },

  // === HOME IMPROVEMENT ===
  { pattern: 'home depot', match: 'contains', category_id: '00000000-0000-0000-0002-000000000026', is_personal: false, is_transfer: false, confidence: 0.70 },

  // === BANK FEES (Line 16b) ===
  { pattern: 'overdraft fee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'monthly service fee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.95 },

  // === TRANSFERS ===
  { pattern: 'online transfer to ruiz r everyday checking', match: 'contains', category_id: '00000000-0000-0000-0003-000000000001', is_personal: false, is_transfer: true, confidence: 0.95 },
  { pattern: 'online transfer from ruiz r', match: 'contains', category_id: '00000000-0000-0000-0003-000000000002', is_personal: false, is_transfer: true, confidence: 0.95 },
  { pattern: 'online transfer to nail-ruiz', match: 'contains', category_id: '00000000-0000-0000-0003-000000000003', is_personal: false, is_transfer: true, confidence: 0.90 },
  { pattern: 'online transfer from nail-ruiz', match: 'contains', category_id: '00000000-0000-0000-0003-000000000002', is_personal: false, is_transfer: true, confidence: 0.90 },
  { pattern: 'online transfer to carpefukendiem', match: 'contains', category_id: '00000000-0000-0000-0003-000000000003', is_personal: false, is_transfer: true, confidence: 0.90 },
  { pattern: 'recurring transfer to carpefukendiem', match: 'contains', category_id: '00000000-0000-0000-0003-000000000003', is_personal: false, is_transfer: true, confidence: 0.90 },
  { pattern: 'chase credit crd', match: 'contains', category_id: '00000000-0000-0000-0003-000000000005', is_personal: false, is_transfer: true, confidence: 0.95 },
  { pattern: 'overdraft protection from', match: 'contains', category_id: '00000000-0000-0000-0003-000000000003', is_personal: false, is_transfer: true, confidence: 0.95 },
  { pattern: 'save as you go', match: 'contains', category_id: '00000000-0000-0000-0003-000000000003', is_personal: false, is_transfer: true, confidence: 0.95 },

  // === ZELLE ===
  { pattern: 'zelle to ruiz janice', match: 'contains', category_id: '00000000-0000-0000-0004-000000000008', is_personal: false, is_transfer: true, confidence: 0.80 },
  { pattern: 'zelle from nailruiz', match: 'contains', category_id: '00000000-0000-0000-0003-000000000002', is_personal: false, is_transfer: true, confidence: 0.80 },

  // === PERSONAL ===
  { pattern: 'atm withdrawal', match: 'contains', category_id: '00000000-0000-0000-0004-000000000007', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'costco', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.75 },
  { pattern: 'sprouts', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.75 },
  { pattern: 'pressed juicery', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'pressed -', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'coldstone', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'taco bell', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'little caesars', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'wingstop', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'jersey mikes', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: '7-eleven', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'cvs', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'audible', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'prime video', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'apple.com/bill', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.75 },
  { pattern: 'ouraring', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'midjourney', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'tradingview', match: 'contains', category_id: '00000000-0000-0000-0004-000000000009', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'billabong', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'blenders', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.80 },
  
  // === MEALS (ambiguous — default business with lower confidence) ===
  { pattern: 'lighthouse cof', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.60 },

  // === CREDIT CARD SPECIFIC ===
  // Interest and fees (from CC statements)
  { pattern: 'purchase interest charge', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'interest charge-pb purchase', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'interest charge on purchases', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'late fee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'late payment fee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'payment received', match: 'contains', category_id: '00000000-0000-0000-0003-000000000005', is_personal: false, is_transfer: true, confidence: 0.95 },
  { pattern: 'payment thank you', match: 'contains', category_id: '00000000-0000-0000-0003-000000000005', is_personal: false, is_transfer: true, confidence: 0.95 },

  // === PERSONAL (from CC statements) ===
  { pattern: 'in-n-out', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'chipotle', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'starbucks', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'sweet creams', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'cajun kitchen', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'rusty', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'panino', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'santa barbara chic', match: 'contains', category_id: '00000000-0000-0000-0004-000000000005', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'trader joe', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'best buy', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.75 },
  { pattern: 'lemos feed', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.75 },
  { pattern: 'shell oil', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.80 },
];

export function categorizeByRules(
  transactions: ParsedTransaction[],
  customRules?: CategorizationRule[]
): CategorizedTransaction[] {
  return transactions.map(tx => {
    const descLower = tx.description.toLowerCase();
    
    // Check custom (user) rules first
    if (customRules) {
      for (const rule of customRules.sort((a, b) => b.priority - a.priority)) {
        if (matchesRule(descLower, rule.pattern.toLowerCase(), rule.match_type)) {
          return {
            ...tx,
            category_id: rule.category_id,
            schedule_c_line: null,
            is_personal: rule.is_personal,
            is_transfer: rule.is_transfer,
            confidence: 0.90,
            categorized_by: 'rule' as const,
          };
        }
      }
    }
    
    // Check built-in rules
    for (const rule of BUILT_IN_RULES) {
      if (matchesRule(descLower, rule.pattern, rule.match)) {
        return {
          ...tx,
          category_id: rule.category_id,
          schedule_c_line: null,
          is_personal: rule.is_personal,
          is_transfer: rule.is_transfer,
          confidence: rule.confidence,
          categorized_by: 'rule' as const,
        };
      }
    }
    
    // No match
    return {
      ...tx,
      category_id: null,
      schedule_c_line: null,
      is_personal: false,
      is_transfer: false,
      confidence: 0,
      categorized_by: null,
    };
  });
}

function matchesRule(description: string, pattern: string, matchType: string): boolean {
  switch (matchType) {
    case 'contains': return description.includes(pattern);
    case 'starts_with': return description.startsWith(pattern);
    case 'exact': return description === pattern;
    case 'regex':
      try { return new RegExp(pattern, 'i').test(description); } 
      catch { return false; }
    default: return description.includes(pattern);
  }
}

export function getUncategorizedTransactions(
  transactions: CategorizedTransaction[]
): CategorizedTransaction[] {
  return transactions.filter(tx => tx.category_id === null);
}
