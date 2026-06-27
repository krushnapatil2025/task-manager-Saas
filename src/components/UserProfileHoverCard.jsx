import React, { useState, useEffect } from 'react';
import { LuMail, LuMessageSquare, LuBriefcase, LuBuilding, LuActivity } from 'react-icons/lu';
import { supabase } from '../utils/supabaseClient';

const STATUS_MAP = {
  active: { label: 'Online', dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
  away: { label: 'Away', dot: 'bg-amber-450', bg: 'bg-amber-500/10', text: 'text-amber-600' },
  busy: { label: 'Do Not Disturb', dot: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-650' },
  inactive: { label: 'Offline', dot: 'bg-slate-400', bg: 'bg-slate-500/10', text: 'text-slate-500' }
};

const UserProfileHoverCard = ({ userId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, profile_image_url, role, department, status, status_emoji, status_text, status_expires_at, dnd_until')
          .eq('id', userId)
          .single();
        
        if (active && !error && data) {
          setProfile(data);
        }
      } catch (err) {
        console.error('Error fetching card profile:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchProfile();
    return () => { active = false; };
  }, [userId]);

  if (loading) {
    return (
      <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-100/90 rounded-2xl shadow-xl p-4 z-50 flex items-center justify-center min-h-[120px] backdrop-blur-md">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Syncing Profile...</span>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isDnd = profile.dnd_until && new Date(profile.dnd_until) > new Date();
  const isStatusActive = profile.status_text && (!profile.status_expires_at || new Date(profile.status_expires_at) > new Date());
  
  const statusInfo = isDnd 
    ? { label: 'Do Not Disturb', dot: 'bg-rose-500', bg: 'bg-rose-500/10', text: 'text-rose-650' }
    : (STATUS_MAP[profile.status] || STATUS_MAP.inactive);

  const handleSendDM = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const event = new CustomEvent('select-dm-user', { 
      detail: { userId: profile.id, name: profile.name } 
    });
    window.dispatchEvent(event);
    if (onClose) onClose();
  };

  return (
    <div 
      className="absolute bottom-full left-0 mb-2.5 w-68 bg-white/95 border border-slate-200/60 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-fade-in-up"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Visual Header/Banner Accent */}
      <div className="h-12 bg-gradient-to-r from-indigo-500/80 via-purple-500/80 to-pink-500/80" />
 
      {/* Avatar block with negative margin */}
      <div className="px-4 pb-4 pt-0 relative -mt-6">
        <div className="flex items-end justify-between mb-3">
          <div className="relative">
            {profile.profile_image_url ? (
              <img 
                src={profile.profile_image_url} 
                alt={profile.name} 
                className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-md bg-white"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-lg flex items-center justify-center border-2 border-white shadow-md">
                {profile.name[0].toUpperCase()}
              </div>
            )}
            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${statusInfo.dot}`} />
          </div>
 
          {/* Status Badge */}
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${statusInfo.bg} ${statusInfo.text} border border-transparent`}>
            {statusInfo.label}
          </span>
        </div>
 
        {/* User Info */}
        <h4 className="font-extrabold text-slate-800 text-sm truncate leading-tight">{profile.name}</h4>

        {isStatusActive && (
          <div className="flex items-center gap-1.5 mt-1 bg-slate-50/80 border border-slate-100 p-1.5 rounded-lg max-w-full">
            <span className="text-xs select-none">{profile.status_emoji || '🟢'}</span>
            <span className="text-[10px] text-slate-550 truncate italic font-medium" title={profile.status_text}>
              "{profile.status_text}"
            </span>
          </div>
        )}
        
        <div className="mt-3.5 space-y-2 border-t border-slate-100 pt-3">
          {/* DND status message block */}
          {isDnd && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50/50 p-1.5 rounded-lg border border-amber-100/50">
              <LuBellOff size={11} className="text-amber-500 flex-shrink-0" />
              <span className="font-bold text-[9px] tracking-wide uppercase">DND Active</span>
            </div>
          )}

          {/* Workspace Role */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <LuBriefcase size={12} className="text-slate-400" />
            <span className="font-medium text-[11px] truncate">
              {profile.role === 'admin' ? 'Company Admin' : 'Team Member'}
            </span>
          </div>
 
          {/* Department */}
          {profile.department && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <LuBuilding size={12} className="text-slate-400" />
              <span className="font-medium text-[11px] truncate">{profile.department}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <button 
          onClick={handleSendDM}
          className="mt-4 w-full bg-indigo-600 hover:bg-indigo-750 text-white py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 hover:shadow-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <LuMessageSquare size={13} />
          <span>Message</span>
        </button>
      </div>
    </div>
  );
};

export default UserProfileHoverCard;
