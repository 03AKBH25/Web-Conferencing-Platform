import { SocketMessage, ConnectionState } from '../types/meeting';

export class MeetingSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessageCallbacks: Map<string, Set<(payload: any) => void>> = new Map();
  private onStateChange: (state: ConnectionState) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: any = null;
  private isExplicitlyClosed = false;

  constructor(
    url: string,
    onStateChange: (state: ConnectionState) => void
  ) {
    this.url = url;
    this.onStateChange = onStateChange;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    
    this.isExplicitlyClosed = false;
    this.onStateChange(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.onStateChange('connected');
        console.log('WebSocket connection opened');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message: SocketMessage = JSON.parse(event.data);
          this.trigger(message.type, message.payload);
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };
      
      this.ws.onclose = () => {
        this.onStateChange('disconnected');
        console.log('WebSocket connection closed');
        if (!this.isExplicitlyClosed) {
          this.attemptReconnect();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      this.onStateChange('disconnected');
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in 3s...`);
    
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStateChange('disconnected');
  }

  send(type: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('Cannot send message, WebSocket is not open');
    }
  }

  subscribe(type: string, callback: (payload: any) => void) {
    if (!this.onMessageCallbacks.has(type)) {
      this.onMessageCallbacks.set(type, new Set());
    }
    this.onMessageCallbacks.get(type)!.add(callback);
    return () => this.unsubscribe(type, callback);
  }

  unsubscribe(type: string, callback: (payload: any) => void) {
    const callbacks = this.onMessageCallbacks.get(type);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.onMessageCallbacks.delete(type);
      }
    }
  }

  private trigger(type: string, payload: any) {
    const callbacks = this.onMessageCallbacks.get(type);
    if (callbacks) {
      callbacks.forEach((callback) => callback(payload));
    }
  }
}
export default MeetingSocket;
