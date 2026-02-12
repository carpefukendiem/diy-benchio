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

// ============================
// Category ID → Human-readable name map (shared between server & client)
// ============================
export const CATEGORY_ID_TO_NAME: Record<string, { name: string; isIncome: boolean }> = {
  "00000000-0000-0000-0001-000000000001": { name: "Sales Revenue", isIncome: true },
  "00000000-0000-0000-0001-000000000002": { name: "Refunds Given", isIncome: true },
  "00000000-0000-0000-0001-000000000003": { name: "Other Income", isIncome: true },
  "00000000-0000-0000-0001-000000000004": { name: "Freelance Income", isIncome: true },
  "00000000-0000-0000-0002-000000000001": { name: "Advertising & Marketing", isIncome: false },
  "00000000-0000-0000-0002-000000000002": { name: "Social Media & Online Presence", isIncome: false },
  "00000000-0000-0000-0002-000000000003": { name: "Gas & Auto Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000005": { name: "Merchant Processing Fees", isIncome: false },
  "00000000-0000-0000-0002-000000000008": { name: "Insurance Expense - Business", isIncome: false },
  "00000000-0000-0000-0002-000000000010": { name: "Bank & ATM Fee Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000011": { name: "Professional Service Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000012": { name: "Tax Software & Services", isIncome: false },
  "00000000-0000-0000-0002-000000000013": { name: "Office Supplies", isIncome: false },
  "00000000-0000-0000-0002-000000000019": { name: "Business Meals Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000020": { name: "Utilities Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000021": { name: "Phone & Internet Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000022": { name: "Software & Web Hosting Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000023": { name: "Education & Training", isIncome: false },
  "00000000-0000-0000-0002-000000000025": { name: "Utilities Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000026": { name: "Home Office Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000030": { name: "Soccer Team Sponsorship", isIncome: false },
  "00000000-0000-0000-0002-000000000031": { name: "Office Kitchen Supplies", isIncome: false },
  "00000000-0000-0000-0002-000000000032": { name: "Parking Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000033": { name: "Client Gifts", isIncome: false },
  "00000000-0000-0000-0002-000000000034": { name: "Travel Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000035": { name: "Eye Care - Business Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000036": { name: "Health Insurance", isIncome: false },
  "00000000-0000-0000-0002-000000000037": { name: "Rent Expense", isIncome: false },
  "00000000-0000-0000-0002-000000000038": { name: "Business Treasury Investment", isIncome: false },
  "00000000-0000-0000-0003-000000000001": { name: "Member Drawing - Ruben Ruiz", isIncome: false },
  "00000000-0000-0000-0003-000000000002": { name: "Member Contribution - Ruben Ruiz", isIncome: true },
  "00000000-0000-0000-0003-000000000003": { name: "Internal Transfer", isIncome: false },
  "00000000-0000-0000-0003-000000000005": { name: "Credit Card Payment", isIncome: false },
  "00000000-0000-0000-0003-000000000006": { name: "Owner Draw", isIncome: false },
  "00000000-0000-0000-0003-000000000007": { name: "Brokerage Transfer", isIncome: false },
  "00000000-0000-0000-0004-000000000001": { name: "Personal Expense", isIncome: false },
  "00000000-0000-0000-0004-000000000002": { name: "Personal - Groceries", isIncome: false },
  "00000000-0000-0000-0004-000000000003": { name: "Personal - Entertainment", isIncome: false },
  "00000000-0000-0000-0004-000000000004": { name: "Personal - Shopping", isIncome: false },
  "00000000-0000-0000-0004-000000000005": { name: "Personal - Food & Drink", isIncome: false },
  "00000000-0000-0000-0004-000000000006": { name: "Personal - Health", isIncome: false },
  "00000000-0000-0000-0004-000000000007": { name: "Owner Draw", isIncome: false },
  "00000000-0000-0000-0004-000000000008": { name: "Zelle / Venmo Transfer", isIncome: false },
  "00000000-0000-0000-0004-000000000009": { name: "Crypto / Investments", isIncome: false },
};

// Built-in rules for Ranking SB business account
// Category ID mapping:
// 0001-x = Income     0002-x = Business Expense     0003-x = Transfer     0004-x = Personal
export const BUILT_IN_RULES: Array<{
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
  { pattern: 'google *gsuite_ran', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'google *gsuite', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'google workspace', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'google *cloud', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'apple.com', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'apple.com/bill', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'siteground', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: '2cocom*bitdefender', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: '2cocom', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.80 },
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
  { pattern: 'affirm inc affirm', match: 'contains', category_id: '00000000-0000-0000-0002-000000000030', is_personal: false, is_transfer: false, confidence: 0.80 },
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
  { pattern: 'ptgc', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.85 },
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
  { pattern: 'habit la cumbre', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.90 },
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
  { pattern: 'dlr wdtc', match: 'contains', category_id: '00000000-0000-0000-0002-000000000034', is_personal: false, is_transfer: false, confidence: 0.85 },
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
  { pattern: 'overdraft protection', match: 'contains', category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.95 },
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
  // MORE BUSINESS MEALS (0002-19) — catch common restaurant patterns
  // ============================
  { pattern: 'taco bell', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: "mcdonald", match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: "wendy's", match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'subway', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'burger king', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'jack in the box', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'panda express', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: "domino's", match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'pizza hut', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'doordash', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'grubhub', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'uber eats', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'postmates', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'del taco', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'popeyes', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'chick-fil-a', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'kfc', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'five guys', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: "denny's", match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'ihop', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'el pollo loco', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'tst*', match: 'starts_with', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'sq *', match: 'starts_with', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.70 },
  { pattern: 'restaurant', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'cafe', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.70 },
  { pattern: 'coffee', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.70 },
  { pattern: 'pizza', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.70 },
  { pattern: 'grill', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.65 },
  { pattern: 'bakery', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.70 },
  { pattern: 'sushi', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'thai', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.65 },
  { pattern: 'bbq', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.70 },
  { pattern: 'diner', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.70 },
  { pattern: 'burrito', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'taqueria', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'brew', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.65 },
  { pattern: 'kitchen', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.60 },
  { pattern: 'tavern', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.65 },
  { pattern: 'eatery', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.70 },
  { pattern: 'bistro', match: 'contains', category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.70 },

  // ============================
  // MORE SOFTWARE (0002-22) — catch common SaaS / tech patterns
  // ============================
  { pattern: 'notion', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'figma', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'github', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'vercel', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'netlify', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'aws', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'heroku', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'digital ocean', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'digitalocean', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'hubspot', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'freshbooks', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'quickbooks', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'xero', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'calendly', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'loom', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'zapier', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'grammarly', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'asana', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'trello', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'monday.com', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'wix', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'wordpress', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'shopify', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'convertkit', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'active campaign', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'sendgrid', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'twilio', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'clickfunnels', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'kajabi', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'teachable', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'thinkific', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'jasper', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'midjourney', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'cursor', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'replit', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: '1password', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'lastpass', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'nordvpn', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'expressvpn', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.85 },

  // ============================
  // MORE ADVERTISING (0002-01) — catch ad platform patterns
  // ============================
  { pattern: 'linkedin', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'tiktok ads', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'twitter ads', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'bing ads', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'nextdoor', match: 'contains', category_id: '00000000-0000-0000-0002-000000000001', is_personal: false, is_transfer: false, confidence: 0.80 },

  // ============================
  // MORE GAS STATIONS (0002-03)
  // ============================
  { pattern: 'mobil', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'valero', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'sinclair', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'marathon petro', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'bp#', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'sunoco', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'auto zone', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'autozone', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: "o'reilly", match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'car wash', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'smog', match: 'contains', category_id: '00000000-0000-0000-0002-000000000003', is_personal: false, is_transfer: false, confidence: 0.80 },

  // ============================
  // MORE PROFESSIONAL SERVICES (0002-11) — Schedule C Line 17
  // ============================
  { pattern: 'attorney', match: 'contains', category_id: '00000000-0000-0000-0002-000000000011', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'law office', match: 'contains', category_id: '00000000-0000-0000-0002-000000000011', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'legal', match: 'contains', category_id: '00000000-0000-0000-0002-000000000011', is_personal: false, is_transfer: false, confidence: 0.65 },
  { pattern: 'cpa', match: 'contains', category_id: '00000000-0000-0000-0002-000000000011', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'accountant', match: 'contains', category_id: '00000000-0000-0000-0002-000000000011', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'notary', match: 'contains', category_id: '00000000-0000-0000-0002-000000000011', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'consultant', match: 'contains', category_id: '00000000-0000-0000-0002-000000000011', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'legalzoom', match: 'contains', category_id: '00000000-0000-0000-0002-000000000011', is_personal: false, is_transfer: false, confidence: 0.90 },

  // ============================
  // TAX SERVICES (0002-12)
  // ============================
  { pattern: 'turbotax', match: 'contains', category_id: '00000000-0000-0000-0002-000000000012', is_personal: false, is_transfer: false, confidence: 0.95 },
  { pattern: 'h&r block', match: 'contains', category_id: '00000000-0000-0000-0002-000000000012', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'taxact', match: 'contains', category_id: '00000000-0000-0000-0002-000000000012', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'freetaxusa', match: 'contains', category_id: '00000000-0000-0000-0002-000000000012', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'irs gov', match: 'contains', category_id: '00000000-0000-0000-0002-000000000012', is_personal: false, is_transfer: false, confidence: 0.85 },

  // ============================
  // MORE EDUCATION (0002-23)
  // ============================
  { pattern: 'linkedin learning', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'masterclass', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'pluralsight', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.90 },
  { pattern: 'books', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.55 },
  { pattern: 'kindle', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.65 },
  { pattern: 'audible', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.65 },
  { pattern: 'workshop', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.70 },
  { pattern: 'seminar', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.75 },
  { pattern: 'conference', match: 'contains', category_id: '00000000-0000-0000-0002-000000000023', is_personal: false, is_transfer: false, confidence: 0.75 },

  // ============================
  // MORE OFFICE SUPPLIES (0002-13)
  // ============================
  { pattern: 'usps', match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'fedex', match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'ups store', match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'stamps.com', match: 'contains', category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.85 },

  // ============================
  // MORE INSURANCE (0002-08)
  // ============================
  { pattern: 'farmers ins', match: 'contains', category_id: '00000000-0000-0000-0002-000000000008', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'nationwide', match: 'contains', category_id: '00000000-0000-0000-0002-000000000008', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'liberty mutual', match: 'contains', category_id: '00000000-0000-0000-0002-000000000008', is_personal: false, is_transfer: false, confidence: 0.85 },
  { pattern: 'usaa', match: 'contains', category_id: '00000000-0000-0000-0002-000000000008', is_personal: false, is_transfer: false, confidence: 0.80 },
  { pattern: 'insurance', match: 'contains', category_id: '00000000-0000-0000-0002-000000000008', is_personal: false, is_transfer: false, confidence: 0.65 },

  // ============================
  // CREDIT CARD PAYMENTS (0003-05) — Not on Schedule C
  // ============================
  { pattern: 'payment thank you', match: 'contains', category_id: '00000000-0000-0000-0003-000000000005', is_personal: false, is_transfer: true, confidence: 0.90 },
  { pattern: 'automatic payment', match: 'contains', category_id: '00000000-0000-0000-0003-000000000005', is_personal: false, is_transfer: true, confidence: 0.85 },
  { pattern: 'autopay', match: 'contains', category_id: '00000000-0000-0000-0003-000000000005', is_personal: false, is_transfer: true, confidence: 0.85 },

  // ============================
  // PERSONAL ENTERTAINMENT (0004-03)
  // ============================
  { pattern: 'netflix', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'spotify', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'hulu', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'disney plus', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'camino real cinema', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'fairview twin', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'youtube premium', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'hbo max', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'paramount', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'peacock', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'apple tv', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'amc+', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'xbox', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'playstation', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'steam', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'cinema', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.75 },
  { pattern: 'theater', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.70 },
  { pattern: 'theatre', match: 'contains', category_id: '00000000-0000-0000-0004-000000000003', is_personal: true, is_transfer: false, confidence: 0.70 },

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
  { pattern: 'marshalls', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'tj maxx', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'nordstrom', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'macys', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: "macy's", match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'old navy', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'gap', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.65 },
  { pattern: 'h&m', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'ikea', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.75 },
  { pattern: 'bed bath', match: 'contains', category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.80 },

  // ============================
  // PERSONAL HEALTH (0004-06)
  // ============================
  { pattern: 'doctor', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.70 },
  { pattern: 'dental', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'dentist', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'medical', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.70 },
  { pattern: 'hospital', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'urgent care', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'pharmacy', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.75 },
  { pattern: 'gym', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.75 },
  { pattern: 'fitness', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.70 },
  { pattern: 'planet fitness', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.85 },
  { pattern: 'la fitness', match: 'contains', category_id: '00000000-0000-0000-0004-000000000006', is_personal: true, is_transfer: false, confidence: 0.85 },

  // ============================
  // PERSONAL GROCERIES (0004-02)
  // ============================
  { pattern: 'whole foods', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'safeway', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'vons', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'albertsons', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'kroger', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'sprouts', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'aldi', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'food 4 less', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: 'food4less', match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.80 },
  { pattern: "stater bros", match: 'contains', category_id: '00000000-0000-0000-0004-000000000002', is_personal: true, is_transfer: false, confidence: 0.80 },

  // ============================
  // PERSONAL — MISC
  // ============================
  { pattern: 'tradingview', match: 'contains', category_id: '00000000-0000-0000-0004-000000000009', is_personal: true, is_transfer: false, confidence: 0.90 },
  { pattern: 'paypal', match: 'contains', category_id: '00000000-0000-0000-0004-000000000008', is_personal: false, is_transfer: true, confidence: 0.70 },

  // ============================
  // CATCH-ALL HEURISTIC PATTERNS (last resort before uncategorized)
  // These use partial keywords to guess the most likely category
  // ============================
  { pattern: 'recurring payment', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.50 },
  { pattern: 'subscription', match: 'contains', category_id: '00000000-0000-0000-0002-000000000022', is_personal: false, is_transfer: false, confidence: 0.55 },
  { pattern: 'save as you go', match: 'contains', category_id: '00000000-0000-0000-0003-000000000001', is_personal: false, is_transfer: true, confidence: 0.80 },
  { pattern: 'recurring transfer', match: 'contains', category_id: '00000000-0000-0000-0003-000000000001', is_personal: false, is_transfer: true, confidence: 0.80 },
  { pattern: 'wire transfer', match: 'contains', category_id: '00000000-0000-0000-0003-000000000001', is_personal: false, is_transfer: true, confidence: 0.80 },
  { pattern: 'ach', match: 'contains', category_id: '00000000-0000-0000-0003-000000000001', is_personal: false, is_transfer: true, confidence: 0.55 },
  { pattern: 'direct deposit', match: 'contains', category_id: '00000000-0000-0000-0001-000000000003', is_personal: false, is_transfer: false, confidence: 0.60 },
  { pattern: 'deposit', match: 'contains', category_id: '00000000-0000-0000-0003-000000000002', is_personal: false, is_transfer: true, confidence: 0.50 },
];

// Smart fallback heuristic: if no exact rule matches, use description
// keywords + transaction characteristics to make a best guess rather
// than leaving it uncategorized.
export function smartFallback(tx: ParsedTransaction): {
  category_id: string;
  is_personal: boolean;
  is_transfer: boolean;
  confidence: number;
} | null {
  const desc = tx.description.toLowerCase();
  const amount = tx.amount;

  // Credits / deposits over $100 are likely income or transfers
  if (amount > 0) {
    if (desc.includes('payment') || desc.includes('credit') || desc.includes('refund')) {
      return { category_id: '00000000-0000-0000-0003-000000000005', is_personal: false, is_transfer: true, confidence: 0.45 };
    }
    // Larger credits are likely income
    if (amount > 500) {
      return { category_id: '00000000-0000-0000-0001-000000000003', is_personal: false, is_transfer: false, confidence: 0.40 };
    }
    // Smaller credits could be refunds
    return { category_id: '00000000-0000-0000-0001-000000000002', is_personal: false, is_transfer: false, confidence: 0.35 };
  }

  // Debits: try to guess based on common keywords in the description
  const absAmount = Math.abs(amount);

  // Small charges under $30 that look like food (short descriptions, city abbreviations)
  if (absAmount < 30 && desc.length < 40 && !desc.includes('transfer') && !desc.includes('fee')) {
    // Very short merchant names with a city — likely restaurant/shop
    const hasCityAbbr = /\b(ca|az|nv|tx|ny|fl|wa|or|co)\b/.test(desc);
    if (hasCityAbbr) {
      return { category_id: '00000000-0000-0000-0002-000000000019', is_personal: false, is_transfer: false, confidence: 0.40 };
    }
  }

  // Charges between $5-200 with "purchase authorized on" are card swipes — likely business expense
  if (desc.includes('purchase authorized on') || desc.includes('pos purchase') || desc.includes('pos debit')) {
    // It's a point-of-sale purchase; default to Office Supplies (safe generic business category)
    if (absAmount < 50) {
      return { category_id: '00000000-0000-0000-0002-000000000013', is_personal: false, is_transfer: false, confidence: 0.35 };
    }
    // Larger POS purchases → personal shopping as safer default
    return { category_id: '00000000-0000-0000-0004-000000000004', is_personal: true, is_transfer: false, confidence: 0.35 };
  }

  // Any "fee" or "charge" in description → Bank Fee
  if (desc.includes('fee') || desc.includes('charge') || desc.includes('penalty')) {
    return { category_id: '00000000-0000-0000-0002-000000000010', is_personal: false, is_transfer: false, confidence: 0.50 };
  }

  // DLR (Disneyland Resort) prefix → Client Gifts / Entertainment
  if (desc.includes('dlr ') || desc.includes('dlr*')) {
    return { category_id: '00000000-0000-0000-0002-000000000033', is_personal: false, is_transfer: false, confidence: 0.60 };
  }

  return null;
}

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
    
    // Smart fallback — try keyword heuristics before giving up
    const fallback = smartFallback(tx);
    if (fallback) {
      return {
        ...tx,
        category_id: fallback.category_id,
        schedule_c_line: null,
        is_personal: fallback.is_personal,
        is_transfer: fallback.is_transfer,
        confidence: fallback.confidence,
        categorized_by: 'rule' as const,
      };
    }
    
    // No match at all
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
