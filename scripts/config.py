"""
Configuration file for DIY Accounting System
Replace with your actual credentials
"""

import os
from datetime import datetime, timedelta

# Plaid Configuration
PLAID_CLIENT_ID = os.getenv('PLAID_CLIENT_ID', 'your_plaid_client_id')
PLAID_SECRET = os.getenv('PLAID_SECRET', 'your_plaid_secret')
PLAID_ENV = os.getenv('PLAID_ENV', 'sandbox')  # sandbox, development, or production

# Google Sheets Configuration
GOOGLE_SHEETS_CREDENTIALS_FILE = 'credentials.json'
SPREADSHEET_NAME = 'Ranking SB - Financial Package 2024'

# Business Information
BUSINESS_NAME = "Ranking SB"
OWNER_NAME = "Ruben Ruiz"

# Date Configuration
CURRENT_YEAR = 2024
START_DATE = datetime(CURRENT_YEAR, 1, 1)
END_DATE = datetime(CURRENT_YEAR, 12, 31)

# Account Mapping (Update with your actual account IDs from Plaid)
ACCOUNT_MAPPING = {
    'wells_fargo_checking': 'Wells Fargo - Checking - 9898',
    'wells_fargo_savings': 'Wells Fargo - Savings - 4174',
    'stripe_account': 'Stripe - Merchant Processor - Ruben Ruiz',
    'barclaycard_credit': 'Barclaycard - Credit Card - 2163',
    'stripe_capital': 'Stripe Capital - Loan Payable'
}

# Chart of Accounts
CHART_OF_ACCOUNTS = {
    # Assets
    'ASSETS': {
        'Wells Fargo - Checking - 9898': 'asset',
        'Wells Fargo - Savings - 4174': 'asset',
        'Stripe - Merchant Processor - Ruben Ruiz': 'asset',
        'Money in transit': 'asset',
        'Accounts Receivable': 'asset'
    },
    
    # Liabilities
    'LIABILITIES': {
        'Barclaycard - Credit Card - 2163': 'liability',
        'Stripe Capital - Loan Payable': 'liability',
        'Accounts Payable': 'liability'
    },
    
    # Equity
    'EQUITY': {
        'Member Contribution - Ruben Ruiz': 'equity',
        'Member Drawing - Ruben Ruiz': 'equity',
        'Retained Earnings': 'equity'
    },
    
    # Revenue
    'REVENUE': {
        'Sales Revenue': 'revenue',
        'Returns & Allowances': 'revenue',
        'Interest Income': 'revenue',
        'Other Income': 'revenue'
    },
    
    # Expenses
    'EXPENSES': {
        'Cost of Service': 'expense',
        'Software & Web Hosting Expense': 'expense',
        'Business Meals Expense': 'expense',
        'Gas & Auto Expense': 'expense',
        'Bank & ATM Fee Expense': 'expense',
        'Insurance Expense - Auto': 'expense',
        'Insurance Expense - Business': 'expense',
        'Merchant Fees Expense': 'expense',
        'Office Supply Expense': 'expense',
        'Phone & Internet Expense': 'expense',
        'Professional Service Expense': 'expense',
        'Rent Expense': 'expense',
        'Utilities Expense': 'expense'
    }
}
