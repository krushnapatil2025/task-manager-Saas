-- =============================================================================
-- DATABASE SECURITY UPDATE: Secure All Tables with Row Level Security (RLS)
-- Run this in: Supabase Dashboard → SQL Editor
--
-- This script:
-- 1. Enables RLS on all 18 database tables.
-- 2. Defines helper functions that query tables securely (SECURITY DEFINER)
--    to prevent infinite recursion and check user permissions/roles correctly.
-- 3. Drops any legacy/broad/insecure policies.
-- 4. Deploys strict multi-tenant constraints enforcing Manager, Employee,
--    and Intern access controls.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Re-create Helper Functions (Bypass RLS securely via SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. get_my_workspace_ids: Get all workspace IDs the caller belongs to.
CREATE OR REPLACE FUNCTION get_my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id
  FROM   workspace_members
  WHERE  user_id = auth.uid();
$$;

-- 2. is_company_admin: Check if the caller is the owner/company admin of the workspace.
CREATE OR REPLACE FUNCTION is_company_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   workspace_members
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
      AND  role         = 'company_admin'
  );
$$;

-- 3. is_workspace_admin: Check if the caller is a Manager or Company Admin.
CREATE OR REPLACE FUNCTION is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   workspace_members
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
      AND  role         IN ('company_admin', 'manager')
  );
$$;

-- 4. has_write_access: Check if caller has write access (Company Admin, Manager, or Employee).
--    Interns have read-only access and will return false.
CREATE OR REPLACE FUNCTION has_write_access(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   workspace_members
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
      AND  role         IN ('company_admin', 'manager', 'employee')
  );
$$;

-- 5. is_task_assignee: Check if caller is assigned to the task.
CREATE OR REPLACE FUNCTION is_task_assignee(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   task_assignments
    WHERE  task_id = p_task_id
      AND  user_id = auth.uid()
  );
$$;



-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Enable Row Level Security (RLS) on all 18 Tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_checklist        ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_files            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_overrides  ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys              ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: Purge Legacy Policies and Apply Secure Multi-Tenant Rules
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. PROFILES
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users read all profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users read all" ON profiles;
DROP POLICY IF EXISTS "Profiles select policy" ON profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON profiles;
DROP POLICY IF EXISTS "Profiles insert policy" ON profiles;

