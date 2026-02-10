-- ============================================
-- DIY Books — COMPLETE Supabase Setup
-- Paste this entire file into Supabase SQL Editor and click Run
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DROP existing objects for clean re-run (optional — uncomment if needed)
-- ============================================
-- DROP TABLE IF EXISTS public.statement_uploads CASCADE;
-- DROP TABLE IF EXISTS public.categorization_rules CASCADE;
-- DROP TABLE IF EXISTS public.transactions CASCADE;
-- DROP TABLE IF EXISTS public.categories CASCADE;
-- DROP TABLE IF EXISTS public.accounts CASCADE;
-- DROP TABLE IF EXISTS public.businesses CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================
-- TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('digital_marketing', 'hair_stylist')),
  entity_type TEXT NOT NULL DEFAULT 'llc' CHECK (entity_type IN ('sole_prop', 'llc', 'scorp')),
  ein TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT 'Wells Fargo',
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit_card')),
  last_four TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  schedule_c_line TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'personal')),
  business_types TEXT[] DEFAULT '{}',
  description TEXT,
  keywords TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  original_description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  schedule_c_line TEXT,
  is_personal BOOLEAN DEFAULT FALSE,
  is_transfer BOOLEAN DEFAULT FALSE,
  confidence DECIMAL(3,2) DEFAULT 0,
  categorized_by TEXT CHECK (categorized_by IN ('rule', 'ai', 'user')),
  notes TEXT,
  duplicate_of UUID REFERENCES public.transactions(id),
  statement_month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'starts_with', 'exact', 'regex')),
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  is_personal BOOLEAN DEFAULT FALSE,
  is_transfer BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'system' CHECK (created_by IN ('system', 'user', 'ai')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.statement_uploads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'csv')),
  statement_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'parsed', 'categorized', 'reviewed', 'error')),
  transaction_count INTEGER DEFAULT 0,
  error_message TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transactions_business ON public.transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_month ON public.transactions(statement_month);
