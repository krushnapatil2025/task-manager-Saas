import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// BrandContext — workspace-level brand config stored in Supabase
// Loaded by every user on app boot; admin can update; changes propagate live
// via Supabase Realtime to all connected users in the workspace.
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND_COLORS = [
  { name: 'Indigo',  hex: '#6366f1', light: '#eef2ff', text: '#4338ca', ring: '#818cf8' },
  { name: 'Violet',  hex: '#7c3aed', light: '#f5f3ff', text: '#5b21b6', ring: '#a78bfa' },
  { name: 'Purple',  hex: '#9333ea', light: '#faf5ff', text: '#6b21a8', ring: '#c084fc' },
  { name: 'Blue',    hex: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', ring: '#60a5fa' },
  { name: 'Cyan',    hex: '#06b6d4', light: '#ecfeff', text: '#0e7490', ring: '#22d3ee' },
  { name: 'Teal',    hex: '#14b8a6', light: '#f0fdfa', text: '#0f766e', ring: '#2dd4bf' },
  { name: 'Emerald', hex: '#10b981', light: '#ecfdf5', text: '#047857', ring: '#34d399' },
  { name: 'Rose',    hex: '#f43f5e', light: '#fff1f2', text: '#be123c', ring: '#fb7185' },
  { name: 'Orange',  hex: '#f97316', light: '#fff7ed', text: '#c2410c', ring: '#fb923c' },
  { name: 'Amber',   hex: '#f59e0b', light: '#fffbeb', text: '#b45309', ring: '#fbbf24' },
  { name: 'Slate',   hex: '#64748b', light: '#f8fafc', text: '#334155', ring: '#94a3b8' },
  { name: 'Zinc',    hex: '#71717a', light: '#fafafa', text: '#3f3f46', ring: '#a1a1aa' },
];

const DEFAULT_BRAND = {
  companyName:      'TaskFlow',
  companyLogo:      null,
  brandColor:       '#6366f1',
  brandColorLight:  '#eef2ff',
  brandColorText:   '#4338ca',
  brandColorName:   'Indigo',
};

// ── Apply all CSS variables to :root ─────────────────────────────────────────
const applyCSSVariables = (config) => {
  const root = document.documentElement;
  const hex  = config.brandColor || DEFAULT_BRAND.brandColor;

  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);

  root.style.setProperty('--brand',          hex);
  root.style.setProperty('--brand-bg',       config.brandColorLight || DEFAULT_BRAND.brandColorLight);
  root.style.setProperty('--brand-text',     config.brandColorText  || DEFAULT_BRAND.brandColorText);
  root.style.setProperty('--brand-border',   `rgba(${r},${g},${b},0.35)`);
  root.style.setProperty('--brand-ring',     `rgba(${r},${g},${b},0.25)`);
  root.style.setProperty('--brand-hover',    `rgba(${r},${g},${b},0.08)`);
  root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 70%, #7c3aed 30%))`);
};

// ── Map a Supabase workspace row → brand config object ───────────────────────
const mapWorkspaceToBrand = (ws) => ({
  companyName:     ws.company_name || ws.name || DEFAULT_BRAND.companyName,
  companyLogo:     ws.logo_url     || null,
  brandColor:      ws.brand_color       || DEFAULT_BRAND.brandColor,
  brandColorLight: ws.brand_color_light || DEFAULT_BRAND.brandColorLight,
  brandColorText:  ws.brand_color_text  || DEFAULT_BRAND.brandColorText,
  brandColorName:  ws.brand_color_name  || DEFAULT_BRAND.brandColorName,
});

// ─────────────────────────────────────────────────────────────────────────────
export const BrandContext = createContext();

