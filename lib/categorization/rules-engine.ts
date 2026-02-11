/**
 * Rule-Based Categorization Engine
 * 
 * First pass: matches transactions against known patterns.
 * Handles ~85-95% of transactions automatically.
 * Updated with user feedback from transaction review.
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
// Category ID mapping:
// 0001-x = Income     0002-x = Business Expense     0003-x = Transfer     0004-x = Personal
const BUILT_IN_RULES: Array<{
  pattern: string;
  match: 'contains' | 'starts_with';
  category_id: string;
  is_personal: boolean;
  is_transfer: boolean;
  confidence: number;
}> = [
  // ============================
  // INCOME (0001)
  // ============================
  { pattern: 'stripe transfer', match: 'contains', category_id: '00000000-0000-0000-0001-000000000001', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'stripe payout', match: 'contains', category_id: '00000000-0000-0000-0001-000000000001', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'upwork escrow', match: 'contains', category_id: '00000000-0000-0000-0001-000000000004', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'upwork', match: 'contains', category_id: '00000000-0000-0000-0001-000000000004', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'freelancer', match: 'contains', category_id: '00000000-0000-0000-0001-000000000004', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'fiverr', match: 'contains', category_id: '00000000-0000-0000-0001-000000000004', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'purchase return', match: 'contains', category_id: '00000000-0000-0000-0001-000000000002', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'interest payment', match: 'contains', category_id: '00000000-0000-0000-0001-000000000003', is_personal: false, is_transfer: false, confidence: 0.85 },

  // ============================
  // SOFTWARE & WEB HOSTING (0002-22) — Schedule C Line 18
  // ============================
  { pattern: 'ghl', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'highlevel', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'go high level', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'semrush', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'ahrefs', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'surfer seo', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'google *gsuite', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'google workspace', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'google *cloud', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'apple.com', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'apple.com/bill', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'siteground', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: '2cocom*bitdefender', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'bitdefender', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'adobe', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'canva', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'namecheap', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'godaddy', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'cloudflare', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'hostinger', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'squarespace', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'zoom', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'slack', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'dropbox', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'chatgpt', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'openai', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'anthropic', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'microsoft', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'mailchimp', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },

  // ============================
  // ADVERTISING & MARKETING (0002-01) — Schedule C Line 8
  // ============================
  { pattern: 'google ads', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'facebook ads', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'facebk', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'meta ads', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'vistaprint', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'moo.com', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'yelp', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.85 },

  // ============================
  // SOCCER TEAM SPONSORSHIP (0002-30) — Schedule C Line 8 (Advertising)
  // ============================
  { pattern: 'aggressive socc', match: 'contains', category_id: '00000000-0000-0000-0002-000000000030', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'affirm inc affirm pay', match: 'contains', category_id: '00000000-0000-0000-0002-000000000030', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'soccer', match: 'contains', category_id: '00000000-0000-0000-0002-000000000030', is_personal: false, is_transfer: false, confidence: 0.80 },

  // ============================
  // GAS & AUTO (0002-03) — Schedule C Line 9
  // ============================
  { pattern: 'shell oil', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'chevron', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'arco', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'costco gas', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'exxon', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: '76 station', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'oil change', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'jiffy lube', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'uber', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'lyft', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'ptgc llc', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'mccormix oil', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'mccormick oil', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.90 },

  // ============================
  // PARKING EXPENSE (0002-32) — Schedule C Line 9 (Car and truck)
  // ============================
  { pattern: 'city of sb dtp', match: 'contains', category_id: '00000000-0000-0000-0002-000000000032', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'wf pkg', match: 'contains', category_id: '00000000-0000-0000-0002-000000000032', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'parking', match: 'contains', category_id: '00000000-0000-0000-0002-000000000032', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'hotel californian', match: 'contains', category_id: '00000000-0000-0000-0002-000000000032', is_personal: false, is_transfer: false, confidence: 0.80 },

  // ============================
  // BUSINESS MEALS (0002-19) — Schedule C Line 24b (50% deductible)
  // ============================
  { pattern: 'cajun kitchen', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'dart coffee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'sweet creams', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'starbucks', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'lighthouse cof', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'thedailygrind', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: "mony's", match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'taqueria lilly', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'panino', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'habit', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'south coast deli', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'dlr coffee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'cheesecake', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'dlr pym testkitche', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'napolini', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'nikka japanese', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: "eller's donut", match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: "mcconnell's", match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: "shalhoob", match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'tst*benchmark', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'tst*sama sama', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'stdaa-ventura', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'wingstop', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'little caesars', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'chipotle', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'in-n-out', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'pressed juicery', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.85 },

  // ============================
  // OFFICE SUPPLIES (0002-13) — Schedule C Line 18
  // ============================
  { pattern: 'powell peralta', match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'staples', match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'office depot', match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: "miner's ace", match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'michaels stores', match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'sp powertoolsadapt', match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'office bookshelf', match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.90 },

  // ============================
  // OFFICE KITCHEN SUPPLIES (0002-31) — Schedule C Line 18
  // ============================
  { pattern: 'ralphs', match: 'contains', category_id: '00000000-0000-0000-0002-000000000031', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'trader joe', match: 'contains', category_id: '00000000-0000-0000-0002-000000000031', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'beverages & mor', match: 'contains', category_id: '00000000-0000-0000-0002-000000000031', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'dollartree', match: 'contains', category_id: '00000000-0000-0000-0002-000000000031', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'costco whse', match: 'contains', category_id: '00000000-0000-0000-0002-000000000031', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'smart & final', match: 'contains', category_id: '00000000-0000-0000-0002-000000000031', is_personal: false, is_transfer: false, confidence: 0.75 },

  // ============================
  // EYE CARE — BUSINESS EXPENSE (0002-35) — Schedule C Line 27a
  // Computer workers need eye drops/care as ordinary & necessary expense
  // ============================
  { pattern: 'bream optometry', match: 'contains', category_id: '00000000-0000-0000-0002-000000000035', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'cvs/pharm', match: 'contains', category_id: '00000000-0000-0000-0002-000000000035', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'cvs/pharmacy', match: 'contains', category_id: '00000000-0000-0000-0002-000000000035', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'rite aid', match: 'contains', category_id: '00000000-0000-0000-0002-000000000035', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'milpas liquor', match: 'contains', category_id: '00000000-0000-0000-0002-000000000035', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'liquor & deli santa', match: 'contains', category_id: '00000000-0000-0000-0002-000000000035', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: "talevi's wines", match: 'contains', category_id: '00000000-0000-0000-0002-000000000035', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'walgreens', match: 'contains', category_id: '00000000-0000-0000-0002-000000000035', is_personal: false, is_transfer: false, confidence: 0.75 },

  // ============================
  // CLIENT GIFTS (0002-33) — Schedule C Line 27a ($25/person/year limit)
  // ============================
  { pattern: 'market l', match: 'contains', category_id: '00000000-0000-0000-0002-000000000033', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'rocket fizz', match: 'contains', category_id: '00000000-0000-0000-0002-000000000033', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'dlr off the page', match: 'contains', category_id: '00000000-0000-0000-0002-000000000033', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'dlr studio store', match: 'contains', category_id: '00000000-0000-0000-0002-000000000033', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'dlr seaside souven', match: 'contains', category_id: '00000000-0000-0000-0002-000000000033', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'sq *dandy souvenir', match: 'contains', category_id: '00000000-0000-0000-0002-000000000033', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'pet house', match: 'contains', category_id: '00000000-0000-0000-0002-000000000033', is_personal: false, is_transfer: false, confidence: 0.80 },

  // ============================
  // TRAVEL EXPENSE (0002-34) — Schedule C Line 24a
  // ============================
  { pattern: 'dlr wdtc package', match: 'contains', category_id: '00000000-0000-0000-0002-000000000034', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'hotel', match: 'contains', category_id: '00000000-0000-0000-0002-000000000034', is_personal: false, is_transfer: false, confidence: 0.70 },
  { pattern: 'marriott', match: 'contains', category_id: '00000000-0000-0000-0002-000000000034', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'hilton', match: 'contains', category_id: '00000000-0000-0000-0002-000000000034', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'airbnb', match: 'contains', category_id: '00000000-0000-0000-0002-000000000034', is_personal: false, is_transfer: false, confidence: 0.75 },

  // ============================
  // HEALTH INSURANCE (0002-36) — Schedule C Line 15 or 1040 Adj
  // ============================
  { pattern: 'health insurance', match: 'contains', category_id: '00000000-0000-0000-0002-000000000036', is_personal: false, is_transfer: false, confidence: 0.95 },

  // ============================
  // EDUCATION & TRAINING (0002-23) — Schedule C Line 27a
  // ============================
  { pattern: 'acquisitio', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'udemy', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'coursera', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'skillshare', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.90 },

  // ============================
  // HOME OFFICE EXPENSE (0002-26) — Schedule C Line 30
  // ============================
  { pattern: 'home depot', match: 'contains', category_id: '00000000-0000-0000-0002-000000000026', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'lowes', match: 'contains', category_id: '00000000-0000-0000-0002-000000000026', is_personal: false, is_transfer: false, confidence: 0.75 },

  // ============================
  // PHONE & INTERNET (0002-21) — Schedule C Line 25
  // ============================
  { pattern: 'verizon', match: 'contains', category_id: '00000000-0000-0000-0002-000000000021', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'spectrum', match: 'contains', category_id: '00000000-0000-0000-0002-000000000021', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'comcast', match: 'contains', category_id: '00000000-0000-0000-0002-000000000021', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'cox comm', match: 'contains', category_id: '00000000-0000-0000-0002-000000000021', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'at&t', match: 'contains', category_id: '00000000-0000-0000-0002-000000000021', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 't-mobile', match: 'contains', category_id: '00000000-0000-0000-0002-000000000021', is_personal: false, is_transfer: false, confidence: 0.80 },

  // ============================
  // UTILITIES (0002-20) — Schedule C Line 25
  // ============================
  { pattern: 'so cal gas', match: 'contains', category_id: '00000000-0000-0000-0002-000000000020', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'socal gas', match: 'contains', category_id: '00000000-0000-0000-0002-000000000020', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'edison', match: 'contains', category_id: '00000000-0000-0000-0002-000000000020', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'pg&e', match: 'contains', category_id: '00000000-0000-0000-0002-000000000020', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'water', match: 'contains', category_id: '00000000-0000-0000-0002-000000000020', is_personal: false, is_transfer: false, confidence: 0.65 },

  // ============================
  // BANK & ATM FEES (0002-10) — Schedule C Line 16b
  // ============================
  { pattern: 'monthly service fee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'overdraft', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'service charge', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'late fee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'late payment fee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'purchase interest charge', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'interest charge', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'annual fee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.90 },

  // ============================
  // INSURANCE (0002-08) — Schedule C Line 15
  // ============================
  { pattern: 'geico', match: 'contains', category_id: '00000000-0000-0000-0002-000000000008', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'state farm', match: 'contains', category_id: '00000000-0000-0000-0002-000000000008', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'progressive', match: 'contains', category_id: '00000000-0000-0000-0002-000000000008', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'allstate', match: 'contains', category_id: '00000000-0000-0000-0002-000000000008', is_personal: false, is_transfer: false, confidence: 0.85 },

  // ============================
  // MERCHANT PROCESSING FEES (0002-05) — Schedule C Line 10
  // ============================
  { pattern: 'stripe fee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000005', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'square fee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000005', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'paypal fee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000005', is_personal: false, is_transfer: false, confidence: 0.90 },

  // ============================
  // TRANSFERS (0003) — NOT on Schedule C
  // ============================
  { pattern: 'online transfer', match: 'contains', category_id: '00000000-0000-0000-0003-000000000001', is_personal: false, is_transfer: true, confidence: 0.90 },
  { pattern: 'transfer to', match: 'contains', category_id: '00000000-0000-0000-0003-000000000001', is_personal: false, is_transfer: true, confidence: 0.85 },
  { pattern: 'transfer from', match: 'contains', category_id: '00000000-0000-0000-0003-000000000002', is_personal: false, is_transfer: true, confidence: 0.85 },
  { pattern: 'chase crd epay', match: 'contains', category_id: '00000000-0000-0000-0003-000000000005', is_personal: false, is_transfer: true, confidence: 0.95 },
  { pattern: 'chase credit', match: 'contains', category_id: '00000000-0000-0000-0003-000000000005', is_personal: false, is_transfer: true, confidence: 0.90 },
  { pattern: 'barclays', match: 'contains', category_id: '00000000-0000-0000-0003-000000000005', is_personal: false, is_transfer: true, confidence: 0.85 },
  { pattern: 'payment received wells fargo', match: 'contains', category_id: '00000000-0000-0000-0003-000000000005', is_personal: false, is_transfer: true, confidence: 0.95 },
  { pattern: 'zelle', match: 'contains', category_id: '00000000-0000-0000-0004-000000000008', is_personal: false, is_transfer: true, confidence: 0.80 },
  { pattern: 'venmo', match: 'contains', category_id: '00000000-0000-0000-0004-000000000008', is_personal: false, is_transfer: true, confidence: 0.80 },
  { pattern: 'cash app', match: 'contains', category_id: '00000000-0000-0000-0004-000000000008', is_personal: false, is_transfer: true, confidence: 0.80 },
  
  // ATM — all ATM transactions = Owner Draw
  { pattern: 'atm withdrawal', match: 'contains', category_id: '00000000-0000-0000-0003-000000000006', is_personal: false, is_transfer: true, confidence: 0.95 },
  { pattern: 'atm cash deposit', match: 'contains', category_id: '00000000-0000-0000-0003-000000000002', is_personal: false, is_transfer: true, confidence: 0.90 },
  { pattern: 'atm w/d', match: 'contains', category_id: '00000000-0000-0000-0003-000000000006', is_personal: false, is_transfer: true, confidence: 0.95 },
  { pattern: 'atm ', match: 'contains', category_id: '00000000-0000-0000-0003-000000000006', is_personal: false, is_transfer: true, confidence: 0.80 },

  // Brokerage
  { pattern: 'schwab brokerage', match: 'contains', category_id: '00000000-0000-0000-0003-000000000007', is_personal: false, is_transfer: true, confidence: 0.90 },
  { pattern: 'schwab moneylink', match: 'contains', category_id: '00000000-0000-0000-0003-000000000007', is_personal: false, is_transfer: true, confidence: 0.90 },

  // Business Treasury Investment (crypto held for business)
  { pattern: 'kraken', match: 'contains', category_id: '00000000-0000-0000-0002-000000000038', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'coinbase', match: 'contains', category_id: '00000000-0000-0000-0002-000000000038', is_personal: false, is_transfer: false, confidence: 0.85 },

  // ============================
  // OWNER DRAW (0003-06) — NOT on Schedule C
  // ============================
  { pattern: 'thrivecaus', match: 'contains', category_id: '00000000-0000-0000-0003-000000000006', is_personal: false, is_transfer: true, confidence: 0.85 },
  { pattern: 'nikepos', match: 'contains', category_id: '00000000-0000-0000-0003-000000000006', is_personal: false, is_transfer: true, confidence: 0.85 },
  { pattern: "tilly's", match: 'contains', category_id: '00000000-0000-0000-0003-000000000006', is_personal: false, is_transfer: true, confidence: 0.85 },
  { pattern: 'tillys', match: 'contains', category_id: '00000000-0000-0000-0003-000000000006', is_personal: false, is_transfer: true, confidence: 0.85 },
  { pattern: 'jewelry couture', match: 'contains', category_id: '00000000-0000-0000-0003-000000000006', is_personal: false, is_transfer: true, confidence: 0.90 },
  { pattern: 'cuts', match: 'contains', category_id: '00000000-0000-0000-0003-000000000006', is_personal: false, is_transfer: true, confidence: 0.75 },

  // ============================
  // PERSONAL ENTERTAINMENT (0004-03)
  // ============================
  { pattern: 'netflix', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'spotify', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'hulu', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'disney plus', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'camino real cinema', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'fairview twin', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },

  // ============================
  // PERSONAL SHOPPING (0004-04)
  // ============================
  { pattern: 'amazon', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.65 },
  { pattern: 'target', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.70 },
  { pattern: 'walmart', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.70 },
  { pattern: 'best buy', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.75 },
  { pattern: 'ross stores', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'billabong', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'blenders', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.80 },

  // ============================
  // PERSONAL — MISC
  // ============================
  { pattern: 'tradingview', match: 'contains', category_id: '00000000-0000-0000-0004-000000000009', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'paypal', match: 'contains', category_id: '00000000-0000-0000-0004-000000000008', is_personal: false, is_transfer: true, confidence: 0.70 },
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
