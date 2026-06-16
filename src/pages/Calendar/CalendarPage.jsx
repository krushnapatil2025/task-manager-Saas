import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import moment from 'moment';
import toast from 'react-hot-toast';
import { supabase } from '../../utils/supabaseClient';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import CalendarHeader from '../../components/Calendar/CalendarHeader';
import MonthView from '../../components/Calendar/MonthView';
import WeekView from '../../components/Calendar/WeekView';
import DayView from '../../components/Calendar/DayView';
import AgendaView from '../../components/Calendar/AgendaView';
import EventFormModal from '../../components/Calendar/EventFormModal';
import EventDetailPanel from '../../components/Calendar/EventDetailPanel';
import { calendarService } from '../../services/calendarService';
import { getAllTasks } from '../../services/taskService';
import { createNotification } from '../../services/notificationService';
import { LuCalendar, LuClock, LuMapPin, LuVideo, LuClipboardCheck } from 'react-icons/lu';

const CalendarPage = () => {
  const { user } = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);
  const [searchParams, setSearchParams] = useSearchParams();

  // URL Prefill states
  const [prefilledTaskId, setPrefilledTaskId] = useState('');
  const [prefilledTitle, setPrefilledTitle] = useState('');

  // Calendar UI states
  const [currentDate, setCurrentDate] = useState(moment());
  const [view, setView] = useState('month'); // 'month' | 'week' | 'day'
  
  // Data states
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Panel/Modal states
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Prefill check on mount / search params change
  useEffect(() => {
    const taskParam = searchParams.get('scheduleForTask');
    const titleParam = searchParams.get('title');
    const viewParam = searchParams.get('view');

    if (viewParam && ['month', 'week', 'day', 'agenda'].includes(viewParam)) {
      setView(viewParam);
    }

    if (taskParam) {
      setPrefilledTaskId(taskParam);
      setPrefilledTitle(titleParam || '');
      setIsFormOpen(true);
      // Clear URL params to avoid re-triggering
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('scheduleForTask');
      newParams.delete('title');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams]);

  // Trigger loads on workspace change or date navigate
  useEffect(() => {
    if (workspace?.id) {
      loadData();
      loadWorkspaceMembers();
    }
  }, [workspace?.id, currentDate, view]);

  const loadData = async () => {
    try {
      setLoading(true);
      const rangeUnit = view === 'agenda' ? 'week' : view;
      const startOfRange = moment(currentDate).startOf(rangeUnit).subtract(1, 'week').toISOString();
      const endOfRange = moment(currentDate).endOf(rangeUnit).add(1, 'week').toISOString();

      // 1. Fetch Calendar Events
      const evts = await calendarService.fetchEvents(workspace.id, startOfRange, endOfRange);
      setEvents(evts);

      // 2. Fetch Tasks (to show due dates on calendar)
      const tsks = await getAllTasks(workspace.id);
      setTasks(tsks || []);

    } catch (err) {
      console.error('Failed to load calendar data:', err);
      toast.error('Could not load calendar events');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceMembers = async () => {
    try {
      const { data, error } = await supabase.rpc('get_workspace_members_full', {
        p_workspace_id: workspace.id
      });
      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Failed to load workspace members:', err);
    }
  };

  const handleNavigate = (direction) => {
    if (direction === 'today') {
      setCurrentDate(moment());
    } else if (direction === 'prev') {
      setCurrentDate(moment(currentDate).subtract(1, view));
    } else if (direction === 'next') {
      setCurrentDate(moment(currentDate).add(1, view));
    }
  };

  const handleFormSubmit = async (formData, attendeeIds, linkedTaskId) => {
    try {
      if (editingEvent) {
        // Update Event
        await calendarService.updateEvent(editingEvent.id, formData);
        
        // Update attendees separately
        // Delete old and insert new matching the selection
        await supabase.from('event_attendees').delete().eq('event_id', editingEvent.id);
        
        if (attendeeIds.length > 0) {
          const attendeePayload = attendeeIds.map(uid => ({
            event_id: editingEvent.id,
            user_id: uid,
            status: uid === user.id ? 'accepted' : 'pending'
          }));
          await supabase.from('event_attendees').insert(attendeePayload);
        }

        // Update task links
        await supabase.from('event_task_links').delete().eq('event_id', editingEvent.id);
        if (linkedTaskId) {
          await calendarService.linkTask(editingEvent.id, linkedTaskId);
        }

        // Notify attendees of the update
        if (attendeeIds && attendeeIds.length > 0) {
          const notificationPromises = attendeeIds
            .filter(uid => uid !== user.id)
            .map(uid => createNotification({
              userId: uid,
              type: 'calendar_event',
              title: 'Meeting Details Updated 📅',
              body: `Meeting: "${formData.title}" details have been updated.`,
              link: '/calendar'
            }).catch(e => console.error('Failed to notify updated attendee:', uid, e)));
          await Promise.all(notificationPromises);
        }
        
        toast.success('Event updated successfully');
      } else {
        // Create Event
        const eventPayload = {
          ...formData,
          workspace_id: workspace.id,
          created_by: user.id
        };
        const eventId = await calendarService.createEvent(eventPayload, attendeeIds);
        
        if (linkedTaskId) {
          await calendarService.linkTask(eventId, linkedTaskId);
        }

        // Notify attendees of the new meeting
        if (attendeeIds && attendeeIds.length > 0) {
          const notificationPromises = attendeeIds
            .filter(uid => uid !== user.id)
            .map(uid => createNotification({
              userId: uid,
              type: 'calendar_event',
              title: 'New Meeting Scheduled 📅',
              body: `Meeting: "${formData.title}" scheduled for ${moment(formData.start_at).format('MMM D, h:mm A')}`,
              link: '/calendar'
            }).catch(e => console.error('Failed to notify attendee:', uid, e)));
          await Promise.all(notificationPromises);
        }

        toast.success('Event scheduled successfully');
      }
      
      setIsFormOpen(false);
      setEditingEvent(null);
      loadData();
    } catch (err) {
      console.error('Failed to save event:', err);
      toast.error('Error saving calendar event');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await calendarService.deleteEvent(eventId);
      toast.success('Event deleted');
      setSelectedEvent(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete event:', err);
      toast.error('Could not delete event');
    }
  };

  const handleRsvpChange = async (eventId, status) => {
    try {
      await calendarService.rsvpEvent(eventId, status);
      toast.success(`RSVP updated to ${status}`);
      
      // Update selected event detail view
      if (selectedEvent && selectedEvent.id === eventId) {
        const updatedDetail = await calendarService.getEventDetail(eventId);
        setSelectedEvent(updatedDetail);
      }
      
      loadData();
    } catch (err) {
      console.error('Failed to update RSVP:', err);
      toast.error('Could not update response');
    }
  };

  const handleEventClick = async (evt) => {
    try {
      const fullDetail = await calendarService.getEventDetail(evt.id);
      setSelectedEvent(fullDetail);
    } catch (err) {
      console.error('Failed to load event details:', err);
      setSelectedEvent(evt); // fallback to list representation
    }
  };

  const handleTaskClick = (task) => {
    // Navigate to task details view
    window.location.href = `/user/task-details/${task.id}`;
  };



  return (
    <DashboardLayout activeMenu="Calendar">
      <div className="flex-1 flex flex-col min-h-[calc(100vh-57px)] bg-slate-50/35 relative">
        {/* Header navigation bar */}
        <CalendarHeader
          currentDate={currentDate}
          view={view}
          onNavigate={handleNavigate}
          onViewChange={setView}
          onAddEventClick={() => {
            setEditingEvent(null);
            setIsFormOpen(true);
          }}
        />

        {/* Loading Spinner overlay */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          /* Main view content body */
          <div className="flex-1 flex flex-col min-h-0">
            {view === 'month' && (
              <MonthView
                currentDate={currentDate}
                events={events}
                tasks={tasks}
                onEventClick={handleEventClick}
                onTaskClick={handleTaskClick}
              />
            )}
            {view === 'week' && (
              <WeekView
                currentDate={currentDate}
                events={events}
                onEventClick={handleEventClick}
              />
            )}
            {view === 'day' && (
              <DayView
                currentDate={currentDate}
                events={events}
                onEventClick={handleEventClick}
              />
            )}
            {view === 'agenda' && (
              <AgendaView
                currentDate={currentDate}
                events={events}
                tasks={tasks}
                view="week"
                onEventClick={handleEventClick}
                onTaskClick={handleTaskClick}
              />
            )}
          </div>
        )}

        {/* Event detail side panel */}
        {selectedEvent && (
          <EventDetailPanel
            event={selectedEvent}
            activeUserId={user?.id}
            onClose={() => setSelectedEvent(null)}
            onEditClick={(evt) => {
              setEditingEvent(evt);
              setSelectedEvent(null);
              setIsFormOpen(true);
            }}
            onDeleteClick={handleDeleteEvent}
            onRsvpChange={handleRsvpChange}
          />
        )}

        {/* Scheduling Event Form Modal */}
        <EventFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingEvent(null);
            setPrefilledTaskId('');
            setPrefilledTitle('');
          }}
          onSubmit={handleFormSubmit}
          initialData={editingEvent || (prefilledTaskId ? { title: prefilledTitle, tasks: [{ id: prefilledTaskId }] } : null)}
          members={members}
          activeUserId={user?.id}
          tasks={tasks}
          prefilledTaskId={prefilledTaskId}
        />
      </div>
    </DashboardLayout>
  );
};

export default CalendarPage;
