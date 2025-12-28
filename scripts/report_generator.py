"""
Financial report generator for Google Sheets
Creates Balance Sheet, Income Statement, Trial Balance, General Ledger, and Monthly reports
"""

import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime, timedelta
import calendar
from config import GOOGLE_SHEETS_CREDENTIALS_FILE, SPREADSHEET_NAME, BUSINESS_NAME, OWNER_NAME, CURRENT_YEAR

class ReportGenerator:
    def __init__(self):
        # Set up Google Sheets connection
        scope = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive"
        ]
        
        try:
            creds = ServiceAccountCredentials.from_json_keyfile_name(
                GOOGLE_SHEETS_CREDENTIALS_FILE, scope
            )
            self.client = gspread.authorize(creds)
            
            # Create or open the spreadsheet
            try:
                self.workbook = self.client.open(SPREADSHEET_NAME)
            except gspread.SpreadsheetNotFound:
                self.workbook = self.client.create(SPREADSHEET_NAME)
                print(f"Created new spreadsheet: {SPREADSHEET_NAME}")
                
        except Exception as e:
            print(f"Error setting up Google Sheets: {e}")
            self.client = None
            self.workbook = None
    
    def create_worksheets(self):
        """Create all necessary worksheets"""
        worksheet_names = [
            "Balance Sheet",
            "Income Statement", 
            "Trial Balance",
            "General Ledger",
            "Monthly Balance Sheet",
            "Monthly Income Statement",
            "Adjusting Journal Entries"
        ]
        
        existing_sheets = [ws.title for ws in self.workbook.worksheets()]
        
        for name in worksheet_names:
            if name not in existing_sheets:
                self.workbook.add_worksheet(title=name, rows=1000, cols=26)
                print(f"Created worksheet: {name}")
    
    def generate_balance_sheet(self, account_balances, retained_earnings=0):
        """Generate Balance Sheet"""
        try:
            balance_sheet = self.workbook.worksheet("Balance Sheet")
        except gspread.WorksheetNotFound:
            balance_sheet = self.workbook.add_worksheet(title="Balance Sheet", rows=1000, cols=26)
        
        # Clear existing content
        balance_sheet.clear()
        
        # Header
        balance_sheet.update("A1", BUSINESS_NAME)
        balance_sheet.update("A2", "Balance Sheet")
        balance_sheet.update("A3", f"For the period ending December 31, {CURRENT_YEAR}")
        balance_sheet.update("A5:B5", [["As Of:", f"December 31, {CURRENT_YEAR}"]])
        
        # Assets
        assets = [
            ["ASSETS", ""],
            ["Wells Fargo - Checking - 9898", account_balances.get('wells_fargo_checking', 354.22)],
            ["Wells Fargo - Savings - 4174", account_balances.get('wells_fargo_savings', 29.12)],
            ["Stripe - Merchant Processor - Ruben Ruiz", account_balances.get('stripe_account', 498.81)],
            ["Money in transit", 0],
            ["", ""],
            ["TOTAL ASSETS", sum([
                account_balances.get('wells_fargo_checking', 354.22),
                account_balances.get('wells_fargo_savings', 29.12),
                account_balances.get('stripe_account', 498.81)
            ])]
        ]
        
        # Liabilities
        liabilities = [
            ["", ""],
            ["LIABILITIES", ""],
            ["Barclaycard - Credit Card - 2163", account_balances.get('barclaycard_credit', 3999.71)],
            ["Stripe Capital - Loan Payable", account_balances.get('stripe_capital', 6021.40)],
            ["", ""],
            ["TOTAL LIABILITIES", sum([
                account_balances.get('barclaycard_credit', 3999.71),
                account_balances.get('stripe_capital', 6021.40)
            ])]
        ]
        
        # Equity
        equity = [
            ["", ""],
            ["EQUITY", ""],
            ["Member Contribution - Ruben Ruiz", 8679.15],
            ["Member Drawing - Ruben Ruiz", -31304.25],
            ["Retained Earnings", retained_earnings],
            ["", ""],
            ["TOTAL EQUITY", 8679.15 - 31304.25 + retained_earnings]
        ]
        
        # Write to sheet
        row = 7
        for section in [assets, liabilities, equity]:
            for item in section:
                if len(item) == 2 and item[0] and item[1] != "":
                    balance_sheet.update(f"A{row}:B{row}", [item])
                elif item[0]:
                    balance_sheet.update(f"A{row}", item[0])
                row += 1
        
        print("Balance Sheet generated successfully")
    
    def generate_income_statement(self, category_totals):
        """Generate Income Statement"""
        try:
            income_statement = self.workbook.worksheet("Income Statement")
        except gspread.WorksheetNotFound:
            income_statement = self.workbook.add_worksheet(title="Income Statement", rows=1000, cols=26)
        
        # Clear existing content
        income_statement.clear()
        
        # Header
        income_statement.update("A1", BUSINESS_NAME)
        income_statement.update("A2", "Income Statement")
        income_statement.update("A3", f"For the period January 1, {CURRENT_YEAR} to December 31, {CURRENT_YEAR}")
        
        # Revenue section
        revenues = [
            ["REVENUE", ""],
            ["Sales Revenue", category_totals.get("Sales Revenue", 0)],
            ["Returns & Allowances", -category_totals.get("Returns & Allowances", 0)],
            ["Interest Income", category_totals.get("Interest Income", 0)],
            ["Other Income", category_totals.get("Other Income", 0)],
        ]
        
        total_revenue = (category_totals.get("Sales Revenue", 0) - 
                        category_totals.get("Returns & Allowances", 0) +
                        category_totals.get("Interest Income", 0) +
                        category_totals.get("Other Income", 0))
        
        revenues.append(["TOTAL REVENUE", total_revenue])
        
        # Cost of Sales
        cost_of_sales = [
            ["", ""],
            ["COST OF SALES", ""],
            ["Cost of Service", category_totals.get("Cost of Service", 0)],
            ["TOTAL COST OF SALES", category_totals.get("Cost of Service", 0)]
        ]
        
        gross_profit = total_revenue - category_totals.get("Cost of Service", 0)
        cost_of_sales.append(["GROSS PROFIT", gross_profit])
        
        # Operating Expenses
        expense_categories = [
            "Software & Web Hosting Expense",
            "Business Meals Expense", 
            "Gas & Auto Expense",
            "Bank & ATM Fee Expense",
            "Insurance Expense - Auto",
            "Insurance Expense - Business",
            "Merchant Fees Expense",
            "Office Supply Expense",
            "Phone & Internet Expense",
            "Professional Service Expense",
            "Rent Expense",
            "Utilities Expense"
        ]
        
        expenses = [["", ""], ["OPERATING EXPENSES", ""]]
        total_expenses = 0
        
        for category in expense_categories:
            amount = category_totals.get(category, 0)
            if amount > 0:
                expenses.append([category, amount])
                total_expenses += amount
        
        expenses.append(["TOTAL OPERATING EXPENSES", total_expenses])
        
        # Net Income
        net_income = gross_profit - total_expenses
        expenses.append(["", ""])
        expenses.append(["NET INCOME", net_income])
        
        # Write to sheet
        row = 5
        for section in [revenues, cost_of_sales, expenses]:
            for item in section:
                if len(item) == 2 and item[0] and item[1] != "":
                    income_statement.update(f"A{row}:B{row}", [item])
                elif item[0]:
                    income_statement.update(f"A{row}", item[0])
                row += 1
        
        print("Income Statement generated successfully")
        return net_income
    
    def generate_trial_balance(self, category_totals):
        """Generate Trial Balance"""
        try:
            trial_balance = self.workbook.worksheet("Trial Balance")
        except gspread.WorksheetNotFound:
            trial_balance = self.workbook.add_worksheet(title="Trial Balance", rows=1000, cols=26)
        
        # Clear existing content
        trial_balance.clear()
        
        # Header
        trial_balance.update("A1", BUSINESS_NAME)
        trial_balance.update("A2", "Trial Balance")
        trial_balance.update("A3", f"For the period ending December 31, {CURRENT_YEAR}")
        trial_balance.update("A5:C5", [["Account", "Dr", "Cr"]])
        
        # Prepare trial balance data
        accounts = []
        total_dr = 0
        total_cr = 0
        
        # Revenue accounts (Credit balance)
        revenue_accounts = ["Sales Revenue", "Interest Income", "Other Income"]
        for account in revenue_accounts:
            amount = category_totals.get(account, 0)
            if amount > 0:
                accounts.append([account, "", amount])
                total_cr += amount
        
        # Expense accounts (Debit balance)
        expense_accounts = [
            "Cost of Service", "Software & Web Hosting Expense", "Business Meals Expense",
            "Gas & Auto Expense", "Bank & ATM Fee Expense", "Insurance Expense - Auto",
            "Insurance Expense - Business", "Merchant Fees Expense", "Office Supply Expense",
            "Phone & Internet Expense", "Professional Service Expense", "Rent Expense",
            "Utilities Expense"
        ]
        
        for account in expense_accounts:
            amount = category_totals.get(account, 0)
            if amount > 0:
                accounts.append([account, amount, ""])
                total_dr += amount
        
        # Add totals
        accounts.append(["", "", ""])
        accounts.append(["TOTALS", total_dr, total_cr])
        
        # Write to sheet
        row = 6
        for account in accounts:
            if len(account) == 3:
                trial_balance.update(f"A{row}:C{row}", [account])
            row += 1
        
        print("Trial Balance generated successfully")
    
    def generate_general_ledger(self, categorized_transactions):
        """Generate General Ledger"""
        try:
            general_ledger = self.workbook.worksheet("General Ledger")
        except gspread.WorksheetNotFound:
            general_ledger = self.workbook.add_worksheet(title="General Ledger", rows=1000, cols=26)
        
        # Clear existing content
        general_ledger.clear()
        
        # Header
        general_ledger.update("A1", BUSINESS_NAME)
        general_ledger.update("A2", "General Ledger")
        general_ledger.update("A3", f"For the period January 1, {CURRENT_YEAR} to December 31, {CURRENT_YEAR}")
        general_ledger.update("A5:E5", [["Date", "Description", "Account", "Dr", "Cr"]])
        
        # Prepare ledger data
        ledger_data = []
        
        for transaction in categorized_transactions:
            date = transaction['date']
            description = transaction['description']
            account = transaction['category']
            amount = transaction['amount']
            
            if transaction['is_income']:
                # Income transactions: Credit the revenue account
                dr_amount = ""
                cr_amount = amount
            else:
                # Expense transactions: Debit the expense account
                dr_amount = amount
                cr_amount = ""
            
            ledger_data.append([date, description, account, dr_amount, cr_amount])
        
        # Sort by date
        ledger_data.sort(key=lambda x: x[0])
        
        # Write to sheet
        if ledger_data:
            general_ledger.update(f"A6:E{6 + len(ledger_data) - 1}", ledger_data)
        
        print("General Ledger generated successfully")
    
    def generate_monthly_reports(self, categorized_transactions):
        """Generate Monthly Balance Sheet and Income Statement"""
        # Monthly Income Statement
        try:
            monthly_is = self.workbook.worksheet("Monthly Income Statement")
        except gspread.WorksheetNotFound:
            monthly_is = self.workbook.add_worksheet(title="Monthly Income Statement", rows=1000, cols=26)
        
        monthly_is.clear()
        monthly_is.update("A1", BUSINESS_NAME)
        monthly_is.update("A2", "Monthly Income Statement")
        monthly_is.update("A3", f"For the period Jan {CURRENT_YEAR} to Dec {CURRENT_YEAR}")
        
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        monthly_is.update("A5:M5", [["Category"] + months])
        
        # Calculate monthly totals
        monthly_data = {month: {} for month in months}
        
        for transaction in categorized_transactions:
            date_obj = datetime.strptime(transaction['date'], '%Y-%m-%d')
            month = date_obj.strftime('%b')
            category = transaction['category']
            amount = transaction['amount']
            
            if month not in monthly_data:
                monthly_data[month] = {}
            
            if category not in monthly_data[month]:
                monthly_data[month][category] = 0
            
            if transaction['is_income']:
                monthly_data[month][category] += amount
            else:
                monthly_data[month][category] += amount
        
        # Write monthly data
        categories = set()
        for month_data in monthly_data.values():
            categories.update(month_data.keys())
        
        row = 6
        for category in sorted(categories):
            row_data = [category]
            for month in months:
                row_data.append(monthly_data[month].get(category, 0))
            monthly_is.update(f"A{row}:M{row}", [row_data])
            row += 1
        
        print("Monthly reports generated successfully")
    
    def generate_adjusting_entries_template(self):
        """Generate Adjusting Journal Entries template"""
        try:
            adjustments = self.workbook.worksheet("Adjusting Journal Entries")
        except gspread.WorksheetNotFound:
            adjustments = self.workbook.add_worksheet(title="Adjusting Journal Entries", rows=1000, cols=26)
        
        adjustments.clear()
        adjustments.update("A1", BUSINESS_NAME)
        adjustments.update("A2", "Adjusting Journal Entries")
        adjustments.update("A3", f"For the period January 1, {CURRENT_YEAR} to December 31, {CURRENT_YEAR}")
        
        headers = ["Adjustment #", "Posting Date", "Account Name", "DR $", "CR $", 
                  "Rationale for Adjustment", "Journal Author"]
        adjustments.update("A5:G5", [headers])
        
        # Add sample entry
        sample_entry = ["1", f"12/31/{CURRENT_YEAR}", "Example Expense Account", "500", "", 
                       "Adjustment to record depreciation for the year", OWNER_NAME]
        adjustments.update("A6:G6", [sample_entry])
        
        print("Adjusting Journal Entries template generated successfully")
    
    def generate_all_reports(self, categorized_transactions, account_balances=None):
        """Generate all financial reports"""
        if not self.workbook:
            print("Error: Google Sheets not properly initialized")
            return
        
        print("Generating financial reports...")
        
        # Create worksheets if they don't exist
        self.create_worksheets()
        
        # Calculate category totals
        from categorizer import TransactionCategorizer
        categorizer = TransactionCategorizer()
        category_totals = categorizer.get_category_totals(categorized_transactions)
        
        # Generate reports
        net_income = self.generate_income_statement(category_totals)
        self.generate_balance_sheet(account_balances or {}, net_income)
        self.generate_trial_balance(category_totals)
        self.generate_general_ledger(categorized_transactions)
        self.generate_monthly_reports(categorized_transactions)
        self.generate_adjusting_entries_template()
        
        print(f"All reports generated successfully in spreadsheet: {SPREADSHEET_NAME}")
        print(f"Spreadsheet URL: {self.workbook.url}")
