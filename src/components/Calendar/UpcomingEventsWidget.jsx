import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { calendarService } from '../../services/calendarService';

const UpcomingEventsWidget = () => {
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const data = await calendarService.getUpcomingEvents(5);
        setUpcoming(data || []);
      } catch (err) {
        console.error('Failed to load upcoming events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUpcoming();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (upcoming.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
        <span className="text-3xl mb-2">🗓️</span>
        <p className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">No upcoming meetings</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[260px] pr-1 custom-scrollbar">
      {upcoming.map((evt) => (
        <div 
          key={evt.id} 
          onClick={() => navigate(`/calendar`)}
          className="p-3 bg-slate-50/70 hover:bg-indigo-50/20 border border-slate-100 rounded-xl transition-all cursor-pointer flex items-start gap-3 group"
        >
          <div 
            style={{ backgroundColor: evt.color }}
            className="w-1.5 h-10 rounded-full flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h6 className="text-xs font-black text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
              {evt.title}
            </h6>
            <p className="text-[10px] text-slate-450 font-bold mt-1.5">
              {moment(evt.start_at).format('MMM D · h:mm A')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UpcomingEventsWidget;