CREATE POLICY "Profiles select policy" ON profiles FOR SELECT
  USING (
    auth.uid() = id 
    OR id IN (
      SELECT user_id FROM workspace_members 
      WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

CREATE POLICY "Profiles update policy" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles insert policy" ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- 2. WORKSPACES
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Members can read their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace admins can update workspace" ON workspaces;
DROP POLICY IF EXISTS "Workspace admins can delete workspace" ON workspaces;
DROP POLICY IF EXISTS "Company admins update workspace" ON workspaces;
DROP POLICY IF EXISTS "Company admins delete workspace" ON workspaces;
DROP POLICY IF EXISTS "Workspaces select policy" ON workspaces;
DROP POLICY IF EXISTS "Workspaces insert policy" ON workspaces;
DROP POLICY IF EXISTS "Workspaces update policy" ON workspaces;
DROP POLICY IF EXISTS "Workspaces delete policy" ON workspaces;

CREATE POLICY "Workspaces select policy" ON workspaces FOR SELECT
  USING (id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "Workspaces insert policy" ON workspaces FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Workspaces update policy" ON workspaces FOR UPDATE
  USING (is_workspace_admin(id));

CREATE POLICY "Workspaces delete policy" ON workspaces FOR DELETE
  USING (is_company_admin(id));


-- 3. WORKSPACE_MEMBERS
DROP POLICY IF EXISTS "Members can read workspace_members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can insert workspace_members" ON workspace_members;
DROP POLICY IF EXISTS "Admins or self can delete workspace_members" ON workspace_members;
DROP POLICY IF EXISTS "Company admins insert workspace_members" ON workspace_members;
DROP POLICY IF EXISTS "Company admins or self delete workspace_members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace members select policy" ON workspace_members;
DROP POLICY IF EXISTS "Workspace members insert policy" ON workspace_members;
DROP POLICY IF EXISTS "Workspace members update policy" ON workspace_members;
DROP POLICY IF EXISTS "Workspace members delete policy" ON workspace_members;

CREATE POLICY "Workspace members select policy" ON workspace_members FOR SELECT
  USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "Workspace members insert policy" ON workspace_members FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id) OR auth.uid() = user_id);

CREATE POLICY "Workspace members update policy" ON workspace_members FOR UPDATE
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "Workspace members delete policy" ON workspace_members FOR DELETE
  USING (user_id = auth.uid() OR is_workspace_admin(workspace_id));


-- 4. TASKS
DROP POLICY IF EXISTS "Authenticated users read tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users insert tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users update tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users delete tasks" ON tasks;
DROP POLICY IF EXISTS "Workspace members read tasks" ON tasks;
DROP POLICY IF EXISTS "Workspace admins create tasks" ON tasks;
DROP POLICY IF EXISTS "Workspace admins update tasks" ON tasks;
DROP POLICY IF EXISTS "Workspace admins delete tasks" ON tasks;
DROP POLICY IF EXISTS "Admins and managers create tasks" ON tasks;
DROP POLICY IF EXISTS "Admins and managers update tasks" ON tasks;
DROP POLICY IF EXISTS "Company admins delete tasks" ON tasks;
DROP POLICY IF EXISTS "Assigned members update task status" ON tasks;
DROP POLICY IF EXISTS "Tasks select policy" ON tasks;
DROP POLICY IF EXISTS "Tasks insert policy" ON tasks;
DROP POLICY IF EXISTS "Tasks update policy" ON tasks;
DROP POLICY IF EXISTS "Tasks delete policy" ON tasks;

CREATE POLICY "Tasks select policy" ON tasks FOR SELECT
  USING (workspace_id IN (SELECT get_my_workspace_ids()) OR workspace_id IS NULL);

CREATE POLICY "Tasks insert policy" ON tasks FOR INSERT
  WITH CHECK (has_write_access(workspace_id));

CREATE POLICY "Tasks update policy" ON tasks FOR UPDATE
  USING (
    has_write_access(workspace_id) 
    OR is_task_assignee(id)
  );

CREATE POLICY "Tasks delete policy" ON tasks FOR DELETE
  USING (is_workspace_admin(workspace_id));


-- 5. TASK_ASSIGNMENTS
DROP POLICY IF EXISTS "Authenticated users read assignments" ON task_assignments;
DROP POLICY IF EXISTS "Authenticated users insert assignments" ON task_assignments;
DROP POLICY IF EXISTS "Authenticated users delete assignments" ON task_assignments;
DROP POLICY IF EXISTS "Authenticated users manage task_assignments" ON task_assignments;
DROP POLICY IF EXISTS "Assignments select policy" ON task_assignments;
DROP POLICY IF EXISTS "Assignments insert policy" ON task_assignments;
DROP POLICY IF EXISTS "Assignments delete policy" ON task_assignments;

CREATE POLICY "Assignments select policy" ON task_assignments FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE workspace_id IN (SELECT get_my_workspace_ids()) OR workspace_id IS NULL
    )
  );

CREATE POLICY "Assignments insert policy" ON task_assignments FOR INSERT
  WITH CHECK (
    task_id IN (SELECT id FROM tasks WHERE has_write_access(workspace_id))
  );

CREATE POLICY "Assignments delete policy" ON task_assignments FOR DELETE
  USING (
    task_id IN (SELECT id FROM tasks WHERE has_write_access(workspace_id))
  );


-- 6. TODO_CHECKLIST
DROP POLICY IF EXISTS "Authenticated users read checklist" ON todo_checklist;
DROP POLICY IF EXISTS "Authenticated users insert checklist" ON todo_checklist;
DROP POLICY IF EXISTS "Authenticated users update checklist" ON todo_checklist;
DROP POLICY IF EXISTS "Authenticated users delete checklist" ON todo_checklist;
DROP POLICY IF EXISTS "Authenticated users manage todo_checklist" ON todo_checklist;
DROP POLICY IF EXISTS "Checklist select policy" ON todo_checklist;
DROP POLICY IF EXISTS "Checklist insert policy" ON todo_checklist;
DROP POLICY IF EXISTS "Checklist update policy" ON todo_checklist;
DROP POLICY IF EXISTS "Checklist delete policy" ON todo_checklist;

CREATE POLICY "Checklist select policy" ON todo_checklist FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE workspace_id IN (SELECT get_my_workspace_ids()) OR workspace_id IS NULL
    )
  );

CREATE POLICY "Checklist insert policy" ON todo_checklist FOR INSERT
  WITH CHECK (
    task_id IN (SELECT id FROM tasks WHERE has_write_access(workspace_id))
  );

CREATE POLICY "Checklist update policy" ON todo_checklist FOR UPDATE
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE has_write_access(workspace_id) 
         OR is_task_assignee(id)
    )
  );

CREATE POLICY "Checklist delete policy" ON todo_checklist FOR DELETE
  USING (
    task_id IN (SELECT id FROM tasks WHERE has_write_access(workspace_id))
  );


