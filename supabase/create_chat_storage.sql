-- ═══════════════════════════════════════════════════════════════════════════
-- SQL: Create Supabase Storage Bucket for Chat Attachments
-- Run this in your Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow anyone to upload files to this bucket (Authenticated users)
DROP POLICY IF EXISTS "Allow authenticated uploads to chat-attachments" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to chat-attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

-- 3. Allow public read access to download files
DROP POLICY IF EXISTS "Allow public read access to chat-attachments" ON storage.objects;
CREATE POLICY "Allow public read access to chat-attachments"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-attachments');

-- Confirm bucket creation status
SELECT 'storage bucket chat-attachments created successfully ✅' AS status;
