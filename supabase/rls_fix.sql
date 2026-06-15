-- ============================================================
-- STEP 1: Drop the old broken trigger and recreate it properly
--         (includes profile_image_url, SECURITY DEFINER bypasses RLS)
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, profile_image_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    NEW.raw_user_meta_data->>'profileImageUrl'
  )
  ON CONFLICT (id) DO UPDATE SET
    name             = EXCLUDED.name,
    role             = EXCLUDED.role,
    profile_image_url = EXCLUDED.profile_image_url;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- STEP 2: Fix RLS policies on profiles
--         (Drop old restrictive policies, add correct ones)
-- ============================================================
DROP POLICY IF EXISTS "Users can read own profile"     ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"   ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile"   ON profiles;
DROP POLICY IF EXISTS "Authenticated users read all"   ON profiles;

-- Any authenticated user can READ all profiles
-- (needed for user lists, task assignment dropdowns, etc.)
CREATE POLICY "Authenticated users read all profiles"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can only UPDATE their own profile row
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can INSERT their own profile row
-- (safety net in case the trigger fires slightly late)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ============================================================
-- STEP 3: Fix RLS policies on tasks, task_assignments,
--         and todo_checklist so authenticated users can CRUD
-- ============================================================

-- ── tasks ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users manage tasks"   ON tasks;
DROP POLICY IF EXISTS "Authenticated users read tasks"     ON tasks;

CREATE POLICY "Authenticated users read tasks"
  ON tasks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users insert tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users update tasks"
  ON tasks FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users delete tasks"
  ON tasks FOR DELETE
  USING (auth.role() = 'authenticated');


-- ── task_assignments ─────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users manage task_assignments" ON task_assignments;

CREATE POLICY "Authenticated users read assignments"
  ON task_assignments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users insert assignments"
  ON task_assignments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users delete assignments"
  ON task_assignments FOR DELETE
  USING (auth.role() = 'authenticated');


-- ── todo_checklist ───────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users manage todo_checklist" ON todo_checklist;

CREATE POLICY "Authenticated users read checklist"
  ON todo_checklist FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users insert checklist"
  ON todo_checklist FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users update checklist"
  ON todo_checklist FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users delete checklist"
  ON todo_checklist FOR DELETE
  USING (auth.role() = 'authenticated');