-- 7. TASK_COMMENTS
DROP POLICY IF EXISTS "Workspace members read comments" ON task_comments;
DROP POLICY IF EXISTS "Workspace members add comments" ON task_comments;
DROP POLICY IF EXISTS "Authors edit own comments" ON task_comments;
DROP POLICY IF EXISTS "Authors delete own comments" ON task_comments;
DROP POLICY IF EXISTS "Comments select policy" ON task_comments;
DROP POLICY IF EXISTS "Comments insert policy" ON task_comments;
DROP POLICY IF EXISTS "Comments update policy" ON task_comments;
DROP POLICY IF EXISTS "Comments delete policy" ON task_comments;

CREATE POLICY "Comments select policy" ON task_comments FOR SELECT
  USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "Comments insert policy" ON task_comments FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT get_my_workspace_ids()) 
    AND author_id = auth.uid()
  );

CREATE POLICY "Comments update policy" ON task_comments FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "Comments delete policy" ON task_comments FOR DELETE
  USING (author_id = auth.uid() OR is_workspace_admin(workspace_id));


-- 8. TASK_FILES
DROP POLICY IF EXISTS "Workspace members read files" ON task_files;
DROP POLICY IF EXISTS "Workspace members upload files" ON task_files;
DROP POLICY IF EXISTS "Uploaders delete own files" ON task_files;
DROP POLICY IF EXISTS "Files select policy" ON task_files;
DROP POLICY IF EXISTS "Files insert policy" ON task_files;
DROP POLICY IF EXISTS "Files delete policy" ON task_files;

CREATE POLICY "Files select policy" ON task_files FOR SELECT
  USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "Files insert policy" ON task_files FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT get_my_workspace_ids()) 
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Files delete policy" ON task_files FOR DELETE
  USING (uploaded_by = auth.uid() OR is_workspace_admin(workspace_id));


-- 9. NOTIFICATIONS
DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role inserts notifications" ON notifications;
DROP POLICY IF EXISTS "Users mark own notifications read" ON notifications;
DROP POLICY IF EXISTS "Notifications select policy" ON notifications;
DROP POLICY IF EXISTS "Notifications insert policy" ON notifications;
DROP POLICY IF EXISTS "Notifications update policy" ON notifications;
DROP POLICY IF EXISTS "Notifications delete policy" ON notifications;

CREATE POLICY "Notifications select policy" ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Notifications insert policy" ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Notifications update policy" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Notifications delete policy" ON notifications FOR DELETE
  USING (user_id = auth.uid());


-- 10. TEAMS
DROP POLICY IF EXISTS "Workspace members read teams" ON teams;
DROP POLICY IF EXISTS "Admins and managers create teams" ON teams;
DROP POLICY IF EXISTS "Admins and managers update teams" ON teams;
DROP POLICY IF EXISTS "Company admins delete teams" ON teams;
DROP POLICY IF EXISTS "Teams select policy" ON teams;
DROP POLICY IF EXISTS "Teams insert policy" ON teams;
DROP POLICY IF EXISTS "Teams update policy" ON teams;
DROP POLICY IF EXISTS "Teams delete policy" ON teams;

CREATE POLICY "Teams select policy" ON teams FOR SELECT
  USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "Teams insert policy" ON teams FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY "Teams update policy" ON teams FOR UPDATE
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "Teams delete policy" ON teams FOR DELETE
  USING (is_workspace_admin(workspace_id));


-- 11. TEAM_MEMBERS
DROP POLICY IF EXISTS "Workspace members read team_members" ON team_members;
DROP POLICY IF EXISTS "Admins and managers manage team_members" ON team_members;
DROP POLICY IF EXISTS "Team members select policy" ON team_members;
DROP POLICY IF EXISTS "Team members all policy" ON team_members;

CREATE POLICY "Team members select policy" ON team_members FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM teams 
      WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

CREATE POLICY "Team members all policy" ON team_members FOR ALL
  USING (
    team_id IN (
      SELECT id FROM teams 
      WHERE is_workspace_admin(workspace_id)
    )
  );


-- 12. EMPLOYEE_INVITATIONS
DROP POLICY IF EXISTS "Admins and HR read employee_invitations" ON employee_invitations;
DROP POLICY IF EXISTS "Admins and HR create employee_invitations" ON employee_invitations;
DROP POLICY IF EXISTS "Admins and HR update employee_invitations" ON employee_invitations;
DROP POLICY IF EXISTS "Employee invitations select policy" ON employee_invitations;
DROP POLICY IF EXISTS "Employee invitations insert policy" ON employee_invitations;
DROP POLICY IF EXISTS "Employee invitations update policy" ON employee_invitations;
DROP POLICY IF EXISTS "Employee invitations delete policy" ON employee_invitations;

