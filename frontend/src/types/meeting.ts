export interface Participant {
  id: number;
  session_id: string;
  display_name: string;
  is_host: boolean;
  audio_enabled: boolean;
  video_enabled: boolean;
  is_active?: boolean;
  stream?: MediaStream | null;
  is_screen_sharing?: boolean;
  is_local?: boolean;
}

export interface Meeting {
  id?: number;
  meeting_id: string;
  title: string;
  description: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  meeting_type: 'instant' | 'scheduled';
  invite_link: string;
  scheduled_at?: string;
  duration_minutes?: number;
  host?: {
    id: number;
    username: string;
    email: string;
    name: string;
  };
}

export interface ChatMessage {
  id?: number;
  participant_id: number;
  session_id: string;
  display_name: string;
  is_host: boolean;
  message: string;
  created_at: string;
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface MeetingStatePayload {
  meeting_id: string;
  title: string;
  status: string;
  participants: Participant[];
}

export interface SocketMessage {
  type: string;
  payload: unknown;
}
