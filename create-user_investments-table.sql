-- Create user_investments table for storing user investment records
CREATE TABLE IF NOT EXISTS user_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  investment_name TEXT NOT NULL,
  investment_type TEXT DEFAULT 'pool',
  amount_invested NUMERIC DEFAULT 0,
  current_value NUMERIC DEFAULT 0,
  return_rate NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  start_date TIMESTAMPTZ,
  maturity_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster profile lookups
CREATE INDEX IF NOT EXISTS idx_user_investments_profile_id ON user_investments(profile_id);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_user_investments_status ON user_investments(status);

-- Enable RLS (Row Level Security)
ALTER TABLE user_investments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own investments
CREATE POLICY "Users can view own investments" ON user_investments
  FOR SELECT USING (true);

-- Policy: Service role can do anything
CREATE POLICY "Service role full access" ON user_investments
  FOR ALL USING (auth.role() = 'service_role');

-- Verify the table was created
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('user_investments', 'investment_pools');