-- Create storage bucket for brand logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-logos',
  'brand-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Brand logos are publicly accessible" ON storage.objects;

-- Set up RLS policies for brand-logos bucket
CREATE POLICY "Users can upload brand logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their brand logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their brand logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Brand logos are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'brand-logos');