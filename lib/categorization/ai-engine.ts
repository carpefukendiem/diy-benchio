/**
 * AI Categorization Engine using Anthropic Claude
 * 
 * Handles transactions that the rule engine couldn't categorize.
 * Sends batches of uncategorized transactions to Claude with
 * context about the business type and available categories.
 */

import Anthropic from '@anthropic-ai/sdk';
import { CategorizedTransaction } from './rules-engine';

const BATCH_SIZE = 25; // Process 25 transactions per API call

interface AICategorization {
  transaction_index: number;
  category_id: string;
  is_personal: boolean;
  is_transfer: boolean;
  confidence: number;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an expert bookkeeper specializing in small business tax preparation for California businesses. You categorize bank transactions for Schedule C (Form 1040) tax filing.

BUSINESSES:
1. "Ranking SB" (CARPEFUKENDIEM, LLC) — Digital marketing agency specializing in GoHighLevel. Revenue comes through Stripe (client payments) and Upwork (freelance). Owner: Ruben Ruiz.
2. Wife's hair styling business — Self-employed hair stylist. Owner: Janice Nail-Ruiz.

IMPORTANT RULES:
- Transfers between the owner's own accounts are NOT expenses or income — mark as transfers
- Zelle payments to "Ruiz Janice" are usually owner draws or family transfers
- Food/restaurant purchases from the business account are ambiguous — mark as business meals ONLY if the amount and context suggest a client meeting (generally >$30, at a sit-down restaurant)
- Fast food, coffee shops, convenience stores from the business account are likely personal
- Software/SaaS subscriptions paid from the business account are business expenses
- ATM withdrawals are personal
- Distinguish between the GoHighLevel agency subscription (~$497/mo) and GoHighLevel reseller charges (~$25/mo) — both are business software
- Health insurance payments (Zelle to Janice marked "Health Insurance") are deductible on Schedule 1, not Schedule C, but track them
- Coinbase/crypto transactions are personal investments, not business

Respond ONLY with a JSON array. Each element must have:
- transaction_index: number (index in the input array)
- category_id: string (from the provided category list)
- is_personal: boolean
- is_transfer: boolean  
- confidence: number (0.0 to 1.0)
- reasoning: string (brief explanation)`;

export async function categorizeWithAI(
  transactions: CategorizedTransaction[],
  categories: Array<{ id: string; name: string; type: string; schedule_c_line: string | null }>,
): Promise<CategorizedTransaction[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY not set — skipping AI categorization');
    return transactions;
  }

  const client = new Anthropic({ apiKey });
  const results = [...transactions];
  
  // Process in batches
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    
    const txList = batch.map((tx, idx) => ({
      index: i + idx,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
    }));

    const categoryList = categories.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      schedule_c_line: c.schedule_c_line,
    }));

    const userMessage = `Categorize these transactions. Available categories:
${JSON.stringify(categoryList, null, 2)}

Transactions to categorize:
${JSON.stringify(txList, null, 2)}

Respond with ONLY a JSON array of categorizations.`;

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as { type: 'text'; text: string }).text)
        .join('');

      // Parse JSON response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const categorizations: AICategorization[] = JSON.parse(jsonMatch[0]);
        
        for (const cat of categorizations) {
          const idx = cat.transaction_index;
          if (idx >= 0 && idx < results.length) {
            results[idx] = {
              ...results[idx],
              category_id: cat.category_id,
              is_personal: cat.is_personal,
              is_transfer: cat.is_transfer,
              confidence: cat.confidence,
              categorized_by: 'ai',
              notes: cat.reasoning,
            };
          }
        }
      }
    } catch (error) {
      console.error('AI categorization error:', error);
      // Continue with uncategorized transactions rather than failing
    }
  }

  return results;
}
