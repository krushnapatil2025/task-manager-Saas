-- ============================================================
-- PHASE 2 — Comments, Notifications, File Attachments
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. TASK_COMMENTS table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_comments (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content      TEXT NOT NULL CHECK (char_length(content) > 0),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_task      ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_workspace ON task_comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comments_author    ON task_comments(author_id);

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 2. NOTIFICATIONS table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,   -- 'task_assigned' | 'task_comment' | 'task_status' | 'mention'
  title        TEXT NOT NULL,
  body         TEXT,
  link         TEXT,            -- e.g. '/user/task-details/<task_id>'
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user      ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_workspace ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread    ON notifications(user_id, is_read);

-- ─────────────────────────────────────────────────────────────────
-- 3. TASK_FILES table (Supabase Storage references)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_files (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  uploaded_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  file_size    BIGINT,
  mime_type    TEXT,
  storage_path TEXT NOT NULL,   -- path within the Supabase Storage bucket
  public_url   TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_files_task ON task_files(task_id);

-- ─────────────────────────────────────────────────────────────────
-- 4. RLS — task_comments
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read comments"
  ON task_comments FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members add comments"
  ON task_comments FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    AND author_id = auth.uid()
  );

CREATE POLICY "Authors edit own comments"
  ON task_comments FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "Authors delete own comments"
  ON task_comments FOR DELETE
  USING (author_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────
-- 5. RLS — notifications
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role inserts notifications"
  ON notifications FOR INSERT
  WITH CHECK (TRUE);   -- DB triggers write notifications as SECURITY DEFINER

CREATE POLICY "Users mark own notifications read"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────
-- 6. RLS — task_files
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE task_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read files"
  ON task_files FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members upload files"
  ON task_files FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Uploaders delete own files"
  ON task_files FOR DELETE
  USING (uploaded_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────
-- 7. TRIGGER — notify assignees when a task is created
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_task        tasks%ROWTYPE;
  v_assignee    RECORD;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = NEW.task_id;

  FOR v_assignee IN
    SELECT user_id FROM task_assignments WHERE task_id = NEW.task_id
  LOOP
    IF v_assignee.user_id <> auth.uid() THEN
      INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
      VALUES (
        v_assignee.user_id,
        v_task.workspace_id,
        'task_assigned',
        'You have been assigned a task',
        v_task.title,
        CONCAT('/user/task-details/', v_task.id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_task_assigned
  AFTER INSERT ON task_assignments
  FOR EACH ROW EXECUTE FUNCTION notify_task_assigned();

-- ─────────────────────────────────────────────────────────────────
-- 8. TRIGGER — notify assignees when a comment is added
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_task_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_assignee   RECORD;
  v_author     profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_author FROM profiles WHERE id = NEW.author_id;

  FOR v_assignee IN
    SELECT user_id FROM task_assignments WHERE task_id = NEW.task_id
  LOOP
    IF v_assignee.user_id <> NEW.author_id THEN
      INSERT INTO notifications (user_id, workspace_id, type, title, body, link)
      VALUES (
        v_assignee.user_id,
        NEW.workspace_id,
        'task_comment',
        CONCAT(v_author.name, ' commented on a task'),
        LEFT(NEW.content, 100),
        CONCAT('/user/task-details/', NEW.task_id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_task_comment
  AFTER INSERT ON task_comments
  FOR EACH ROW EXECUTE FUNCTION notify_task_comment();
