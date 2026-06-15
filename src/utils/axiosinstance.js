import { supabase } from "./supabaseClient";
import excelJS from "exceljs";

// Helper: Normalize task object from Supabase to match the expected format on frontend
const normalizeTask = (task) => ({
  _id:         task.id,
  title:       task.title,
  description: task.description,
  priority:    task.priority,
  status:      task.status,
  dueDate:     task.due_date,
  attachments: task.attachments || [],
  progress:    task.progress || 0,
  createdBy:   task.created_by,
  createdAt:   task.created_at,
  updatedAt:   task.updated_at,
  assignedTo: (task.task_assignments || []).map((a) => ({
    _id:             a.profiles?.id,
    name:            a.profiles?.name,
    email:           a.profiles?.email,
    profileImageUrl: a.profiles?.profile_image_url,
  })),
  todoChecklist: (task.todo_checklist || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      _id:       item.id,
      title:     item.title,
      completed: item.completed,
    })),
  completedTodoCount: (task.todo_checklist || []).filter((i) => i.completed).length,
});

// Helper: Get user details from public profiles table
const fetchUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return error ? null : data;
};

// Helper: Sync Task assignments
const syncAssignments = async (taskId, userIds) => {
  await supabase.from("task_assignments").delete().eq("task_id", taskId);
  if (userIds && userIds.length > 0) {
    const rows = userIds.map((uid) => ({ task_id: taskId, user_id: uid }));
    const { error } = await supabase.from("task_assignments").insert(rows);
    if (error) throw error;
  }
};

// Helper: Sync Task checklist
const syncChecklist = async (taskId, items) => {
  await supabase.from("todo_checklist").delete().eq("task_id", taskId);
  if (items && items.length > 0) {
    const rows = items.map((item, index) => ({
      task_id: taskId,
      title: item.title,
      completed: item.completed || false,
      sort_order: index,
    }));
    const { error } = await supabase.from("todo_checklist").insert(rows);
    if (error) throw error;
  }
};

