"""
Transaction categorization engine
Automatically categorizes transactions based on merchant names and patterns
"""

import re
from datetime import datetime

class TransactionCategorizer:
    def __init__(self):
        # Categorization rules based on merchant patterns
        self.categorization_rules = {
            # Revenue Categories
            'Sales Revenue': [
                r'stripe.*transfer',
                r'paypal.*transfer',
                r'square.*deposit',
                r'client.*payment',
                r'invoice.*payment',
                r'zelle.*from.*(?!loan)',  # Zelle from someone (not loan)
            ],
            
            'Interest Income': [
                r'interest.*earned',
                r'savings.*interest',
                r'checking.*interest',
                r'dividend',
            ],
            
            'Other Income': [
                r'refund',
                r'cashback',
                r'reward',
                r'bonus',
            ],
            
            'Returns & Allowances': [
                r'return',
                r'chargeback',
                r'dispute',
                r'reversal',
            ],
            
            # Cost of Sales
            'Cost of Service': [
                r'contractor.*payment',
                r'freelancer',
                r'service.*provider',
                r'labor.*cost',
            ],
            
            # Operating Expenses
            'Software & Web Hosting Expense': [
                r'adobe',
                r'microsoft',
                r'google.*workspace',
                r'aws',
                r'azure',
                r'twilio',
                r'highlevel',
                r'zapier',
                r'notion',
                r'slack',
                r'zoom',
                r'dropbox',
                r'github',
                r'vercel',
                r'netlify',
            ],
            
            'Business Meals Expense': [
                r'restaurant',
                r'starbucks',
                r'coffee',
                r'lunch',
                r'dinner',
                r'meal',
                r'food.*business',
                r'in-n-out',
                r'mcdonalds',
                r'subway',
                r'chipotle',
            ],
            
            'Gas & Auto Expense': [
                r'shell',
                r'exxon',
                r'chevron',
                r'bp',
                r'gas.*station',
                r'fuel',
                r'auto.*repair',
                r'car.*wash',
                r'parking',
                r'toll',
            ],
            
            'Bank & ATM Fee Expense': [
                r'wells.*fargo.*fee',
                r'atm.*fee',
                r'overdraft',
                r'monthly.*fee',
                r'service.*charge',
                r'wire.*fee',
            ],
            
            'Insurance Expense - Auto': [
                r'auto.*insurance',
                r'car.*insurance',
                r'geico',
                r'state.*farm.*auto',
                r'progressive.*auto',
            ],
            
            'Insurance Expense - Business': [
                r'business.*insurance',
                r'liability.*insurance',
                r'professional.*insurance',
                r'errors.*omissions',
            ],
            
            'Merchant Fees Expense': [
                r'stripe.*fee',
                r'paypal.*fee',
                r'square.*fee',
                r'processing.*fee',
                r'transaction.*fee',
            ],
            
            'Office Supply Expense': [
                r'office.*depot',
                r'staples',
                r'amazon.*office',
                r'paper',
                r'supplies',
                r'printer',
                r'ink',
            ],
            
            'Phone & Internet Expense': [
                r'verizon',
                r'at&t',
                r'comcast',
                r'cox.*internet',
                r'spectrum',
                r'phone.*bill',
                r'internet.*service',
                r'cellular',
            ],
            
            'Professional Service Expense': [
                r'bench.*accounting',
                r'lawyer',
                r'attorney',
                r'accountant',
                r'consultant',
                r'professional.*service',
                r'legal.*fee',
            ],
            
            'Rent Expense': [
                r'rent',
                r'lease',
                r'office.*space',
                r'co.*working',
            ],
            
            'Utilities Expense': [
                r'electric',
                r'gas.*utility',
                r'water.*bill',
                r'sewer',
                r'trash',
                r'utility',
            ],
        }
        
        # Special handling for loan payments and transfers
        self.special_patterns = {
            'Member Drawing - Ruben Ruiz': [
                r'zelle.*to',
                r'transfer.*to.*personal',
                r'withdrawal.*personal',
            ],
            
            'Member Contribution - Ruben Ruiz': [
                r'deposit.*from.*personal',
                r'transfer.*from.*personal',
                r'capital.*contribution',
            ],
            
            'Loan Payment': [
                r'stripe.*capital',
                r'loan.*payment',
                r'sba.*payment',
            ],
        }
    
    def categorize_transaction(self, transaction):
        """
        Categorize a single transaction based on merchant name and amount
        """
        merchant_name = transaction.get('name', '').lower()
        amount = transaction.get('amount', 0)
        
        # Handle revenue vs expense based on amount sign
        # Plaid returns negative amounts for money going out, positive for money coming in
        is_income = amount < 0  # Plaid convention: negative = money in
        
        # Check special patterns first
        for category, patterns in self.special_patterns.items():
            for pattern in patterns:
                if re.search(pattern, merchant_name, re.IGNORECASE):
                    return category
        
        # Check regular categorization rules
        for category, patterns in self.categorization_rules.items():
            for pattern in patterns:
                if re.search(pattern, merchant_name, re.IGNORECASE):
                    # For revenue categories, only match if it's actually income
                    if category in ['Sales Revenue', 'Interest Income', 'Other Income', 'Returns & Allowances']:
                        if is_income:
                            return category
                    else:
                        # For expense categories, only match if it's actually an expense
                        if not is_income:
                            return category
        
        # Default categorization
        if is_income:
            return 'Other Income'
        else:
            return 'Awaiting Category - Expense'
    
    def categorize_transactions(self, transactions):
        """
        Categorize a list of transactions
        """
        categorized = []
        
        for transaction in transactions:
            category = self.categorize_transaction(transaction)
            
            categorized_transaction = {
                'transaction_id': transaction['transaction_id'],
                'date': transaction['date'].strftime('%Y-%m-%d') if isinstance(transaction['date'], datetime) else str(transaction['date']),
                'description': transaction['name'],
                'amount': abs(transaction['amount']),  # Use absolute value
                'category': category,
                'account': transaction['account_id'],
                'merchant_name': transaction.get('merchant_name', ''),
                'is_income': transaction['amount'] < 0,  # Plaid convention
                'original_amount': transaction['amount']
            }
            
            categorized.append(categorized_transaction)
        
        return categorized
    
    def get_category_totals(self, categorized_transactions):
        """
        Calculate totals for each category
        """
        category_totals = {}
        
        for transaction in categorized_transactions:
            category = transaction['category']
            amount = transaction['amount']
            
            # For income categories, use positive amounts
            # For expense categories, use positive amounts (they'll be subtracted in reports)
            if transaction['is_income']:
                amount = amount  # Keep positive for income
            else:
                amount = amount  # Keep positive for expenses
            
            if category not in category_totals:
                category_totals[category] = 0
            
            category_totals[category] += amount
        
        return category_totals
    
    def add_custom_rule(self, category, pattern):
        """
        Add a custom categorization rule
        """
        if category not in self.categorization_rules:
            self.categorization_rules[category] = []
        
        self.categorization_rules[category].append(pattern)
    
    def get_uncategorized_transactions(self, categorized_transactions):
        """
        Get transactions that need manual categorization
        """
        uncategorized = []
        
        for transaction in categorized_transactions:
            if 'Awaiting Category' in transaction['category']:
                uncategorized.append(transaction)
        
        return uncategorized
