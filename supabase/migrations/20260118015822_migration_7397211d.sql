-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  logo_path TEXT,
  brand_color TEXT NOT NULL DEFAULT '#0188a9',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for brands
CREATE POLICY "Users can view their own brands" ON brands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own brands" ON brands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own brands" ON brands FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own brands" ON brands FOR DELETE USING (auth.uid() = user_id);

-- Add brand_id to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_clients_brand_id ON clients(brand_id);
CREATE INDEX IF NOT EXISTS idx_brands_user_id ON brands(user_id);