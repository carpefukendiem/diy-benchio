-- ============================================
-- Simple JSON storage (no auth required)
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop if exists for idempotency
DROP TABLE IF EXISTS public.app_state CASCADE;

CREATE TABLE public.app_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipts table for cash transaction images
DROP TABLE IF EXISTS public.receipts CASCADE;

CREATE TABLE public.receipts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id TEXT NOT NULL,
  transaction_id TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  merchant_name TEXT,
  amount DECIMAL(12,2),
  date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS for simple usage (enable later when auth is added)
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Allow all operations (tighten with auth later)
CREATE POLICY "Allow all on app_state" ON public.app_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on receipts" ON public.receipts FOR ALL USING (true) WITH CHECK (true);

-- Insert default row
INSERT INTO public.app_state (id, data) VALUES ('default', '{}')
ON CONFLICT (id) DO NOTHING;
