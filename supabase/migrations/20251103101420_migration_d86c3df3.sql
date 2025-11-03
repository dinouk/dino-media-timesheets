-- Create signup_requests table
CREATE TABLE IF NOT EXISTS signup_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT
);

-- Enable RLS
ALTER TABLE signup_requests ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for signup form)
CREATE POLICY "Anyone can submit signup requests" ON signup_requests 
  FOR INSERT 
  WITH CHECK (true);

-- Only authenticated users can view/update
CREATE POLICY "Authenticated users can view signup requests" ON signup_requests 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update signup requests" ON signup_requests 
  FOR UPDATE 
  USING (auth.uid() IS NOT NULL);