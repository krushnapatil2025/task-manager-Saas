import React, { useState, useContext, useEffect } from 'react';
import {
  LuSettings, LuBell, LuPhone, LuPalette, LuShield, LuUser,
  LuCircleCheck, LuSun, LuMoon, LuMonitor, LuVolume2,
  LuVolumeX, LuLoaderCircle, LuSave, LuBuilding2, LuTrash2,
  LuPlus
} from 'react-icons/lu';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { UserContext } from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { supabase } from '../utils/supabaseClient';
import { useTheme } from '../context/ThemeContext';
import { useBrand } from '../context/BrandContext';
import { NOTIFICATION_SOUNDS, playNotificationSound } from '../utils/audioSynthesizer';
import { uploadFileToGoogleDrive } from '../services/chatService';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────
const useSetting = (key, defaultVal) => {
  const [val, setValState] = useState(() => {
    const stored = localStorage.getItem(key);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return stored ?? defaultVal;
  });
  const set = (v) => { setValState(v); localStorage.setItem(key, String(v)); };
  return [val, set];
};

const STATUS_OPTIONS = [
  { id: 'active',   label: 'Active',         color: '#22c55e', dot: 'bg-emerald-500' },
  { id: 'away',     label: 'Away',           color: '#f59e0b', dot: 'bg-amber-400' },
  { id: 'busy',     label: 'Do Not Disturb', color: '#ef4444', dot: 'bg-red-500' },
  { id: 'inactive', label: 'Invisible',      color: '#94a3b8', dot: 'bg-slate-400' }
];

const Toggle = ({ checked, onChange, label, desc, brandColor = '#6366f1' }) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
    <div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      {desc && <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>}
    </div>
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{ backgroundColor: checked ? brandColor : undefined }}
      className={`relative w-10 h-5.5 h-[22px] rounded-full transition-colors cursor-pointer flex-shrink-0 ${checked ? '' : 'bg-slate-200'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`} />
    </button>
  </div>
);

