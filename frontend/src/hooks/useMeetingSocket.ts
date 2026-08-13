import { useEffect, useRef, useState } from 'react';
import { MeetingSocket } from '../lib/socket';
import { ConnectionState } from '../types/meeting';

export function useMeetingSocket(
  meetingId: string | null,
  sessionId: string | null,
  participantId: number | null,
  onStateChangeCallback?: (state: ConnectionState) => void
) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [socketInstance, setSocketInstance] = useState<MeetingSocket | null>(null);
  const socketRef = useRef<MeetingSocket | null>(null);

  useEffect(() => {
    if (!meetingId || !sessionId || !participantId) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Load WS base URL from env (e.g. ws://localhost:8000/ws or wss://yourdomain.com/ws)
    const envWsUrl = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//localhost:8000/ws`;
    // Ensure the scheme matches the page security (ws: -> wss: if on https)
    const secureWsUrl = envWsUrl.replace(/^(ws|wss):/, protocol);
    
    const wsUrl = `${secureWsUrl}/meetings/${meetingId}/?session_id=${sessionId}&participant_id=${participantId}`;
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const socket = new MeetingSocket(wsUrl, (state) => {
      setConnectionState(state);
      if (onStateChangeCallback) {
        onStateChangeCallback(state);
      }
    });

    socketRef.current = socket;
    
    // Avoid calling setState synchronously inside the effect body to prevent cascading renders
    const timer = setTimeout(() => {
      setSocketInstance(socket);
    }, 0);
    
    socket.connect();

    return () => {
      console.log('Disconnecting WebSocket due to unmount');
      clearTimeout(timer);
      socket.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
    };
  }, [meetingId, sessionId, participantId, onStateChangeCallback]);

  return {
    connectionState,
    socket: socketInstance
  };
}
export default useMeetingSocket;
