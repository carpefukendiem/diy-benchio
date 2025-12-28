"""
Main orchestrator for DIY Accounting System
Run this script monthly to update your financial reports
"""

import os
import sys
from datetime import datetime, timedelta
from plaid_client import PlaidClient, get_mock_transactions
from categorizer import TransactionCategorizer
from report_generator import ReportGenerator
from config import START_DATE, END_DATE, BUSINESS_NAME

def main():
    print(f"=== DIY Accounting System for {BUSINESS_NAME} ===")
    print(f"Processing transactions from {START_DATE.strftime('%Y-%m-%d')} to {END_DATE.strftime('%Y-%m-%d')}")
    print()
    
    # Initialize components
    plaid_client = PlaidClient()
    categorizer = TransactionCategorizer()
    report_generator = ReportGenerator()
    
    # Step 1: Fetch transactions
    print("Step 1: Fetching transactions...")
    
    # For demo purposes, we'll use mock transactions
    # In production, you would use:
    # access_tokens = ['your_access_token_1', 'your_access_token_2']  # From Plaid Link
    # transactions = plaid_client.get_all_transactions_for_accounts(access_tokens, START_DATE, END_DATE)
    
    transactions = get_mock_transactions()
    print(f"Fetched {len(transactions)} transactions")
    
    # Step 2: Categorize transactions
    print("\nStep 2: Categorizing transactions...")
    categorized_transactions = categorizer.categorize_transactions(transactions)
    
    # Show categorization summary
    category_totals = categorizer.get_category_totals(categorized_transactions)
    print("\nCategorization Summary:")
    for category, total in category_totals.items():
        print(f"  {category}: ${total:,.2f}")
    
    # Show uncategorized transactions
    uncategorized = categorizer.get_uncategorized_transactions(categorized_transactions)
    if uncategorized:
        print(f"\n⚠️  {len(uncategorized)} transactions need manual review:")
        for transaction in uncategorized[:5]:  # Show first 5
            print(f"  - {transaction['date']}: {transaction['description']} (${transaction['amount']:.2f})")
        if len(uncategorized) > 5:
            print(f"  ... and {len(uncategorized) - 5} more")
    
    # Step 3: Generate reports
    print("\nStep 3: Generating financial reports...")
    
    # Mock account balances (in production, fetch from Plaid)
    account_balances = {
        'wells_fargo_checking': 354.22,
        'wells_fargo_savings': 29.12,
        'stripe_account': 498.81,
        'barclaycard_credit': 3999.71,
        'stripe_capital': 6021.40
    }
    
    try:
        report_generator.generate_all_reports(categorized_transactions, account_balances)
        print("\n✅ All reports generated successfully!")
        
        if report_generator.workbook:
            print(f"📊 View your reports: {report_generator.workbook.url}")
        
    except Exception as e:
        print(f"\n❌ Error generating reports: {e}")
        print("Make sure you have:")
        print("1. Created Google Sheets API credentials (credentials.json)")
        print("2. Shared the spreadsheet with your service account email")
        return
    
    # Step 4: Summary
    print(f"\n=== Summary ===")
    print(f"Transactions processed: {len(categorized_transactions)}")
    print(f"Categories used: {len(category_totals)}")
    print(f"Needs review: {len(uncategorized)}")
    
    # Calculate key metrics
    total_revenue = sum(total for category, total in category_totals.items() 
                       if 'Revenue' in category or 'Income' in category)
    total_expenses = sum(total for category, total in category_totals.items() 
                        if 'Expense' in category or 'Cost' in category)
    net_income = total_revenue - total_expenses
    
    print(f"\nKey Metrics:")
    print(f"  Total Revenue: ${total_revenue:,.2f}")
    print(f"  Total Expenses: ${total_expenses:,.2f}")
    print(f"  Net Income: ${net_income:,.2f}")
    
    print(f"\n💰 Annual Savings vs Bench.io: $3,450+ per year!")
    print("\nNext steps:")
    print("1. Review uncategorized transactions")
    print("2. Update categorization rules if needed")
    print("3. Check the generated reports for accuracy")
    print("4. Run monthly for best results")

if __name__ == "__main__":
    main()