const SectionCard = ({ title, icon: Icon, children, brandColor = '#6366f1' }) => (
  <div className="card shadow-sm mb-0 bg-white rounded-2xl border border-slate-150 p-6">
    <h3 className="font-extrabold text-sm text-slate-800 mb-5 flex items-center gap-2">
      <Icon size={16} style={{ color: brandColor }} /> {title}
    </h3>
    {children}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const Settings = () => {
  const { user, updateUser } = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);
  const { theme, setTheme } = useTheme();
  const { brand, updateBrand, resetBrand, BRAND_COLORS } = useBrand();

  const isAdmin = user?.role === 'admin' || user?.job_profile === 'company_admin';
  const tabs = [
    { id: 'profile',       label: 'Profile & Status', icon: LuUser },
    { id: 'notifications', label: 'Notifications',    icon: LuBell },
    { id: 'appearance',    label: 'Appearance',       icon: LuPalette },
    { id: 'privacy',       label: 'Privacy & Security', icon: LuShield },
    ...(isAdmin ? [{ id: 'brand', label: 'Brand Config', icon: LuBuilding2 }] : []),
  ];

  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);

  // Profile
  const [name, setName] = useState(user?.name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [currentStatus, setCurrentStatus] = useState(() => localStorage.getItem('user_status') || 'active');

  // Brand local states for instant feel
  const [brandName, setBrandName] = useState(brand.companyName);
  const [brandLogo, setBrandLogo] = useState(brand.companyLogo);
  const [selectedColor, setSelectedColor] = useState(brand.brandColor);
  const [brandSaving, setBrandSaving] = useState(false);

  // Keep local state in sync if brand loads async from Supabase
  useEffect(() => {
    setBrandName(brand.companyName);
    setBrandLogo(brand.companyLogo);
    setSelectedColor(brand.brandColor);
  }, [brand.companyName, brand.companyLogo, brand.brandColor]);

  // Notification settings
  const [notifMessages, setNotifMessages] = useSetting('notif_messages', true);
  const [notifMentions, setNotifMentions] = useSetting('notif_mentions', true);
  const [notifTasks, setNotifTasks] = useSetting('notif_tasks', true);
  const [notifSound, setNotifSound] = useSetting('setting_notif_sound', 'chime');
  const [soundEnabled, setSoundEnabled] = useSetting('sound_enabled', true);

  // Privacy
  const [showStatus, setShowStatus] = useSetting('privacy_show_status', true);
  const [readReceipts, setReadReceipts] = useSetting('privacy_read_receipts', true);
  const [activityLog, setActivityLog] = useSetting('privacy_activity', true);

  const handleSaveProfile = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        name: name.trim(), department: department.trim(), status: currentStatus
      }).eq('id', user.id);
      if (error) throw error;
      await updateUser();
      localStorage.setItem('user_status', currentStatus);
      toast.success('Profile saved!');
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleNotifSoundSelect = (id) => {
    setNotifSound(id);
    playNotificationSound(id);
  };

  // Save company name to Supabase (called on button click, not on each keystroke)
  const handleSaveCompanyName = async () => {
    setBrandSaving(true);
    try {
      await updateBrand({ companyName: brandName.trim() || brand.companyName });
      toast.success('Company name saved! All users will see the update.');
    } catch { toast.error('Failed to save company name'); }
    finally { setBrandSaving(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error('Logo must be under 1 MB');
      return;
    }
    
    const localUrl = URL.createObjectURL(file);
    setBrandLogo(localUrl);
    setBrandSaving(true);
    
    try {
      const res = await uploadFileToGoogleDrive(file);
      if (res && res.url) {
        const driveUrl = res.url.split('||')[1] || res.url;
        setBrandLogo(driveUrl);
        await updateBrand({ companyLogo: driveUrl });
        toast.success('Logo uploaded to Google Drive! All users will see the update.');
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save logo to Google Drive');
      setBrandLogo(brand.companyLogo);
    } finally {
      setBrandSaving(false);
    }
  };

  const handleClearLogo = async () => {
    setBrandLogo(null);
    setBrandSaving(true);
    try {
      await updateBrand({ companyLogo: null });
      toast.success('Logo cleared for all users.');
    } catch { toast.error('Failed to clear logo'); }
    finally { setBrandSaving(false); }
  };

  const handleColorSelect = async (c) => {
    setSelectedColor(c.hex);
    setBrandSaving(true);
    try {
      await updateBrand({
        brandColor:      c.hex,
        brandColorLight: c.light,
        brandColorText:  c.text,
        brandColorName:  c.name,
      });
      toast.success(`Theme "${c.name}" applied for all workspace users!`);
    } catch { toast.error('Failed to apply theme'); }
    finally { setBrandSaving(false); }
  };

  const handleCustomColorChange = (hexVal) => {
    setSelectedColor(hexVal);
    if (/^#[0-9A-F]{6}$/i.test(hexVal)) {
      // Debounce: apply locally immediately, save on blur/enter
      updateBrand({
        brandColor:      hexVal,
        brandColorLight: hexVal + '10',
        brandColorText:  hexVal,
        brandColorName:  'Custom',
      });
    }
  };

  return (
    <DashboardLayout activeMenu="Settings">
      <div className="max-w-4xl mx-auto animate-fade-in mt-2">

        {/* Page title */}
        <div className="mb-6 flex items-center gap-3">
          <div 
            style={{ backgroundColor: brand.brandColorLight, color: brand.brandColor }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
          >
            <LuSettings size={20} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">Settings</h1>
            <p className="text-xs text-slate-400 font-bold">Customize your experience across {brand.companyName}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* ── Sidebar tabs ─────────────────────────────────────────── */}
          <nav className="w-full md:w-48 flex-shrink-0 space-y-1">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={isActive ? { backgroundColor: brand.brandColor } : {}}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                    isActive ? 'text-white shadow-md shadow-slate-100' : 'text-slate-650 hover:bg-slate-100/70 hover:text-slate-850'
                  }`}
                >
                  <tab.icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* ── Tab panels ──────────────────────────────────────────── */}
          <div className="flex-1 space-y-5 min-w-0">

            {/* ── Profile & Status ─────────────────────────────────── */}
            {activeTab === 'profile' && (
              <>
                <SectionCard title="Personal Information" icon={LuUser} brandColor={brand.brandColor}>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Full Name</label>
                      <input className="form-input mt-1 w-full px-3 py-2 text-xs font-bold text-slate-700 bg-white rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-all" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Department</label>
                      <input className="form-input mt-1 w-full px-3 py-2 text-xs font-semibold text-slate-700 bg-white rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-all" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" />
                    </div>
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Email</label>
                      <p className="text-xs text-slate-600 font-bold bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">{user?.email}</p>
                    </div>
                    <button onClick={handleSaveProfile} disabled={saving}
                      style={{ backgroundColor: brand.brandColor }}
                      className="flex items-center gap-2 px-5 py-2.5 hover:opacity-90 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-60 shadow-md">
                      {saving ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuSave size={14} />}
                      Save Profile
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Presence Status" icon={LuCircleCheck} brandColor={brand.brandColor}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {STATUS_OPTIONS.map(s => {
                      const isStatusActive = currentStatus === s.id;
                      return (
                        <button key={s.id} onClick={() => setCurrentStatus(s.id)}
                          style={isStatusActive ? { borderColor: brand.brandColor, backgroundColor: brand.brandColorLight } : {}}
                          className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                            isStatusActive ? 'shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                          }`}>
                          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${s.dot} shadow-sm`} />
                          <div>
                            <p className="text-xs font-extrabold text-slate-750">{s.label}</p>
                          </div>
                          {isStatusActive && <LuCircleCheck size={14} style={{ color: brand.brandColor }} className="ml-auto flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={handleSaveProfile} disabled={saving}
                    style={{ backgroundColor: brand.brandColor }}
                    className="mt-4 flex items-center gap-2 px-4 py-2 hover:opacity-90 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-60">
                    {saving ? <LuLoaderCircle size={13} className="animate-spin" /> : <LuSave size={13} />}
                    Save Status
                  </button>
                </SectionCard>
              </>
            )}

            {/* ── Notifications ─────────────────────────────────────── */}
            {activeTab === 'notifications' && (
              <>
                <SectionCard title="Notification Types" icon={LuBell} brandColor={brand.brandColor}>
                  <Toggle checked={notifMessages} onChange={setNotifMessages} label="New Messages" desc="Get notified for all new channel messages" brandColor={brand.brandColor} />
                  <Toggle checked={notifMentions} onChange={setNotifMentions} label="Mentions & @replies" desc="Only when someone mentions you" brandColor={brand.brandColor} />
                  <Toggle checked={notifTasks} onChange={setNotifTasks} label="Task Updates" desc="Assignments, due dates, status changes" brandColor={brand.brandColor} />
                  <Toggle checked={soundEnabled} onChange={setSoundEnabled} label="Sound Alerts" desc="Play notification sounds" brandColor={brand.brandColor} />
                </SectionCard>

                <SectionCard title="Notification Sound" icon={LuVolume2} brandColor={brand.brandColor}>
                  <p className="text-[11px] text-slate-400 font-bold mb-3">Click any sound to preview it.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {NOTIFICATION_SOUNDS.map(s => {
                      const isSoundActive = notifSound === s.id;
                      return (
                        <button key={s.id} onClick={() => handleNotifSoundSelect(s.id)}
                          style={isSoundActive ? { borderColor: brand.brandColor, backgroundColor: brand.brandColorLight } : {}}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                            isSoundActive ? 'text-slate-800' : 'border-slate-100 hover:border-slate-200 text-slate-600 bg-slate-50/50'
                          }`}>
                          <LuVolume2 size={12} style={isSoundActive ? { color: brand.brandColor } : {}} className={isSoundActive ? '' : 'text-slate-400'} />
                          {s.name}
                          {isSoundActive && <LuCircleCheck size={12} style={{ color: brand.brandColor }} className="ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── Appearance ────────────────────────────────────────── */}
            {activeTab === 'appearance' && (
              <SectionCard title="Theme" icon={LuPalette} brandColor={brand.brandColor}>
                <p className="text-xs text-slate-400 font-bold mb-4">Choose how {brand.companyName} looks on your device.</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'light', label: 'Light', icon: LuSun },
                    { id: 'dark',  label: 'Dark',  icon: LuMoon },
                    { id: 'system',label: 'System',icon: LuMonitor },
                  ].map(opt => {
                    const isThemeActive = theme === opt.id;
                    return (
                      <button key={opt.id} onClick={() => setTheme(opt.id)}
                        style={isThemeActive ? { borderColor: brand.brandColor, backgroundColor: brand.brandColorLight } : {}}
                        className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 text-center cursor-pointer transition-all ${
                          isThemeActive ? 'shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                        }`}>
                        <opt.icon size={22} style={isThemeActive ? { color: brand.brandColor } : {}} className={isThemeActive ? '' : 'text-slate-400'} />
                        <span className="text-xs font-bold" style={isThemeActive ? { color: brand.brandColorText } : { color: '#475569' }}>{opt.label}</span>
                        {isThemeActive && <LuCircleCheck size={14} style={{ color: brand.brandColor }} />}
                      </button>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* ── Privacy & Security ────────────────────────────────── */}
            {activeTab === 'privacy' && (
              <>
                <SectionCard title="Privacy Controls" icon={LuShield} brandColor={brand.brandColor}>
                  <Toggle checked={showStatus} onChange={setShowStatus} label="Show Online Status" desc="Let workspace members see when you're online" brandColor={brand.brandColor} />
                  <Toggle checked={readReceipts} onChange={setReadReceipts} label="Read Receipts" desc="Allow others to see when you've read messages" brandColor={brand.brandColor} />
                  <Toggle checked={activityLog} onChange={setActivityLog} label="Activity Tracking" desc="Include your activity in workspace insights" brandColor={brand.brandColor} />
                </SectionCard>

                <SectionCard title="Account Security" icon={LuShield} brandColor={brand.brandColor}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div>
                        <p className="text-xs font-bold text-slate-700">Connected Account</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{user?.email}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <LuCircleCheck size={11} /> Verified
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div>
                        <p className="text-xs font-bold text-slate-700">Workspace</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{workspace?.name || 'Loading…'}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full text-[10px] font-bold" style={{ color: brand.brandColorText, backgroundColor: brand.brandColorLight }}>
                        {user?.job_profile?.replace('_', ' ') || 'Member'}
                      </span>
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── Brand Config ──────────────────────────────────────── */}
            {activeTab === 'brand' && isAdmin && (
              <>
                {/* Workspace-wide info banner */}
                <div style={{ backgroundColor: brand.brandColorLight, borderColor: brand.brandColor + '40' }} className="flex items-center gap-3 px-4 py-3 rounded-2xl border mb-1">
                  <span style={{ color: brand.brandColor }} className="text-lg flex-shrink-0">🌐</span>
                  <div>
                    <p style={{ color: brand.brandColorText }} className="text-xs font-extrabold">Workspace-Wide Settings</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                      Changes you make here apply to <strong>all users</strong> in your workspace — employees, interns, managers — in real-time.
                    </p>
                  </div>
                  {brandSaving && (
                    <LuLoaderCircle size={16} style={{ color: brand.brandColor }} className="ml-auto flex-shrink-0 animate-spin" />
                  )}
                </div>

                <SectionCard title="Brand Identity" icon={LuBuilding2} brandColor={brand.brandColor}>
                  <div className="space-y-5">
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Company Name</label>
                      <div className="flex gap-2">
                        <input 
                          className="flex-1 px-3 py-2 text-xs font-bold text-slate-700 bg-white rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-all" 
                          value={brandName} 
                          onChange={e => setBrandName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveCompanyName()}
                          placeholder="e.g. Acme Corp" 
                        />
                        <button
                          onClick={handleSaveCompanyName}
                          disabled={brandSaving}
                          style={{ backgroundColor: brand.brandColor }}
                          className="flex items-center gap-1 px-4 py-2 text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-60 transition cursor-pointer flex-shrink-0"
                        >
                          {brandSaving ? <LuLoaderCircle size={13} className="animate-spin" /> : <LuSave size={13} />}
                          Save
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Shown in sidebar and navbar for all workspace users.</p>
                    </div>

                    <div>
                      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Company Logo</label>
                      <div className="flex items-center gap-5 bg-slate-50/50 border border-slate-100 p-4 rounded-2xl">
                        <div className="relative w-16 h-16 bg-white border border-slate-250 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
                          {brandLogo ? (
                            <img src={brandLogo} alt="Logo Preview" className="w-full h-full object-contain p-1" />
                          ) : (
                            <div className="text-[20px] font-black text-slate-350" style={{ color: brand.brandColor }}>
                              {brandName?.[0]?.toUpperCase() || 'T'}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition inline-block">
                              Choose File
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleLogoUpload} 
                              />
                            </label>
                            {brandLogo && (
                              <button 
                                type="button"
                                onClick={handleClearLogo}
                                className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs px-3 py-2 rounded-xl transition cursor-pointer"
                              >
                                <LuTrash2 size={12} /> Clear
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold">
                            Suggested format: square PNG or SVG, max size 1MB.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Brand Theme Color" icon={LuPalette} brandColor={brand.brandColor}>
                  <p className="text-xs text-slate-400 font-bold mb-4">
                    Choose your main workspace accent color. This will change active side menu highlights, buttons, and other accent elements.
                  </p>
                  
                  {/* Curated Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-5">
                    {BRAND_COLORS.map(c => {
                      const isColorActive = selectedColor.toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => handleColorSelect(c)}
                          style={isColorActive ? { borderColor: brand.brandColor, backgroundColor: brand.brandColorLight } : {}}
                          className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all cursor-pointer relative ${
                            isColorActive 
                              ? 'shadow-sm' 
                              : 'border-slate-100 hover:border-slate-200 bg-white'
                          }`}
                        >
                          <span 
                            className="w-6 h-6 rounded-full shadow-inner border border-black/5" 
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-[10px] font-bold text-slate-700">{c.name}</span>
                          {isColorActive && <LuCircleCheck size={12} style={{ color: brand.brandColor }} className="absolute -top-1 -right-1 bg-white rounded-full shadow" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Hex Input */}
                  <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Custom Brand Color</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">Enter a hex color code to set a custom color.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg shadow-sm border border-slate-250" style={{ backgroundColor: selectedColor }} />
                      <input 
                        type="text" 
                        value={selectedColor} 
                        onChange={e => handleCustomColorChange(e.target.value)} 
                        placeholder="#6366F1" 
                        className="w-28 text-center text-xs font-bold font-mono tracking-wider px-3 py-2 bg-white rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-all" 
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* Reset button */}
                <div className="flex justify-between items-center bg-slate-50/50 border border-slate-100 p-4 rounded-2xl">
                  <div>
                    <h4 className="text-xs font-bold text-slate-750">Reset Brand Configuration</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Revert all brand settings back to their default Strideo configuration.</p>
                  </div>
                  <button
                    type="button"
                    disabled={brandSaving}
                    onClick={async () => {
                      setBrandSaving(true);
                      try {
                        await resetBrand();
                        setBrandName('Strideo');
                        setBrandLogo(null);
                        setSelectedColor('#6366f1');
                        toast.success('Brand reset for all workspace users!');
                      } catch { toast.error('Reset failed'); }
                      finally { setBrandSaving(false); }
                    }}
                    className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-60"
                  >
                    Reset Defaults
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
