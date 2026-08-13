"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Keyboard, Plus, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [meetingIdInput, setMeetingIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleCreateInstant = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const response = await fetch('http://localhost:8000/api/meetings/instant/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Instant Sync',
          description: 'Created from dashboard'
        })
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create meeting');
      }

      // Redirect to meeting room with demo host parameter
      router.push(`/meeting/${data.meeting_id}?demo_user=alex`);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Server connection failed. Is the Django backend running on port 8000?');
      setLoading(false);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingIdInput.trim()) return;
    
    // Clean up input string (format e.g. 123-456-789)
    const cleanedId = meetingIdInput.trim();
    router.push(`/meeting/${cleanedId}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="h-16 px-8 flex items-center border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-600">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">Antigravity Conferencing</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-6 py-20 flex-1 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 space-y-6">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Premium video meetings. <br />
            Now free for everyone.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            We redesigned our secure business meeting engine to make it completely free and accessible from any browser. No downloads required.
          </p>

          {errorText && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorText}</span>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={handleCreateInstant}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-6 py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2.5 shrink-0 text-sm"
            >
              {loading ? (
                <RefreshCw className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <Plus className="w-4.5 h-4.5" />
              )}
              <span>New Instant Meeting</span>
            </button>

            <span className="text-slate-600 text-sm font-medium self-center select-none">or</span>

            <form onSubmit={handleJoinSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Keyboard className="w-4.5 h-4.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={meetingIdInput}
                  onChange={(e) => setMeetingIdInput(e.target.value)}
                  placeholder="Enter meeting ID (e.g. 123-456-789)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={!meetingIdInput.trim()}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 disabled:opacity-50 text-white font-semibold p-3.5 rounded-xl transition-all flex items-center justify-center shrink-0"
              >
                <ArrowRight className="w-4.5 h-4.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Hero Visual Mockup */}
        <div className="flex-1 w-full max-w-sm aspect-square bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between relative overflow-hidden select-none">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 pointer-events-none" />
          <div className="flex justify-between items-center z-10">
            <span className="bg-slate-800/80 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full text-slate-300">Live Preview</span>
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
          </div>
          <div className="flex flex-col items-center justify-center py-10 z-10">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg mb-4 text-white text-xl font-bold">
              VS
            </div>
            <h3 className="text-white font-bold text-base">Mesh Video Conferencing</h3>
            <p className="text-slate-500 text-xs text-center mt-1">Real-time WebRTC streams with chat panel</p>
          </div>
          <div className="bg-slate-950/80 border border-slate-850/50 backdrop-blur-sm rounded-2xl p-3 flex justify-around text-slate-400 z-10 text-xs">
            <span>📹 Video On</span>
            <span>🎙️ Audio On</span>
            <span>💬 Active Chat</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 border-t border-slate-900 flex items-center justify-center text-slate-500 text-xs">
        &copy; {new Date().getFullYear()} Antigravity Conferencing Assignments. All rights reserved.
      </footer>
    </div>
  );
}
