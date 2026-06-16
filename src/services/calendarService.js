import { supabase } from '../utils/supabaseClient';

/**
 * Calendar Service - Phase 18B
 * Handles client-side API requests to calendar_events, event_attendees, and related tables.
 */
export const calendarService = {
  /**
   * Fetch events for a date range in a workspace.
   * @param {string} workspaceId 
   * @param {string} startDate (ISO format / string)
   * @param {string} endDate (ISO format / string)
   * @returns {Promise<Array>} List of events including creator details and attendees JSON
   */
  async fetchEvents(workspaceId, startDate, endDate) {
    const { data, error } = await supabase.rpc('get_calendar_events', {
      p_workspace_id: workspaceId,
      p_start_at: startDate,
      p_end_at: endDate
    });
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new calendar event with a list of attendee user IDs.
   * @param {object} eventData 
   * @param {Array<string>} attendeeIds 
   * @param {object} recurrenceRule (optional recurrence settings)
   * @returns {Promise<string>} Created event UUID
   */
  async createEvent(eventData, attendeeIds = [], recurrenceRule = null) {
    // If a recurrence rule is provided, we attach it to the eventData
    const payload = {
      ...eventData,
      recurrence_rule: recurrenceRule
    };
    const { data, error } = await supabase.rpc('create_event_with_attendees', {
      p_event_data: payload,
      p_attendee_ids: attendeeIds
    });
    if (error) throw error;
    return data;
  },

  /**
   * Update an existing event.
   * @param {string} eventId 
   * @param {object} updates 
   * @param {string} updateMode ('single' | 'all' | 'future')
   * @returns {Promise<object>} Updated event row
   */
  async updateEvent(eventId, updates, updateMode = 'single') {
    // If updateMode is 'all' or 'future', we could implement recurrence logic here.
    // For now, we update the targeted event row.
    const { data, error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Delete a calendar event.
   * @param {string} eventId 
   * @param {string} deleteMode ('single' | 'all' | 'future')
   * @returns {Promise<boolean>} Success status
   */
  async deleteEvent(eventId, deleteMode = 'single') {
    // If deleteMode is 'all' or 'future', we could handle recurring instances.
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId);
    if (error) throw error;
    return true;
  },

  /**
   * Submit RSVP status for the current authenticated user.
   * @param {string} eventId 
   * @param {string} status ('accepted' | 'declined' | 'maybe')
   */
  async rsvpEvent(eventId, status) {
    const { data, error } = await supabase.rpc('upsert_rsvp', {
      p_event_id: eventId,
      p_status: status
    });
    if (error) throw error;
    return data;
  },

  /**
   * Get a single event's full detail, including attendees and linked tasks.
   * @param {string} eventId 
   */
  async getEventDetail(eventId) {
    const { data: event, error: eventErr } = await supabase
      .from('calendar_events')
      .select('*, profiles(*)')
      .eq('id', eventId)
      .single();
    if (eventErr) throw eventErr;

    // Fetch attendees
    const { data: attendees, error: attErr } = await supabase
      .from('event_attendees')
      .select('*, profiles(*)')
      .eq('event_id', eventId);
    if (attErr) throw attErr;

    // Fetch linked tasks
    const { data: taskLinks, error: taskErr } = await supabase
      .from('event_task_links')
      .select('task_id, tasks(*)')
      .eq('event_id', eventId);
    if (taskErr) throw taskErr;

    return {
      ...event,
      creator: event.profiles,
      attendees: (attendees || []).map(a => ({
        ...a,
        name: a.profiles?.name,
        profile_image_url: a.profiles?.profile_image_url
      })),
      tasks: (taskLinks || []).map(tl => tl.tasks)
    };
  },

  /**
   * Fetch upcoming events for the current logged-in user.
   * @param {number} limit 
   * @returns {Promise<Array>} List of upcoming events
   */
  async getUpcomingEvents(limit = 5) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('get_upcoming_events', {
      p_user_id: user.id,
      p_limit: limit
    });
    if (error) throw error;
    return data || [];
  },

  /**
   * Link a task to a calendar event.
   * @param {string} eventId 
   * @param {string} taskId 
   */
  async linkTask(eventId, taskId) {
    const { data, error } = await supabase
      .from('event_task_links')
      .insert({ event_id: eventId, task_id: taskId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Remove a task link from a calendar event.
   * @param {string} eventId 
   * @param {string} taskId 
   */
  async unlinkTask(eventId, taskId) {
    const { error } = await supabase
      .from('event_task_links')
      .delete()
      .eq('event_id', eventId)
      .eq('task_id', taskId);
    if (error) throw error;
    return true;
  },

  /**
   * Get all tasks linked to a calendar event.
   * @param {string} eventId 
   * @returns {Promise<Array>} List of task rows
   */
  async getLinkedTasks(eventId) {
    const { data, error } = await supabase
      .from('event_task_links')
      .select('task_id, tasks(*)')
      .eq('event_id', eventId);
    if (error) throw error;
    return (data || []).map(d => d.tasks);
  }
};