CREATE POLICY "Employee invitations select policy" ON employee_invitations FOR SELECT
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "Employee invitations insert policy" ON employee_invitations FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY "Employee invitations update policy" ON employee_invitations FOR UPDATE
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "Employee invitations delete policy" ON employee_invitations FOR DELETE
  USING (is_workspace_admin(workspace_id));


-- 13. WORKSPACE_INVITATIONS
DROP POLICY IF EXISTS "Admins can create invitations" ON workspace_invitations;
DROP POLICY IF EXISTS "Admins can read own workspace invitations" ON workspace_invitations;
DROP POLICY IF EXISTS "Admins can delete invitations" ON workspace_invitations;
DROP POLICY IF EXISTS "Admins and HR create workspace invitations" ON workspace_invitations;
DROP POLICY IF EXISTS "Admins and HR read workspace invitations" ON workspace_invitations;
DROP POLICY IF EXISTS "Admins and HR delete workspace invitations" ON workspace_invitations;
DROP POLICY IF EXISTS "Accept invitation by token" ON workspace_invitations;
DROP POLICY IF EXISTS "Workspace invitations select policy" ON workspace_invitations;
DROP POLICY IF EXISTS "Workspace invitations insert policy" ON workspace_invitations;
DROP POLICY IF EXISTS "Workspace invitations update policy" ON workspace_invitations;
DROP POLICY IF EXISTS "Workspace invitations delete policy" ON workspace_invitations;

CREATE POLICY "Workspace invitations select policy" ON workspace_invitations FOR SELECT
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "Workspace invitations insert policy" ON workspace_invitations FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY "Workspace invitations update policy" ON workspace_invitations FOR UPDATE
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Workspace invitations delete policy" ON workspace_invitations FOR DELETE
  USING (is_workspace_admin(workspace_id));


-- 14. PERMISSION_OVERRIDES
DROP POLICY IF EXISTS "Company admins manage permission_overrides" ON permission_overrides;
DROP POLICY IF EXISTS "Users read own permission_overrides" ON permission_overrides;
DROP POLICY IF EXISTS "Overrides select policy" ON permission_overrides;
DROP POLICY IF EXISTS "Overrides all policy" ON permission_overrides;

CREATE POLICY "Overrides select policy" ON permission_overrides FOR SELECT
  USING (user_id = auth.uid() OR is_workspace_admin(workspace_id));

CREATE POLICY "Overrides all policy" ON permission_overrides FOR ALL
  USING (is_workspace_admin(workspace_id));


-- 15. API_KEYS
DROP POLICY IF EXISTS "Workspace admins manage api_keys" ON api_keys;
DROP POLICY IF EXISTS "API keys select policy" ON api_keys;
DROP POLICY IF EXISTS "API keys all policy" ON api_keys;

CREATE POLICY "API keys select policy" ON api_keys FOR SELECT
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "API keys all policy" ON api_keys FOR ALL
  USING (is_workspace_admin(workspace_id));


-- 16. WEBHOOKS
DROP POLICY IF EXISTS "Workspace admins manage webhooks" ON webhooks;
DROP POLICY IF EXISTS "Workspace members read webhooks" ON webhooks;
DROP POLICY IF EXISTS "Webhooks select policy" ON webhooks;
DROP POLICY IF EXISTS "Webhooks all policy" ON webhooks;

CREATE POLICY "Webhooks select policy" ON webhooks FOR SELECT
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "Webhooks all policy" ON webhooks FOR ALL
  USING (is_workspace_admin(workspace_id));


-- 17. WEBHOOK_DELIVERIES
DROP POLICY IF EXISTS "Workspace admins read deliveries" ON webhook_deliveries;
DROP POLICY IF EXISTS "Webhook deliveries select policy" ON webhook_deliveries;
DROP POLICY IF EXISTS "Webhook deliveries all policy" ON webhook_deliveries;

CREATE POLICY "Webhook deliveries select policy" ON webhook_deliveries FOR SELECT
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "Webhook deliveries all policy" ON webhook_deliveries FOR ALL
  USING (is_workspace_admin(workspace_id));


-- 18. AUDIT_LOGS
DROP POLICY IF EXISTS "Workspace admins read audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Audit logs select policy" ON audit_logs;

CREATE POLICY "Audit logs select policy" ON audit_logs FOR SELECT
  USING (is_workspace_admin(workspace_id));
