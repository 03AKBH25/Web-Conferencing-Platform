import { Meeting, Participant, ChatMessage } from '../types/meeting';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  name: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  meeting_id?: string;
}

export interface NotificationsResponse {
  unread_count: number;
  notifications: NotificationItem[];
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `API error: ${response.statusText}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Accounts
  getProfile: (): Promise<UserProfile> => {
    return fetchJson<UserProfile>('/accounts/me/');
  },

  // Meetings
  getUpcomingMeetings: (): Promise<Meeting[]> => {
    return fetchJson<Meeting[]>('/meetings/upcoming/');
  },

  getRecentMeetings: (): Promise<Meeting[]> => {
    return fetchJson<Meeting[]>('/meetings/recent/');
  },

  getAllMeetings: (type?: 'instant' | 'scheduled', status?: string): Promise<Meeting[]> => {
    let path = '/meetings/';
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    const queryString = params.toString();
    if (queryString) path += `?${queryString}`;
    return fetchJson<Meeting[]>(path);
  },

  createInstantMeeting: (title: string, description = ''): Promise<Meeting> => {
    return fetchJson<Meeting>('/meetings/instant/', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
  },

  createScheduledMeeting: (title: string, description: string, scheduledAt: string, durationMinutes: number): Promise<Meeting> => {
    return fetchJson<Meeting>('/meetings/', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
      }),
    });
  },

  getMeeting: (meetingId: string): Promise<Meeting> => {
    return fetchJson<Meeting>(`/meetings/${meetingId}/`);
  },

  validateMeeting: (meetingId: string): Promise<{ valid: boolean; meeting_id: string; title: string; status: string }> => {
    return fetchJson<{ valid: boolean; meeting_id: string; title: string; status: string }>(`/meetings/${meetingId}/validate/`);
  },

  joinMeeting: (meetingId: string, displayName: string, sessionId: string, isHost: boolean): Promise<{ participant_id: number; is_host: boolean }> => {
    const headers: HeadersInit = {};
    if (isHost) {
      headers['X-Demo-User'] = 'alex';
    }
    return fetchJson<{ participant_id: number; is_host: boolean }>(`/meetings/${meetingId}/join/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ display_name: displayName, session_id: sessionId }),
    });
  },

  leaveMeeting: (meetingId: string, participantId: number): Promise<{ message: string }> => {
    return fetchJson<{ message: string }>(`/meetings/${meetingId}/leave/`, {
      method: 'POST',
      body: JSON.stringify({ participant_id: participantId }),
    });
  },

  getParticipants: (meetingId: string): Promise<Participant[]> => {
    return fetchJson<Participant[]>(`/meetings/${meetingId}/participants/`);
  },

  getMessages: (meetingId: string): Promise<ChatMessage[]> => {
    return fetchJson<ChatMessage[]>(`/meetings/${meetingId}/messages/`);
  },

  searchMeetings: (q: string): Promise<Meeting[]> => {
    return fetchJson<Meeting[]>(`/meetings/search/?q=${encodeURIComponent(q)}`);
  },

  // Notifications
  getNotifications: (): Promise<NotificationsResponse> => {
    return fetchJson<NotificationsResponse>('/notifications/');
  },

  markNotificationRead: (id: number): Promise<NotificationItem> => {
    return fetchJson<NotificationItem>(`/notifications/${id}/read/`, {
      method: 'PATCH',
    });
  },

  markAllNotificationsRead: (): Promise<{ message: string }> => {
    return fetchJson<{ message: string }>('/notifications/read-all/', {
      method: 'POST',
    });
  },
};
