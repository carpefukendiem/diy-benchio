import { NextRequest, NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';
import { parseWellsFargoStatement } from '@/lib/parsers/wellsfargo-pdf';
import { parseCSVStatement } from '@/lib/parsers/csv-parser';
import { categorizeByRules } from '@/lib/categorization/rules-engine';
import { categorizeWithAI } from '@/lib/categorization/ai-engine';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const businessId = formData.get('business_id') as string;
    const accountId = formData.get('account_id') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    let parsedTransactions;

    if (fileName.endsWith('.pdf')) {
      // Parse PDF
      const pdfData = await pdfParse(buffer);
      const result = parseWellsFargoStatement(pdfData.text);
      parsedTransactions = result.transactions;
    } else if (fileName.endsWith('.csv')) {
      // Parse CSV
      const csvText = buffer.toString('utf-8');
      const result = parseCSVStatement(csvText);
      parsedTransactions = result.transactions;
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF or CSV files.' },
        { status: 400 }
      );
    }

    // Step 1: Rule-based categorization
    const categorized = categorizeByRules(parsedTransactions);

    // Step 2: AI categorization for unknowns
    const uncategorized = categorized.filter(tx => !tx.category_id);
    
    let finalTransactions = categorized;
    if (uncategorized.length > 0 && process.env.ANTHROPIC_API_KEY) {
      // Fetch categories from DB (simplified — in production, query Supabase)
      const categories = [
        { id: '00000000-0000-0000-0002-000000000019', name: 'Business Meals', type: 'expense', schedule_c_line: 'line_24b' },
        { id: '00000000-0000-0000-0004-000000000005', name: 'Personal - Food & Drink', type: 'personal', schedule_c_line: null },
        { id: '00000000-0000-0000-0004-000000000004', name: 'Personal - Shopping', type: 'personal', schedule_c_line: null },
        { id: '00000000-0000-0000-0004-000000000001', name: 'Personal Expense', type: 'personal', schedule_c_line: null },
        { id: '00000000-0000-0000-0002-000000000022', name: 'Software & Subscriptions', type: 'expense', schedule_c_line: 'line_27a' },
        { id: '00000000-0000-0000-0002-000000000001', name: 'Advertising & Marketing', type: 'expense', schedule_c_line: 'line_8' },
      ];
      
      const aiCategorized = await categorizeWithAI(uncategorized, categories);
      
      // Merge AI results back
      const aiMap = new Map(aiCategorized.map(tx => [tx.raw_line, tx]));
      finalTransactions = categorized.map(tx => {
        if (!tx.category_id && aiMap.has(tx.raw_line)) {
          return aiMap.get(tx.raw_line)!;
        }
        return tx;
      });
    }

    // TODO: Save to Supabase
    // const { data, error } = await supabase.from('transactions').insert(...)

    return NextResponse.json({
      success: true,
      filename: file.name,
      total_transactions: finalTransactions.length,
      categorized: finalTransactions.filter(t => t.category_id).length,
      uncategorized: finalTransactions.filter(t => !t.category_id).length,
      transactions: finalTransactions.slice(0, 10), // Preview first 10
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process file' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
