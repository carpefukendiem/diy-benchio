"""
Plaid API client for fetching bank transactions and account data
"""

import os
from datetime import datetime, timedelta
from plaid.api import plaid_api
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.country_code import CountryCode
from plaid.model.products import Products
from plaid.configuration import Configuration
from plaid.api_client import ApiClient
import plaid
from config import PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV

class PlaidClient:
    def __init__(self):
        # Set up Plaid configuration
        if PLAID_ENV == 'sandbox':
            host = plaid.Environment.sandbox
        elif PLAID_ENV == 'development':
            host = plaid.Environment.development
        else:
            host = plaid.Environment.production
            
        configuration = Configuration(
            host=host,
            api_key={
                'clientId': PLAID_CLIENT_ID,
                'secret': PLAID_SECRET
            }
        )
        
        api_client = ApiClient(configuration)
        self.client = plaid_api.PlaidApi(api_client)
        
    def create_link_token(self, user_id):
        """Create a link token for Plaid Link"""
        request = LinkTokenCreateRequest(
            products=[Products('transactions')],
            client_name="DIY Accounting System",
            country_codes=[CountryCode('US')],
            language='en',
            user=LinkTokenCreateRequestUser(client_user_id=user_id)
        )
        
        response = self.client.link_token_create(request)
        return response['link_token']
    
    def exchange_public_token(self, public_token):
        """Exchange public token for access token"""
        request = ItemPublicTokenExchangeRequest(public_token=public_token)
        response = self.client.item_public_token_exchange(request)
        
        return {
            'access_token': response['access_token'],
            'item_id': response['item_id']
        }
    
    def get_accounts(self, access_token):
        """Get account information"""
        request = AccountsGetRequest(access_token=access_token)
        response = self.client.accounts_get(request)
        
        accounts = []
        for account in response['accounts']:
            accounts.append({
                'account_id': account['account_id'],
                'name': account['name'],
                'type': account['type'],
                'subtype': account['subtype'],
                'balance': account['balances']['current'],
                'available': account['balances']['available']
            })
        
        return accounts
    
    def get_transactions(self, access_token, start_date, end_date):
        """Get transactions for a date range"""
        request = TransactionsGetRequest(
            access_token=access_token,
            start_date=start_date.date(),
            end_date=end_date.date()
        )
        
        response = self.client.transactions_get(request)
        transactions = []
        
        for transaction in response['transactions']:
            transactions.append({
                'transaction_id': transaction['transaction_id'],
                'account_id': transaction['account_id'],
                'amount': transaction['amount'],
                'date': transaction['date'],
                'name': transaction['name'],
                'merchant_name': transaction.get('merchant_name', ''),
                'category': transaction.get('category', []),
                'account_owner': transaction.get('account_owner', '')
            })
        
        return transactions
    
    def get_all_transactions_for_accounts(self, access_tokens, start_date, end_date):
        """Get all transactions from multiple accounts"""
        all_transactions = []
        
        for access_token in access_tokens:
            try:
                transactions = self.get_transactions(access_token, start_date, end_date)
                all_transactions.extend(transactions)
            except Exception as e:
                print(f"Error fetching transactions for token {access_token}: {e}")
                
        return all_transactions

# For testing without actual Plaid connection
def get_mock_transactions():
    """Mock transactions for testing"""
    return [
        {
            'transaction_id': '1',
            'account_id': 'wells_fargo_checking',
            'amount': -2450.00,
            'date': datetime(2024, 3, 15).date(),
            'name': 'Stripe Transfer',
            'merchant_name': 'Stripe',
            'category': ['Transfer', 'Deposit'],
            'account_owner': None
        },
        {
            'transaction_id': '2',
            'account_id': 'wells_fargo_checking',
            'amount': 52.99,
            'date': datetime(2024, 3, 14).date(),
            'name': 'Adobe Creative Cloud',
            'merchant_name': 'Adobe',
            'category': ['Service', 'Software'],
            'account_owner': None
        },
        {
            'transaction_id': '3',
            'account_id': 'barclaycard_credit',
            'amount': 45.67,
            'date': datetime(2024, 3, 13).date(),
            'name': 'Shell Gas Station #1234',
            'merchant_name': 'Shell',
            'category': ['Gas Stations'],
            'account_owner': None
        },
        {
            'transaction_id': '4',
            'account_id': 'wells_fargo_checking',
            'amount': 89.50,
            'date': datetime(2024, 3, 12).date(),
            'name': 'Twilio Communications',
            'merchant_name': 'Twilio',
            'category': ['Service', 'Telecommunication Services'],
            'account_owner': None
        },
        {
            'transaction_id': '5',
            'account_id': 'barclaycard_credit',
            'amount': 15.75,
            'date': datetime(2024, 3, 11).date(),
            'name': 'Starbucks Coffee',
            'merchant_name': 'Starbucks',
            'category': ['Food and Drink', 'Coffee Shop'],
            'account_owner': None
        }
    ]
