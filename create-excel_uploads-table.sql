-- Create excel_uploads table for storing file upload history
CREATE TABLE IF NOT EXISTS excel_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bulk_contributions', 'user_import', 'payroll', 'reconciliation')),
  uploaded_by TEXT,
  record_count INTEGER DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('processed', 'pending', 'failed', 'reviewing')),
  error_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_excel_uploads_status ON excel_uploads(status);
CREATE INDEX IF NOT EXISTS idx_excel_uploads_type ON excel_uploads(type);
CREATE INDEX IF NOT EXISTS idx_excel_uploads_created_at ON excel_uploads(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE excel_uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all uploads
CREATE POLICY "Authenticated users can view uploads" ON excel_uploads
  FOR SELECT USING (true);

-- Policy: Authenticated users can insert uploads
CREATE POLICY "Authenticated users can insert uploads" ON excel_uploads
  FOR INSERT WITH CHECK (true);

-- Policy: Authenticated users can update uploads
CREATE POLICY "Authenticated users can update uploads" ON excel_uploads
  FOR UPDATE USING (true);

-- Policy: Only service role can delete (admins should use API)
CREATE POLICY "Service role can delete uploads" ON excel_uploads
  FOR DELETE USING (auth.role() = 'service_role');

-- Verify the table was created
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'excel_uploads';