CREATE INDEX IF NOT EXISTS idx_rules_business ON public.categorization_rules(business_id);
CREATE INDEX IF NOT EXISTS idx_accounts_business ON public.accounts(business_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe if they don't exist)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can manage own businesses" ON public.businesses;
  DROP POLICY IF EXISTS "Users can manage own accounts" ON public.accounts;
  DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
  DROP POLICY IF EXISTS "Users can manage own rules" ON public.categorization_rules;
  DROP POLICY IF EXISTS "Users can manage own uploads" ON public.statement_uploads;
  DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;
END $$;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can manage own businesses" ON public.businesses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own accounts" ON public.accounts FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage own rules" ON public.categorization_rules FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage own uploads" ON public.statement_uploads FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
CREATE POLICY "Anyone can read categories" ON public.categories FOR SELECT USING (TRUE);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_updated_at ON public.transactions;
CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SEED: CATEGORIES (35+ categories mapped to Schedule C)
-- ============================================
INSERT INTO public.categories (id, name, schedule_c_line, type, business_types, description, keywords, is_system) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Sales Revenue', 'line_1', 'income', '{digital_marketing,hair_stylist}', 'Gross receipts from sales/services', '{stripe,paypal,square,invoice,payment}', true),
  ('00000000-0000-0000-0001-000000000002', 'Refunds Given', 'line_2', 'income', '{digital_marketing,hair_stylist}', 'Returns and allowances', '{refund,return,credit,chargeback}', true),
  ('00000000-0000-0000-0001-000000000003', 'Other Income', 'line_6', 'income', '{digital_marketing,hair_stylist}', 'Interest, affiliate income', '{interest,dividend,affiliate}', true),
  ('00000000-0000-0000-0001-000000000004', 'Freelance Income', 'line_1', 'income', '{digital_marketing}', 'Freelance platform income', '{upwork,fiverr,freelance}', true),
  ('00000000-0000-0000-0002-000000000001', 'Advertising & Marketing', 'line_8', 'expense', '{digital_marketing,hair_stylist}', 'Ads, promotions', '{google ads,facebook ads,advertising}', true),
  ('00000000-0000-0000-0002-000000000002', 'Social Media & Online Presence', 'line_8', 'expense', '{digital_marketing,hair_stylist}', 'Social media tools, web presence', '{x corp,webflow,squarespace}', true),
  ('00000000-0000-0000-0002-000000000003', 'Gas & Auto Expenses', 'line_9', 'expense', '{digital_marketing,hair_stylist}', 'Fuel, parking, tolls', '{gas,fuel,parking,toll}', true),
  ('00000000-0000-0000-0002-000000000005', 'Merchant Processing Fees', 'line_10', 'expense', '{digital_marketing,hair_stylist}', 'Stripe, PayPal fees', '{stripe fee,paypal fee}', true),
  ('00000000-0000-0000-0002-000000000006', 'Contract Labor', 'line_11', 'expense', '{digital_marketing,hair_stylist}', '1099 contractors', '{contractor,freelancer}', true),
  ('00000000-0000-0000-0002-000000000007', 'Equipment & Depreciation', 'line_13', 'expense', '{digital_marketing,hair_stylist}', 'Computer, equipment', '{computer,laptop,macbook}', true),
  ('00000000-0000-0000-0002-000000000008', 'Business Insurance', 'line_15', 'expense', '{digital_marketing,hair_stylist}', 'Liability, E&O insurance', '{business insurance,united fin cas}', true),
  ('00000000-0000-0000-0002-000000000009', 'Health Insurance', 'line_15', 'expense', '{digital_marketing,hair_stylist}', 'Health insurance premiums', '{health insurance,medical}', true),
  ('00000000-0000-0000-0002-000000000010', 'Interest & Bank Fees', 'line_16b', 'expense', '{digital_marketing,hair_stylist}', 'Bank fees, overdraft, interest', '{interest,bank fee,overdraft,monthly service fee}', true),
  ('00000000-0000-0000-0002-000000000011', 'Professional Services', 'line_17', 'expense', '{digital_marketing,hair_stylist}', 'Accountant, lawyer, bookkeeper', '{accountant,attorney,bench accounting}', true),
  ('00000000-0000-0000-0002-000000000012', 'Tax Software & Services', 'line_17', 'expense', '{digital_marketing}', 'CoinLedger, TurboTax', '{coinledger,turbotax}', true),
  ('00000000-0000-0000-0002-000000000013', 'Office Supplies', 'line_18', 'expense', '{digital_marketing,hair_stylist}', 'Shipping, postage, supplies', '{ups store,fedex,office}', true),
  ('00000000-0000-0000-0002-000000000015', 'Booth/Chair Rental', 'line_20b', 'expense', '{hair_stylist}', 'Salon booth rental', '{booth rental,chair rental}', true),
  ('00000000-0000-0000-0002-000000000016', 'Hair Supplies & Tools', 'line_22', 'expense', '{hair_stylist}', 'Scissors, color, shampoo', '{sally beauty,cosmoprof,hair color}', true),
  ('00000000-0000-0000-0002-000000000017', 'Licenses & Permits', 'line_23', 'expense', '{digital_marketing,hair_stylist}', 'Business/cosmetology license', '{license,permit}', true),
  ('00000000-0000-0000-0002-000000000018', 'Travel', 'line_24a', 'expense', '{digital_marketing,hair_stylist}', 'Flights, hotels, rideshare', '{airline,hotel,uber,lyft}', true),
  ('00000000-0000-0000-0002-000000000019', 'Business Meals', 'line_24b', 'expense', '{digital_marketing,hair_stylist}', 'Client meals (50% deductible)', '{restaurant,cafe,coffee}', true),
  ('00000000-0000-0000-0002-000000000020', 'Utilities', 'line_25', 'expense', '{digital_marketing,hair_stylist}', 'Electric, water, gas', '{edison,pg&e,utility}', true),
  ('00000000-0000-0000-0002-000000000021', 'Phone & Internet', 'line_25', 'expense', '{digital_marketing,hair_stylist}', 'Cell phone, internet', '{verizon,vz wireless,spectrum}', true),
  ('00000000-0000-0000-0002-000000000022', 'Software & Subscriptions', 'line_27a', 'expense', '{digital_marketing}', 'SaaS tools, subscriptions', '{highlevel,gohighlevel,mailgun,openai,cursor}', true),
  ('00000000-0000-0000-0002-000000000023', 'Education & Training', 'line_27a', 'expense', '{digital_marketing,hair_stylist}', 'Courses, certifications', '{course,codecademy,training}', true),
  ('00000000-0000-0000-0002-000000000025', 'Waste & Disposal', 'line_27a', 'expense', '{digital_marketing,hair_stylist}', 'Trash, recycling', '{marborg,waste,disposal}', true),
  ('00000000-0000-0000-0002-000000000026', 'Home Improvement (Business)', 'line_27a', 'expense', '{digital_marketing,hair_stylist}', 'Home office improvements', '{home depot,lowes}', true),
  ('00000000-0000-0000-0002-000000000027', 'Home Office Expenses', 'line_30', 'expense', '{digital_marketing,hair_stylist}', 'Home office deduction', '{home office}', true),
  ('00000000-0000-0000-0003-000000000001', 'Owner Draw / Distribution', NULL, 'transfer', '{digital_marketing,hair_stylist}', 'Money taken out by owner', '{owner draw,transfer to personal}', true),
  ('00000000-0000-0000-0003-000000000002', 'Owner Contribution', NULL, 'transfer', '{digital_marketing,hair_stylist}', 'Money put in by owner', '{owner contribution,transfer from personal}', true),
  ('00000000-0000-0000-0003-000000000003', 'Internal Transfer', NULL, 'transfer', '{digital_marketing,hair_stylist}', 'Transfers between own accounts', '{transfer to,transfer from}', true),
  ('00000000-0000-0000-0003-000000000005', 'Credit Card Payment', NULL, 'transfer', '{digital_marketing,hair_stylist}', 'CC bill payments', '{chase credit crd,barclaycard}', true),
  ('00000000-0000-0000-0004-000000000001', 'Personal Expense', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Non-business personal expenses', '{personal}', true),
  ('00000000-0000-0000-0004-000000000002', 'Personal - Groceries', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Personal grocery shopping', '{costco,sprouts,trader joe}', true),
  ('00000000-0000-0000-0004-000000000003', 'Personal - Entertainment', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Personal entertainment', '{netflix,prime video,audible,midjourney,oura}', true),
  ('00000000-0000-0000-0004-000000000004', 'Personal - Shopping', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Personal shopping', '{amazon,billabong,blenders}', true),
  ('00000000-0000-0000-0004-000000000005', 'Personal - Food & Drink', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Personal dining', '{taco bell,little caesars,wingstop}', true),
  ('00000000-0000-0000-0004-000000000006', 'Personal - Health', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Personal health expenses', '{cvs,pharmacy}', true),
  ('00000000-0000-0000-0004-000000000007', 'ATM Withdrawal', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Cash withdrawals', '{atm withdrawal}', true),
  ('00000000-0000-0000-0004-000000000008', 'Zelle / Venmo Transfer', NULL, 'transfer', '{digital_marketing,hair_stylist}', 'Peer-to-peer payments', '{zelle,venmo}', true),
  ('00000000-0000-0000-0004-000000000009', 'Crypto / Investments', NULL, 'personal', '{digital_marketing,hair_stylist}', 'Crypto, trading', '{coinbase,tradingview,kraken}', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DONE! Verify with: SELECT count(*) FROM public.categories;
-- Expected: 41 categories
-- ============================================
