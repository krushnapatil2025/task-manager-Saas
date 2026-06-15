import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WorkspaceContext } from "../../context/WorkspaceContext";
import { UserContext } from "../../context/userContext";
import { LuBuilding2, LuArrowRight, LuLoaderCircle } from "react-icons/lu";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// CreateWorkspace — admin-only onboarding page for creating a new workspace.
// Employees, interns, and managers are redirected away immediately.
// ─────────────────────────────────────────────────────────────────────────────

const CreateWorkspace = () => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { createWorkspace } = useContext(WorkspaceContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  // Hard guard: only company admins and managers can create workspaces
  useEffect(() => {
    if (!user) return;
    const canCreate =
      user.role === 'admin' ||
      user.job_profile === 'company_admin' ||
      user.job_profile === 'manager';
    if (!canCreate) {
      navigate('/user/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Workspace name is required.");
      return;
    }
    if (name.trim().length < 3) {
      setError("Name must be at least 3 characters.");
      return;
    }

    setLoading(true);
    try {
      await createWorkspace(name.trim());
      toast.success(`Workspace "${name.trim()}" created! 🎉`);

      if (user?.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/user/dashboard");
      }
    } catch (err) {
      console.error("Create workspace error:", err);
      setError(err.message || "Failed to create workspace. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-indigo-900 to-purple-900 flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
              <LuBuilding2 className="text-white text-3xl" />
            </div>
            <h1 className="text-2xl font-bold text-white text-center">
              Create your Workspace
            </h1>
            <p className="text-sm text-white/60 text-center mt-2">
              A workspace is a shared space where you and your team manage tasks together.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Workspace Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp, My Team..."
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                autoFocus
              />
              {name.trim() && (
                <p className="text-xs text-white/50 mt-1.5">
                  Slug:{" "}
                  <span className="text-blue-300 font-mono">
                    {name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}
                  </span>
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-500/15 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <LuLoaderCircle className="animate-spin text-lg" />
                  Creating...
                </>
              ) : (
                <>
                  Create Workspace
                  <LuArrowRight className="text-lg" />
                </>
              )}
            </button>
          </form>

          {/* Footer hint */}
          <p className="text-xs text-white/40 text-center mt-6">
            You can rename your workspace or add more later in Settings.
          </p>
        </div>

        {/* Welcome message */}
        <p className="text-center text-white/50 text-sm mt-6">
          Welcome, <span className="text-white/80 font-medium">{user?.name}</span>! Let's get started.
        </p>
      </div>
    </div>
  );
};

export default CreateWorkspace;
