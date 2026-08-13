import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { ChatMessage } from '../../types/meeting';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentSessionId: string;
  onSendMessage: (message: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, currentSessionId, onSendMessage }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 100;
      if (isNearBottom || messages.length <= 1) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-80 shrink-0">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-indigo-400" />
        <h2 className="text-white font-semibold text-base">In-Meeting Chat</h2>
      </div>

      {/* Messages List */}
      <div ref={scrollContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <MessageSquare className="w-10 h-10 text-slate-700 mb-2" />
            <p className="text-slate-500 text-sm">No messages yet. Send a message to start the conversation.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.session_id === currentSessionId;
            return (
              <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Header (Name + time) */}
                <div className="flex items-center gap-2 mb-1 px-1 text-xs text-slate-500">
                  <span className={`font-medium ${isMe ? 'text-indigo-400' : 'text-slate-400'}`}>
                    {msg.display_name} {isMe ? '(You)' : ''}
                  </span>
                  {msg.is_host && (
                    <span className="bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded text-[10px] border border-amber-500/20 font-semibold uppercase">
                      Host
                    </span>
                  )}
                  <span>{formatTime(msg.created_at)}</span>
                </div>

                {/* Message bubble */}
                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-850 text-slate-200 border border-slate-800 rounded-tl-none'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-slate-950 border border-slate-800 rounded-full py-2.5 pl-4 pr-11 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-1.5 rounded-full transition-colors flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
export default ChatPanel;
