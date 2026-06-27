import React, { useState, useEffect } from 'react';
import { LuWifiOff, LuZap } from 'react-icons/lu';

const ConnectionStatusBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-55 w-full max-w-sm px-4 pointer-events-none animate-slide-in">
      {!isOnline ? (
        <div className="flex items-center gap-3 bg-amber-50/90 backdrop-blur-md border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl shadow-lg shadow-amber-900/5 select-none">
          <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 animate-pulse">
            <LuWifiOff size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold">Network offline</p>
            <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Attempting to reconnect. Changes will sync shortly.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-emerald-50/90 backdrop-blur-md border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl shadow-lg shadow-emerald-900/5 select-none">
          <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
            <LuZap size={16} className="animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold">Connection restored</p>
            <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">We're back online. Syncing workspace changes...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatusBanner;
