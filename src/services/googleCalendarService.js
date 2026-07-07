const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// In-memory token cache
let _cachedToken = null;
let _tokenExpiresAt = 0;

/**
 * Request a short-lived OAuth2 access token using Google Identity Services.
 * Shows a Google sign-in popup if needed; resolves with the token string.
 * Token is cached for its lifetime (~1 hour).
 */
export const getCalendarAccessToken = () =>
  new Promise((resolve, reject) => {
    // Return cached token if still valid (with 60s buffer)
    if (_cachedToken && Date.now() < _tokenExpiresAt - 60_000) {
      return resolve(_cachedToken);
    }

    if (!window.google?.accounts?.oauth2) {
      return reject(new Error('Google Identity Services not loaded. Check your internet connection.'));
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: CALENDAR_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        _cachedToken = response.access_token;
        _tokenExpiresAt = Date.now() + (response.expires_in * 1000);
        resolve(_cachedToken);
      },
    });

    client.requestAccessToken({ prompt: '' }); // '' = silent if already authorized, popup if not
  });

/**
 * Creates a Google Calendar event with a Google Meet conference room.
 * Returns the meet.google.com link string.
 */
export const generateGoogleMeetLink = async ({
  title = 'Team Meeting',
  start = new Date(),
  end = null,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
} = {}) => {
  const token = await getCalendarAccessToken();

  let startDt = new Date(start);
  if (isNaN(startDt.getTime())) {
    startDt = new Date();
  }

  let endDt;
  if (end) {
    endDt = new Date(end);
    if (isNaN(endDt.getTime())) {
      endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
    }
  } else {
    endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
  }

  // Safe guard: ensure end is strictly after start
  if (endDt.getTime() <= startDt.getTime()) {
    endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
  }

  // Unique request ID to prevent duplicate conference rooms on retry
  const requestId = `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const body = {
    summary: title,
    start: { dateTime: startDt.toISOString(), timeZone },
    end: { dateTime: endDt.toISOString(), timeZone },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  const res = await fetch(`${CALENDAR_API}?conferenceDataVersion=1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Token might have expired — clear cache so next call refreshes
    _cachedToken = null;
    _tokenExpiresAt = 0;
    throw new Error(err?.error?.message || `Calendar API error: ${res.status}`);
  }

  const data = await res.json();

  // Extract the Meet link from the response
  const meetLink =
    data?.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri ||
    data?.hangoutLink ||
    null;

  if (!meetLink) {
    throw new Error('Google Meet link was not returned. Ensure the Calendar API is enabled in your Google Cloud project.');
  }

  return { meetLink, eventId: data.id };
};

/**
 * Updates an existing Google Calendar event with correct title and start/end dates.
 */
export const updateGoogleCalendarEvent = async (eventId, {
  title = 'Team Meeting',
  start = new Date(),
  end = null,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
} = {}) => {
  if (!eventId) return;
  const token = await getCalendarAccessToken();

  let startDt = new Date(start);
  if (isNaN(startDt.getTime())) {
    startDt = new Date();
  }

  let endDt;
  if (end) {
    endDt = new Date(end);
    if (isNaN(endDt.getTime())) {
      endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
    }
  } else {
    endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
  }

  if (endDt.getTime() <= startDt.getTime()) {
    endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
  }

  const body = {
    summary: title,
    start: { dateTime: startDt.toISOString(), timeZone },
    end: { dateTime: endDt.toISOString(), timeZone },
  };

  const res = await fetch(`${CALENDAR_API}/${eventId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Calendar API update error: ${res.status}`);
  }
};

/**
 * Deletes an event from Google Calendar to prevent orphaned/draft events.
 */
export const deleteGoogleCalendarEvent = async (eventId) => {
  if (!eventId) return;
  try {
    const token = await getCalendarAccessToken();
    await fetch(`${CALENDAR_API}/${eventId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.error('Failed to delete Google Calendar event:', err);
  }
};

/** Clear the cached token (call on sign-out) */
export const clearCalendarToken = () => {
  _cachedToken = null;
  _tokenExpiresAt = 0;
};



