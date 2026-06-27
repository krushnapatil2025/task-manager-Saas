-- ============================================================
-- Phase 25: Workspace Brand Configuration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Add branding columns to the workspaces table
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS brand_color       TEXT    DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS brand_color_light TEXT    DEFAULT '#eef2ff',
  ADD COLUMN IF NOT EXISTS brand_color_text  TEXT    DEFAULT '#4338ca',
  ADD COLUMN IF NOT EXISTS brand_color_name  TEXT    DEFAULT 'Indigo',
  ADD COLUMN IF NOT EXISTS company_name      TEXT    DEFAULT NULL;

-- company_name: when NULL, use workspace.name as the display name
-- logo_url already exists on workspaces table — reused for brand logo

-- Ensure existing rows have defaults filled
UPDATE workspaces
SET
  brand_color       = COALESCE(brand_color,       '#6366f1'),
  brand_color_light = COALESCE(brand_color_light, '#eef2ff'),
  brand_color_text  = COALESCE(brand_color_text,  '#4338ca'),
  brand_color_name  = COALESCE(brand_color_name,  'Indigo')
WHERE brand_color IS NULL;
