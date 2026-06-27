-- Phase 24: Add description column to todo_checklist table for subtasks
ALTER TABLE todo_checklist ADD COLUMN IF NOT EXISTS description TEXT;
