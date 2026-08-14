import { SocketMessage, ConnectionState } from '../types/meeting';

export class MeetingSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessageCallbacks: Map<string, Set<(payload: unknown) => void>> = new Map();
  private pendingMessages: Map<string, unknown[]> = new Map();
  private onStateChange: (state: ConnectionState) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isExplicitlyClosed = false;

  constructor(
    url: string,
    onStateChange: (state: ConnectionState) => void
  ) {
    this.url = url;
    this.onStateChange = onStateChange;
  }

  connect(): void {
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
      
      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data) as SocketMessage;
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

  private attemptReconnect(): void {
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

  disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStateChange('disconnected');
  }

  send(type: string, payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('Cannot send message, WebSocket is not open');
    }
  }

  subscribe<T>(type: string, callback: (payload: T) => void): () => void {
    if (!this.onMessageCallbacks.has(type)) {
      this.onMessageCallbacks.set(type, new Set());
    }
    this.onMessageCallbacks.get(type)!.add(callback as (payload: unknown) => void);

    const pending = this.pendingMessages.get(type);
    if (pending) {
      pending.forEach((payload) => callback(payload as T));
      this.pendingMessages.delete(type);
    }

    return () => this.unsubscribe(type, callback);
  }

  unsubscribe<T>(type: string, callback: (payload: T) => void): void {
    const callbacks = this.onMessageCallbacks.get(type);
    if (callbacks) {
      callbacks.delete(callback as (payload: unknown) => void);
      if (callbacks.size === 0) {
        this.onMessageCallbacks.delete(type);
      }
    }
  }

  private trigger(type: string, payload: unknown): void {
    const callbacks = this.onMessageCallbacks.get(type);
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach((callback) => callback(payload));
    } else {
      const pending = this.pendingMessages.get(type) || [];
      pending.push(payload);
      this.pendingMessages.set(type, pending);
    }
  }
}
export default MeetingSocket;