export const BrandProvider = ({ children }) => {
  const [brand, setBrandState]   = useState(DEFAULT_BRAND);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [loading, setLoading]    = useState(true);
  const realtimeChannel          = useRef(null);

  // ── detectWorkspace: Fetches branding from DB for the user's workspace ───────
  const detectWorkspace = useCallback(async (userId) => {
    if (!userId) {
      setWorkspaceId(null);
      setBrandState(DEFAULT_BRAND);
      applyCSSVariables(DEFAULT_BRAND);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: memberships, error } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(id, name, logo_url, brand_color, brand_color_light, brand_color_text, brand_color_name, company_name)')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (error || !memberships?.workspaces) {
        setWorkspaceId(null);
        setBrandState(DEFAULT_BRAND);
        applyCSSVariables(DEFAULT_BRAND);
        return;
      }

      const ws = memberships.workspaces;
      setWorkspaceId(ws.id);

      const mapped = mapWorkspaceToBrand(ws);
      setBrandState(mapped);
      applyCSSVariables(mapped);

      // Persist to localStorage as a fallback cache
      localStorage.setItem('brand_config_ws_' + ws.id, JSON.stringify(mapped));
    } catch (err) {
      console.warn('BrandContext: workspace detect failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Step 1: Detect branding on mount and on auth state changes ──────────────
  useEffect(() => {
    // Initial detection on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        // Try reading cache first
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith('brand_config_ws_'));
        if (allKeys.length > 0) {
          try {
            const cached = JSON.parse(localStorage.getItem(allKeys[0]));
            if (cached?.brandColor) {
              setBrandState(cached);
              applyCSSVariables(cached);
            }
          } catch { /* ignore */ }
        }
        detectWorkspace(session.user.id);
      } else {
        setBrandState(DEFAULT_BRAND);
        applyCSSVariables(DEFAULT_BRAND);
        setLoading(false);
      }
    });

    // Subscribe to login / logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user?.id) {
          detectWorkspace(session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setWorkspaceId(null);
        setBrandState(DEFAULT_BRAND);
        applyCSSVariables(DEFAULT_BRAND);
        // Clear cached brand localStorage items
        const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('brand_config_ws_'));
        keysToRemove.forEach(k => localStorage.removeItem(k));
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [detectWorkspace]);

  // ── Step 2: Subscribe to Supabase Realtime for live brand updates ──────────
  useEffect(() => {
    if (!workspaceId) return;

    // Cleanup previous channel
    if (realtimeChannel.current) {
      supabase.removeChannel(realtimeChannel.current);
    }

    realtimeChannel.current = supabase
      .channel(`workspace-brand-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'workspaces',
          filter: `id=eq.${workspaceId}`,
        },
        (payload) => {
          if (!payload?.new) return;
          const mapped = mapWorkspaceToBrand(payload.new);
          setBrandState(mapped);
          applyCSSVariables(mapped);
          localStorage.setItem('brand_config_ws_' + workspaceId, JSON.stringify(mapped));
        }
      )
      .subscribe();

    return () => {
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current);
        realtimeChannel.current = null;
      }
    };
  }, [workspaceId]);

  // ── updateBrand: admin saves changes → persists to Supabase ──────────────
  const updateBrand = useCallback(async (partial) => {
    // Optimistic local update
    setBrandState(prev => {
      const next = { ...prev, ...partial };
      applyCSSVariables(next);
      return next;
    });

    if (!workspaceId) return; // No workspace yet, just apply locally

    // Map partial brand config → workspace column names
    const dbUpdate = {};
    if (partial.companyName     !== undefined) dbUpdate.company_name      = partial.companyName;
    if (partial.companyLogo     !== undefined) dbUpdate.logo_url          = partial.companyLogo;
    if (partial.brandColor      !== undefined) dbUpdate.brand_color       = partial.brandColor;
    if (partial.brandColorLight !== undefined) dbUpdate.brand_color_light = partial.brandColorLight;
    if (partial.brandColorText  !== undefined) dbUpdate.brand_color_text  = partial.brandColorText;
    if (partial.brandColorName  !== undefined) dbUpdate.brand_color_name  = partial.brandColorName;

    if (Object.keys(dbUpdate).length === 0) return;

    try {
      const { error } = await supabase
        .from('workspaces')
        .update(dbUpdate)
        .eq('id', workspaceId);

      if (error) throw error;
      // Realtime subscription on other clients will pick up the change automatically
    } catch (err) {
      console.error('BrandContext: updateBrand failed:', err);
    }
  }, [workspaceId]);

  // ── resetBrand: admin reverts → saves defaults to Supabase ───────────────
  const resetBrand = useCallback(async () => {
    setBrandState(DEFAULT_BRAND);
    applyCSSVariables(DEFAULT_BRAND);

    if (!workspaceId) return;

    try {
      await supabase.from('workspaces').update({
        brand_color:       DEFAULT_BRAND.brandColor,
        brand_color_light: DEFAULT_BRAND.brandColorLight,
        brand_color_text:  DEFAULT_BRAND.brandColorText,
        brand_color_name:  DEFAULT_BRAND.brandColorName,
        company_name:      null,
        logo_url:          null,
      }).eq('id', workspaceId);
    } catch (err) {
      console.error('BrandContext: resetBrand failed:', err);
    }
  }, [workspaceId]);

  return (
    <BrandContext.Provider value={{ brand, updateBrand, resetBrand, BRAND_COLORS, loading }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => useContext(BrandContext);
