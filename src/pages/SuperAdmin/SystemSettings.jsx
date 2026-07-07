import React, { useEffect, useState } from 'react';
import { getPlatformSettings, updatePlatformSetting } from '../../services/superAdminService';
import {
  LuSettings, LuLoaderCircle, LuLock, LuGlobe,
  LuMail, LuSave, LuUsers, LuBrain, LuFolder, LuLayoutGrid
} from 'react-icons/lu';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// SystemSettings — Full platform control panel for Super Admins (Phase 7)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  // Platform Identity
  platform_name: 'Strideo',
  support_email: 'support@Strideo.com',
  sender_name: 'Strideo Notifications',
  // Registration Control
  allow_new_registrations: true,
  auto_approve_registrations: false,
  // Per-plan user limits
  max_users_free: 5,
  max_users_pro: 50,
  max_users_enterprise: 500,
  // Feature Flags
  feature_ai_assistant: true,
  feature_google_drive: false,
  feature_public_boards: true,
};

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 flex-shrink-0 cursor-pointer ${value ? 'bg-indigo-500' : 'bg-slate-800'
      }`}
  >
    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${value ? 'translate-x-6' : 'translate-x-0'
      }`} />
  </button>
);

const SystemSettings = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getPlatformSettings();
        // Merge db values over defaults — JSON booleans stored as JSONB need parsing
        const merged = { ...DEFAULT_SETTINGS };
        Object.entries(data).forEach(([k, v]) => {
          if (typeof DEFAULT_SETTINGS[k] === 'boolean') {
            merged[k] = v === true || v === 'true';
          } else if (typeof DEFAULT_SETTINGS[k] === 'number') {
            merged[k] = Number(v) || DEFAULT_SETTINGS[k];
          } else {
            merged[k] = v ?? DEFAULT_SETTINGS[k];
          }
        });
        setSettings(merged);
      } catch (err) {
        toast.error('Failed to load system settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(settings).map(([key, val]) => updatePlatformSetting(key, val))
      );
      toast.success('Platform configuration saved!');
    } catch (err) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">

      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <LuSettings className="text-orange-500" /> Platform Configuration
          </h1>
          <p className="text-slate-400 text-xs mt-1">Configure global policies, feature availability, and platform-wide parameters</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <LuLoaderCircle className="text-red-500 text-3xl animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Section 1: Platform Identity ── */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-5">
            <h2 className="text-xs font-black text-white uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
              <LuGlobe className="text-amber-400" /> Platform & Brand Identity
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'platform_name', label: 'Platform Display Name', icon: LuGlobe, placeholder: 'e.g. Strideo', type: 'text' },
                { key: 'support_email', label: 'Platform Support Email', icon: LuMail, placeholder: 'e.g. support@Strideo.com', type: 'email' },
                { key: 'sender_name', label: 'Email Sender Name', icon: LuMail, placeholder: 'e.g. Strideo Notifications', type: 'text' },
              ].map(({ key, label, icon: Icon, placeholder, type }) => (
                <div key={key} className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{label}</label>
                  <div className="relative">
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                    <input
                      type={type}
                      required
                      value={settings[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-850 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-700 transition"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 2: Registration Control ── */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-5">
            <h2 className="text-xs font-black text-white uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
              <LuLock className="text-indigo-400" /> Registration & Approval Policy
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start justify-between gap-4 bg-slate-950/40 border border-slate-850 p-4 rounded-xl">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-200">Allow New Company Registrations</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Disable to put the platform in maintenance or invitation-only mode.
                  </p>
                </div>
                <Toggle value={!!settings.allow_new_registrations} onChange={(v) => handleChange('allow_new_registrations', v)} />
              </div>

              <div className="flex items-start justify-between gap-4 bg-slate-950/40 border border-slate-850 p-4 rounded-xl">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-200">Auto-Approve Registrations</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Skip the approval queue — new workspaces activate instantly with Free plan.
                  </p>
                </div>
                <Toggle value={!!settings.auto_approve_registrations} onChange={(v) => handleChange('auto_approve_registrations', v)} />
              </div>
            </div>
          </div>

          {/* ── Section 3: Plan User Limits ── */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-5">
            <h2 className="text-xs font-black text-white uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
              <LuUsers className="text-emerald-400" /> Maximum Users Per Workspace Plan
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'max_users_free', label: 'Free Trial', color: 'text-indigo-400 border-indigo-500/20' },
                { key: 'max_users_pro', label: 'Professional', color: 'text-amber-400  border-amber-500/20' },
                { key: 'max_users_enterprise', label: 'Enterprise', color: 'text-emerald-400 border-emerald-500/20' },
              ].map(({ key, label, color }) => (
                <div key={key} className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-wider block ${color.split(' ')[0]}`}>{label} Plan</label>
                  <div className={`flex items-center border ${color.split(' ')[1]} bg-slate-950/40 rounded-xl overflow-hidden`}>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={settings[key]}
                      onChange={(e) => handleChange(key, parseInt(e.target.value, 10) || 1)}
                      className="w-full px-4 py-2.5 bg-transparent text-xs text-white placeholder:text-slate-600 focus:outline-none font-bold"
                    />
                    <span className="pr-3 text-[10px] text-slate-500 font-bold whitespace-nowrap">users</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">These limits control the maximum workspace member count enforced at invite time.</p>
          </div>

          {/* ── Section 4: Feature Flags ── */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-5">
            <h2 className="text-xs font-black text-white uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
              <LuLayoutGrid className="text-purple-400" /> Platform Feature Flags
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  key: 'feature_ai_assistant',
                  label: 'AI Assistant',
                  icon: LuBrain,
                  desc: 'Enable the AI task assistant for workspace users.',
                },
                {
                  key: 'feature_google_drive',
                  label: 'Google Drive Integration',
                  icon: LuFolder,
                  desc: 'Allow file attachments via Google Drive in task panels.',
                },
                {
                  key: 'feature_public_boards',
                  label: 'Public Shared Boards',
                  icon: LuLayoutGrid,
                  desc: 'Allow teams to share read-only board links externally.',
                },
              ].map(({ key, label, icon: Icon, desc }) => (
                <div key={key} className="flex items-start justify-between gap-4 bg-slate-950/40 border border-slate-850 p-4 rounded-xl">
                  <div className="space-y-1 flex-1">
                    <p className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <Icon className="text-purple-400 text-sm" /> {label}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                  <Toggle value={!!settings[key]} onChange={(v) => handleChange(key, v)} />
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 active:scale-95 text-white text-xs font-black px-6 py-3 rounded-xl transition-all shadow-md shadow-red-500/20 cursor-pointer"
            >
              {saving ? <LuLoaderCircle className="text-sm animate-spin" /> : <LuSave className="text-sm" />}
              Save All Settings
            </button>
          </div>

        </form>
      )}
    </div>
  );
};

export default SystemSettings;
