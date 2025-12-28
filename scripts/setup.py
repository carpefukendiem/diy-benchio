"""
Setup validation script for DIY Accounting System
Checks configuration and provides setup instructions
"""

import os
import sys

def check_env_variable(var_name):
    """Check if an environment variable is set"""
    value = os.environ.get(var_name)
    if value and value != 'your_plaid_client_id_here' and value != 'your_plaid_secret_here':
        print(f"[OK] {var_name} is configured")
        return True
    else:
        print(f"[MISSING] {var_name} needs to be set")
        return False

def main():
    print("=== DIY Accounting System Setup Validator ===\n")
    
    # Check environment variables
    print("Checking Environment Variables:")
    print("-" * 50)
    
    plaid_client_id = check_env_variable('PLAID_CLIENT_ID')
    plaid_secret = check_env_variable('PLAID_SECRET')
    
    print("\n" + "=" * 50)
    
    if plaid_client_id and plaid_secret:
        print("\n[SUCCESS] All required environment variables are configured!")
        print("\nYour system is ready to use.")
        print("\nNext Steps:")
        print("1. Connect your business bank accounts using the 'Connect New Account' button")
        print("2. Review and categorize transactions for tax optimization")
        print("3. Monitor your tax savings in real-time")
        print("4. Export reports when needed for tax filing")
    else:
        print("\n[ACTION REQUIRED] Please configure missing environment variables")
        print("\nTo set up Plaid API credentials:")
        print("1. Go to the 'Vars' section in the v0 sidebar")
        print("2. Add/update these environment variables:")
        print("   - PLAID_CLIENT_ID: Your Plaid client ID")
        print("   - PLAID_SECRET: Your Plaid secret key")
        print("\nTo get Plaid credentials:")
        print("1. Visit https://dashboard.plaid.com/signup")
        print("2. Create a free developer account")
        print("3. Get your Client ID and Secret from the dashboard")
        print("4. Start with Sandbox environment for testing")
    
    print("\n" + "=" * 50)
    print("\nConfiguration Details:")
    print(f"- Python Version: {sys.version.split()[0]}")
    print(f"- Environment Variables Set: {len([k for k in os.environ.keys()])}")
    print(f"- Plaid Configuration: {'Complete' if plaid_client_id and plaid_secret else 'Incomplete'}")
    
    print("\n=== Validation Complete ===")

if __name__ == "__main__":
    main()