// Define interceptor function that mimics Axios
const mockAxios = {
  get: async (url, config = {}) => {
    try {
      // 1. GET USER PROFILE
      if (url === "/api/auth/profile") {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) throw new Error("Unauthorized");
        const profile = await fetchUserProfile(user.id);
        return {
          status: 200,
          data: {
            _id: user.id,
            name: profile?.name || user.email.split("@")[0],
            email: user.email,
            profileImageUrl: profile?.profile_image_url || null,
            role: profile?.role || "member",
          }
        };
      }

      // 2. GET ALL USERS (ADMIN)
      if (url === "/api/users") {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return {
          status: 200,
          data: (data || []).map((p) => ({
            _id: p.id,
            name: p.name,
            profileImageUrl: p.profile_image_url,
            role: p.role,
            createdAt: p.created_at,
          }))
        };
      }

      // 3. GET SINGLE USER BY ID
      if (url.startsWith("/api/users/")) {
        const userId = url.split("/").pop();
        const profile = await fetchUserProfile(userId);
        if (!profile) throw new Error("User not found");
        return {
          status: 200,
          data: {
            _id: profile.id,
            name: profile.name,
            profileImageUrl: profile.profile_image_url,
            role: profile.role,
            createdAt: profile.created_at,
          }
        };
      }

      // 4. GET TASKS
      if (url === "/api/tasks") {
        const { data: { user } } = await supabase.auth.getUser();
        const profile = await fetchUserProfile(user.id);
        const statusFilter = config.params?.status;

        let query = supabase
          .from("tasks")
          .select(`
            *,
            task_assignments ( user_id, profiles ( id, name, email, profile_image_url ) ),
            todo_checklist ( id, title, completed, sort_order )
          `)
          .order("created_at", { ascending: false });

        if (statusFilter) {
          query = query.eq("status", statusFilter);
        }

        if (profile?.role !== "admin") {
          const { data: userAsg } = await supabase
            .from("task_assignments")
            .select("task_id")
            .eq("user_id", user.id);
          const taskIds = (userAsg || []).map((a) => a.task_id);
          if (taskIds.length === 0) {
            return {
              status: 200,
              data: { tasks: [], statusSummary: { all: 0, pendingTasks: 0, inProgressTasks: 0, completedTasks: 0 } }
            };
          }
          query = query.in("id", taskIds);
        }

        const { data: tasks, error } = await query;
        if (error) throw error;

        const normalized = (tasks || []).map(normalizeTask);

        // Fetch counts for summary
        let allCountQuery = supabase.from("tasks").select("id", { count: "exact", head: true });
        let pCountQuery = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "Pending");
        let iCountQuery = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "In Progress");
        let cCountQuery = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "Completed");

        if (profile?.role !== "admin") {
          const { data: userAsg } = await supabase.from("task_assignments").select("task_id").eq("user_id", user.id);
          const taskIds = (userAsg || []).map((a) => a.task_id);
          allCountQuery = allCountQuery.in("id", taskIds);
          pCountQuery = pCountQuery.in("id", taskIds);
          iCountQuery = iCountQuery.in("id", taskIds);
          cCountQuery = cCountQuery.in("id", taskIds);
        }

        const [allC, pendingC, inProgressC, completedC] = await Promise.all([
          allCountQuery,
          pCountQuery,
          iCountQuery,
          cCountQuery
        ]);

        return {
          status: 200,
          data: {
            tasks: normalized,
            statusSummary: {
              all: allC.count || 0,
              pendingTasks: pendingC.count || 0,
              inProgressTasks: inProgressC.count || 0,
              completedTasks: completedC.count || 0
            }
          }
        };
      }

      // 5. GET SINGLE TASK BY ID
      if (url.startsWith("/api/tasks/") && !url.includes("dashboard-data")) {
        const taskId = url.split("/").pop();
        const { data: task, error } = await supabase
          .from("tasks")
          .select(`
            *,
            task_assignments ( user_id, profiles ( id, name, email, profile_image_url ) ),
            todo_checklist ( id, title, completed, sort_order )
          `)
          .eq("id", taskId)
          .single();

        if (error || !task) throw new Error("Task not found");
        return {
          status: 200,
          data: normalizeTask(task)
        };
      }

      // 6. GET ADMIN DASHBOARD DATA
      if (url === "/api/tasks/dashboard-data") {
        const [
          { count: totalTasks },
          { count: pendingTasks },
          { count: completedTasks },
          { count: overdueTasks },
          { data: statusRaw },
          { data: priorityRaw },
          { data: recentTasks }
        ] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "Pending"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "Completed"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "Completed").lt("due_date", new Date().toISOString()),
          supabase.from("tasks").select("status"),
          supabase.from("tasks").select("priority"),
          supabase.from("tasks").select("id, title, status, priority, due_date, created_at").order("created_at", { ascending: false }).limit(10)
        ]);

        const taskDistribution = ["Pending", "In Progress", "Completed"].reduce((acc, s) => {
          acc[s.replace(/\s+/g, "")] = (statusRaw || []).filter((t) => t.status === s).length;
          return acc;
        }, { All: totalTasks || 0 });

        const taskPriorityLevels = ["low", "medium", "high"].reduce((acc, p) => {
          acc[p] = (priorityRaw || []).filter((t) => t.priority === p).length;
          return acc;
        }, {});

        return {
          status: 200,
          data: {
            statistics: { totalTasks, pendingTasks, completedTasks, overdueTasks },
            charts: { taskDistribution, taskPriorityLevels },
            recentTasks: (recentTasks || []).map((t) => ({
              _id: t.id, title: t.title, status: t.status, priority: t.priority,
              dueDate: t.due_date, createdAt: t.created_at,
            }))
          }
        };
      }

      // 7. GET USER DASHBOARD DATA
      if (url === "/api/tasks/user-dashboard-data") {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: asgn } = await supabase.from("task_assignments").select("task_id").eq("user_id", user.id);
        const taskIds = (asgn || []).map((a) => a.task_id);

        if (taskIds.length === 0) {
          return {
            status: 200,
            data: {
              statistics: { totalTasks: 0, pendingTasks: 0, completedTasks: 0, overdueTasks: 0 },
              charts: { taskDistribution: { All: 0, Pending: 0, InProgress: 0, Completed: 0 }, taskPriorityLevels: { low: 0, medium: 0, high: 0 } },
              recentTasks: []
            }
          };
        }

        const [
          { count: totalTasks },
          { count: pendingTasks },
          { count: completedTasks },
          { count: overdueTasks },
          { data: statusRaw },
          { data: priorityRaw },
          { data: recentTasks }
        ] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }).in("id", taskIds),
          supabase.from("tasks").select("*", { count: "exact", head: true }).in("id", taskIds).eq("status", "Pending"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).in("id", taskIds).eq("status", "Completed"),
          supabase.from("tasks").select("*", { count: "exact", head: true }).in("id", taskIds).neq("status", "Completed").lt("due_date", new Date().toISOString()),
          supabase.from("tasks").select("status").in("id", taskIds),
          supabase.from("tasks").select("priority").in("id", taskIds),
          supabase.from("tasks").select("id, title, status, priority, due_date, created_at").in("id", taskIds).order("created_at", { ascending: false }).limit(10)
        ]);

        const taskDistribution = ["Pending", "In Progress", "Completed"].reduce((acc, s) => {
          acc[s.replace(/\s+/g, "")] = (statusRaw || []).filter((t) => t.status === s).length;
          return acc;
        }, { All: totalTasks || 0 });

        const taskPriorityLevels = ["low", "medium", "high"].reduce((acc, p) => {
          acc[p] = (priorityRaw || []).filter((t) => t.priority === p).length;
          return acc;
        }, {});

        return {
          status: 200,
          data: {
            statistics: { totalTasks, pendingTasks, completedTasks, overdueTasks },
            charts: { taskDistribution, taskPriorityLevels },
            recentTasks: (recentTasks || []).map((t) => ({
              _id: t.id, title: t.title, status: t.status, priority: t.priority,
              dueDate: t.due_date, createdAt: t.created_at,
            }))
          }
        };
      }

      // 8. REPORT: EXPORT TASKS
      if (url === "/api/report/export/tasks") {
        const { data: tasks } = await supabase
          .from("tasks")
          .select(`id, title, description, priority, status, due_date, created_at, task_assignments ( profiles ( name, email ) )`)
          .order("created_at", { ascending: false });

        const workbook = new excelJS.Workbook();
        const worksheet = workbook.addWorksheet("Tasks Report");

        worksheet.columns = [
          { header: "Task ID", key: "id", width: 38 },
          { header: "Title", key: "title", width: 30 },
          { header: "Description", key: "description", width: 50 },
          { header: "Priority", key: "priority", width: 12 },
          { header: "Status", key: "status", width: 18 },
          { header: "Due Date", key: "dueDate", width: 18 },
          { header: "Assigned To", key: "assignedTo", width: 40 },
        ];

        (tasks || []).forEach((task) => {
          const assigned = (task.task_assignments || [])
            .map((a) => `${a.profiles?.name} (${a.profiles?.email})`)
            .join(", ") || "Unassigned";

          worksheet.addRow({
            id: task.id,
            title: task.title,
            description: task.description || "",
            priority: task.priority,
            status: task.status,
            dueDate: new Date(task.due_date).toISOString().split("T")[0],
            assignedTo: assigned,
          });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = "tasks_report.xlsx";
        a.click();
        return { status: 200, data: { success: true } };
      }

      // 9. REPORT: EXPORT USERS
      if (url === "/api/report/export/users") {
        const { data: profiles } = await supabase.from("profiles").select("id, name");
        const { data: tasks } = await supabase.from("tasks").select("id, status, task_assignments(user_id)");

        const map = {};
        (profiles || []).forEach((p) => {
          map[p.id] = { name: p.name, taskCount: 0, pendingTasks: 0, inProgressTasks: 0, completedTasks: 0 };
        });

        (tasks || []).forEach((task) => {
          (task.task_assignments || []).forEach(({ user_id }) => {
            if (!map[user_id]) return;
            map[user_id].taskCount++;
            if (task.status === "Pending") map[user_id].pendingTasks++;
            if (task.status === "In Progress") map[user_id].inProgressTasks++;
            if (task.status === "Completed") map[user_id].completedTasks++;
          });
        });

        const workbook = new excelJS.Workbook();
        const worksheet = workbook.addWorksheet("User Task Report");

        worksheet.columns = [
          { header: "User Name", key: "name", width: 30 },
          { header: "Total Tasks", key: "taskCount", width: 14 },
          { header: "Pending Tasks", key: "pendingTasks", width: 16 },
          { header: "In Progress Tasks", key: "inProgressTasks", width: 20 },
          { header: "Completed Tasks", key: "completedTasks", width: 18 },
        ];

        Object.values(map).forEach((row) => worksheet.addRow(row));

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = "users_report.xlsx";
        a.click();
        return { status: 200, data: { success: true } };
      }

      throw new Error(`Endpoint GET ${url} not implemented`);
    } catch (err) {
      console.error("mockAxios.get error:", err);
      const statusCode = err.message === "Unauthorized" ? 401 : 400;
      throw { response: { status: statusCode, data: { message: err.message || "Failed" } } };
    }
  },

  post: async (url, data, config = {}) => {
    try {
      // 1. REGISTER USER
      if (url === "/api/auth/register") {
        const { name, email, password, profileImageUrl, adminInviteToken } = data;
        const role = (adminInviteToken && adminInviteToken === "change_this_to_a_strong_secret") ? "admin" : "member";

        // Create user in Supabase Auth.
        // The DB trigger `on_auth_user_created` (SECURITY DEFINER) automatically
        // inserts the row into public.profiles — no manual upsert needed.
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, role, profileImageUrl: profileImageUrl || null } }
        });
        if (authErr) throw authErr;

        // If the trigger already created the profile, optionally update avatar url
        if (profileImageUrl && authData.user) {
          await supabase
            .from("profiles")
            .update({ profile_image_url: profileImageUrl })
            .eq("id", authData.user.id);
        }

        // Wait briefly then fetch the profile the trigger created
        const profile = await fetchUserProfile(authData.user.id);

        return {
          status: 201,
          data: {
            _id: authData.user.id,
            name: profile?.name || name,
            email: authData.user.email,
            profileImageUrl: profile?.profile_image_url || profileImageUrl || null,
            role: profile?.role || role,
            token: authData.session?.access_token || "auth-session-signed-up"
          }
        };
      }

      // 2. LOGIN USER
      if (url === "/api/auth/login") {
        const { email, password } = data;
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        if (authErr) throw authErr;

        const profile = await fetchUserProfile(authData.user.id);
        return {
          status: 200,
          data: {
            _id: authData.user.id,
            name: profile?.name || authData.user.email.split("@")[0],
            email: authData.user.email,
            profileImageUrl: profile?.profile_image_url || null,
            role: profile?.role || "member",
            token: authData.session.access_token
          }
        };
      }

      // 3. CREATE TASK (ADMIN ONLY)
      if (url === "/api/tasks") {
        const { title, description, priority, assignedTo, dueDate, attachments, todoChecklist } = data;
        const { data: { user } } = await supabase.auth.getUser();

        const { data: task, error: taskErr } = await supabase
          .from("tasks")
          .insert({
            title,
            description,
            priority,
            due_date: dueDate,
            attachments: attachments || [],
            created_by: user.id
          })
          .select()
          .single();
        if (taskErr) throw taskErr;

        await Promise.all([
          syncAssignments(task.id, assignedTo),
          syncChecklist(task.id, todoChecklist)
        ]);

        const { data: fullTask } = await supabase
          .from("tasks")
          .select(`*, task_assignments ( user_id, profiles ( id, name, email, profile_image_url ) ), todo_checklist ( id, title, completed, sort_order )`)
          .eq("id", task.id)
          .single();

        return {
          status: 201,
          data: {
            message: "Task created successfully",
            task: normalizeTask(fullTask)
          }
        };
      }

      throw new Error(`Endpoint POST ${url} not implemented`);
    } catch (err) {
      console.error("mockAxios.post error:", err);
      const isAuthErr = err.status === 400 || err.status === 401 || err.message?.includes("credentials") || err.message?.includes("email");
      const statusCode = isAuthErr ? 401 : 400;
      throw { response: { status: statusCode, data: { message: err.message || "Failed" } } };
    }
  },

  put: async (url, data, config = {}) => {
    try {
      // 1. UPDATE PROFILE
      if (url === "/api/auth/profile") {
        const { name, profileImageUrl } = data;
        const { data: { user } } = await supabase.auth.getUser();

        const { data: profile, error } = await supabase
          .from("profiles")
          .update({
            name,
            profile_image_url: profileImageUrl
          })
          .eq("id", user.id)
          .select()
          .single();

        if (error) throw error;

        return {
          status: 200,
          data: {
            _id: user.id,
            name: profile.name,
            email: user.email,
            profileImageUrl: profile.profile_image_url,
            role: profile.role,
            token: localStorage.getItem("token")
          }
        };
      }

      // 2. UPDATE TASK (ADMIN ONLY)
      if (url.startsWith("/api/tasks/") && !url.endsWith("/status") && !url.endsWith("/todo")) {
        const taskId = url.split("/").pop();
        const { title, description, priority, status, dueDate, assignedTo, attachments, todoChecklist } = data;

        const updatePayload = {};
        if (title !== undefined) updatePayload.title = title;
        if (description !== undefined) updatePayload.description = description;
        if (priority !== undefined) updatePayload.priority = priority;
        if (status !== undefined) updatePayload.status = status;
        if (dueDate !== undefined) updatePayload.due_date = dueDate;
        if (attachments !== undefined) updatePayload.attachments = attachments;

        const { error: updateErr } = await supabase.from("tasks").update(updatePayload).eq("id", taskId);
        if (updateErr) throw updateErr;

        const ops = [];
        if (Array.isArray(assignedTo)) ops.push(syncAssignments(taskId, assignedTo));
        if (Array.isArray(todoChecklist)) ops.push(syncChecklist(taskId, todoChecklist));
        if (ops.length > 0) await Promise.all(ops);

        const { data: fullTask } = await supabase
          .from("tasks")
          .select(`*, task_assignments ( user_id, profiles ( id, name, email, profile_image_url ) ), todo_checklist ( id, title, completed, sort_order )`)
          .eq("id", taskId)
          .single();

        return {
          status: 200,
          data: {
            message: "Task updated successfully",
            updatedTask: normalizeTask(fullTask)
          }
        };
      }

      // 3. UPDATE TASK STATUS
      if (url.startsWith("/api/tasks/") && url.endsWith("/status")) {
        const taskId = url.split("/")[3];
        const { status } = data;
        const updates = { status };

        if (status === "Completed") {
          updates.progress = 100;
          await supabase.from("todo_checklist").update({ completed: true }).eq("task_id", taskId);
        }

        const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
        if (error) throw error;

        const { data: fullTask } = await supabase
          .from("tasks")
          .select(`*, task_assignments ( user_id, profiles ( id, name, email, profile_image_url ) ), todo_checklist ( id, title, completed, sort_order )`)
          .eq("id", taskId)
          .single();

        return {
          status: 200,
          data: {
            message: "Task status updated successfully",
            task: normalizeTask(fullTask)
          }
        };
      }

      // 4. UPDATE TASK CHECKLIST (TODO)
      if (url.startsWith("/api/tasks/") && url.endsWith("/todo")) {
        const taskId = url.split("/")[3];
        const { todoChecklist } = data;

        await syncChecklist(taskId, todoChecklist);

        const completedCount = todoChecklist.filter((i) => i.completed).length;
        const total = todoChecklist.length;
        const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;
        const status = progress === 100 ? "Completed" : progress > 0 ? "In Progress" : "Pending";

        await supabase.from("tasks").update({ progress, status }).eq("id", taskId);

        const { data: fullTask } = await supabase
          .from("tasks")
          .select(`*, task_assignments ( user_id, profiles ( id, name, email, profile_image_url ) ), todo_checklist ( id, title, completed, sort_order )`)
          .eq("id", taskId)
          .single();

        return {
          status: 200,
          data: {
            message: "Task checklist updated successfully",
            task: normalizeTask(fullTask)
          }
        };
      }

      throw new Error(`Endpoint PUT ${url} not implemented`);
    } catch (err) {
      console.error("mockAxios.put error:", err);
      throw { response: { status: 400, data: { message: err.message || "Failed" } } };
    }
  },

  delete: async (url, config = {}) => {
    try {
      // 1. DELETE TASK
      if (url.startsWith("/api/tasks/")) {
        const taskId = url.split("/").pop();
        const { error } = await supabase.from("tasks").delete().eq("id", taskId);
        if (error) throw error;
        return {
          status: 200,
          data: { message: "Task deleted successfully" }
        };
      }

      throw new Error(`Endpoint DELETE ${url} not implemented`);
    } catch (err) {
      console.error("mockAxios.delete error:", err);
      throw { response: { status: 400, data: { message: err.message || "Failed" } } };
    }
  }
};

export default mockAxios;