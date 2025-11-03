-- Create storage buckets for file attachments and company logos
-- Note: Supabase automatically creates storage.buckets table

-- Insert bucket for time entry file attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('timesheet-attachments', 'timesheet-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Insert bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for timesheet-attachments bucket
CREATE POLICY "Users can upload their own attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'timesheet-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'timesheet-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'timesheet-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create storage policies for company-logos bucket
CREATE POLICY "Users can upload their own logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');

CREATE POLICY "Users can update their own logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);