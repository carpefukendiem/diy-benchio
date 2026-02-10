-- ============================================
-- DIY Bench.io — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BUSINESSES
-- ============================================
CREATE TABLE public.businesses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('digital_marketing', 'hair_stylist')),
  entity_type TEXT NOT NULL DEFAULT 'llc' CHECK (entity_type IN ('sole_prop', 'llc', 'scorp')),
  ein TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ACCOUNTS (bank accounts, credit cards)
-- ============================================
CREATE TABLE public.accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT 'Wells Fargo',
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit_card')),
  last_four TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CATEGORIES
-- ============================================
CREATE TABLE public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  schedule_c_line TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'personal')),
  business_types TEXT[] DEFAULT '{}',
  description TEXT,
  keywords TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT TRUE
);

-- ============================================
-- TRANSACTIONS
-- ============================================
CREATE TABLE public.transactions (
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

-- ============================================
-- CATEGORIZATION RULES
-- ============================================
CREATE TABLE public.categorization_rules (
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

-- ============================================
-- STATEMENT UPLOADS
-- ============================================
CREATE TABLE public.statement_uploads (
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
CREATE INDEX idx_transactions_business ON public.transactions(business_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_category ON public.transactions(category_id);
CREATE INDEX idx_transactions_month ON public.transactions(statement_month);
CREATE INDEX idx_transactions_uncategorized ON public.transactions(business_id) WHERE category_id IS NULL AND is_transfer = FALSE AND is_personal = FALSE;
CREATE INDEX idx_rules_business ON public.categorization_rules(business_id);
CREATE INDEX idx_accounts_business ON public.accounts(business_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Businesses: users can only see their own
CREATE POLICY "Users can manage own businesses" ON public.businesses FOR ALL USING (auth.uid() = user_id);

-- Accounts: through business ownership
CREATE POLICY "Users can manage own accounts" ON public.accounts FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- Transactions: through business ownership
CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- Rules: through business ownership
CREATE POLICY "Users can manage own rules" ON public.categorization_rules FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- Uploads: through business ownership
CREATE POLICY "Users can manage own uploads" ON public.statement_uploads FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- Categories: everyone can read system categories
CREATE POLICY "Anyone can read categories" ON public.categories FOR SELECT USING (TRUE);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
