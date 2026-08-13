"use client";

import React, { useState } from 'react';
import { Video, Clock } from 'lucide-react';
import { useToast } from '../../components/common/Toast';

export default function SettingsPage() {
  const { showToast } = useToast();

  // Local storage persisted settings
  const [cameraOn, setCameraOn] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('syncmeet_pref_camera') !== 'false';
    }
    return true;
  });
  const [micMuted, setMicMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('syncmeet_pref_mic_muted') === 'true';
    }
    return false;
  });
  const [joinConfirm, setJoinConfirm] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('syncmeet_pref_join_confirm') === 'true';
    }
    return false;
  });
  const [timeFormat24, setTimeFormat24] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('syncmeet_pref_time_format') === '24h';
    }
    return false;
  });

  const handleToggleCamera = (val: boolean) => {
    setCameraOn(val);
    localStorage.setItem('syncmeet_pref_camera', String(val));
    showToast(`Default camera preset: ${val ? 'ON' : 'OFF'}`, 'success');
  };

  const handleToggleMic = (val: boolean) => {
    setMicMuted(val);
    localStorage.setItem('syncmeet_pref_mic_muted', String(val));
    showToast(`Default microphone preset: ${val ? 'MUTED' : 'UNMUTED'}`, 'success');
  };

  const handleToggleConfirm = (val: boolean) => {
    setJoinConfirm(val);
    localStorage.setItem('syncmeet_pref_join_confirm', String(val));
    showToast(`Join confirmation popup: ${val ? 'ENABLED' : 'DISABLED'}`, 'success');
  };

  const handleToggleTimeFormat = (val: boolean) => {
    setTimeFormat24(val);
    localStorage.setItem('syncmeet_pref_time_format', val ? '24h' : '12h');
    showToast(`Time format display: ${val ? '24-Hour' : '12-Hour (AM/PM)'}`, 'success');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">System Settings</h1>
        <p className="text-slate-500 text-xs font-semibold">Customize default device settings, notifications, and localization preferences.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
        
        {/* Meeting Section */}
        <div className="p-6 space-y-4">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Video className="w-4 h-4 text-slate-400" />
            <span>Meeting Presets</span>
          </h3>

          <div className="space-y-4">
            {/* Camera preset switch */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-slate-800">Start with Camera On</div>
                <div className="text-xs text-slate-500">Automatically enable webcam video capture on joining rooms.</div>
              </div>
              <button
                onClick={() => handleToggleCamera(!cameraOn)}
                className={`w-11 h-6 rounded-full transition-all relative ${
                  cameraOn ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                  cameraOn ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Mic preset switch */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-slate-800">Start with Microphone Muted</div>
                <div className="text-xs text-slate-500">Automatically mute microphone audio track when entering sessions.</div>
              </div>
              <button
                onClick={() => handleToggleMic(!micMuted)}
                className={`w-11 h-6 rounded-full transition-all relative ${
                  micMuted ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                  micMuted ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Join confirmation preset */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-slate-800">Join Meeting Confirmation</div>
                <div className="text-xs text-slate-500">Show prompt validation checkbox before completing join flow.</div>
              </div>
              <button
                onClick={() => handleToggleConfirm(!joinConfirm)}
                className={`w-11 h-6 rounded-full transition-all relative ${
                  joinConfirm ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                  joinConfirm ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* General Section */}
        <div className="p-6 space-y-4">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Localization & Time</span>
          </h3>

          <div className="space-y-4">
            {/* Time format selector */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-slate-800">Use 24-Hour Time Format</div>
                <div className="text-xs text-slate-500">Display dates and times in 24-hour style instead of AM/PM.</div>
              </div>
              <button
                onClick={() => handleToggleTimeFormat(!timeFormat24)}
                className={`w-11 h-6 rounded-full transition-all relative ${
                  timeFormat24 ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                  timeFormat24 ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
