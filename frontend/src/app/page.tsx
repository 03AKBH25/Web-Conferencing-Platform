"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Keyboard, 
  Calendar, 
  Clock, 
  Copy, 
  ArrowRight,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { api, UserProfile } from '../lib/api';
import { Meeting } from '../types/meeting';
import { useToast } from '../components/common/Toast';
import { formatDate, formatTime, formatDuration, cleanMeetingId } from '../lib/utils';

export default function Dashboard() {
  const router = useRouter();
  const { showToast } = useToast();

  // Data state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [recent, setRecent] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Action states
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDesc, setScheduleDesc] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState(30);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      const [profData, upcomingData, recentData] = await Promise.all([
        api.getProfile(),
        api.getUpcomingMeetings(),
        api.getRecentMeetings()
      ]);
      setProfile(profData);
      setUpcoming(upcomingData);
      setRecent(recentData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Time based greeting helper
  const getGreeting = () => {
    const hrs = new Date().getHours();
    const name = profile?.name ? profile.name.split(' ')[0] : 'Alex';
    if (hrs < 12) return `Good morning, ${name}`;
    if (hrs < 18) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  // 1. Host Instant Meeting Flow
  const handleCreateInstant = async () => {
    setLoading(true);
    try {
      const meeting = await api.createInstantMeeting('Instant Sync');
      showToast('Instant meeting created successfully!', 'success');
      router.push(`/meeting/${meeting.meeting_id}?demo_user=alex`);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to start meeting';
      showToast(msg, 'error');
      setLoading(false);
    }
  };

  // 2. Join Existing Meeting Flow
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinId.trim()) return;

    setJoinLoading(true);
    setJoinError(null);

    const targetId = cleanMeetingId(joinId);

    try {
      const validation = await api.validateMeeting(targetId);
      if (validation.valid) {
        setShowJoinModal(false);
        showToast('Meeting validated! Joining room...', 'success');
        router.push(`/meeting/${targetId}`);
      } else {
        setJoinError('Meeting is ended or cancelled.');
      }
    } catch (err) {
      console.error(err);
      setJoinError('Invalid meeting ID or meeting not found.');
    } finally {
      setJoinLoading(false);
    }
  };

  // 3. Schedule Meeting Flow
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTitle.trim() || !scheduleDate || !scheduleTime) {
      showToast('Please fill all required scheduling fields', 'error');
      return;
    }

    setScheduleLoading(true);
    try {
      const isoDateTimeStr = `${scheduleDate}T${scheduleTime}:00`;
      await api.createScheduledMeeting(
        scheduleTitle.trim(),
        scheduleDesc.trim(),
        isoDateTimeStr,
        scheduleDuration
      );

      showToast('Meeting scheduled successfully!', 'success');
      setShowScheduleModal(false);
      
      // Reset form fields
      setScheduleTitle('');
      setScheduleDesc('');
      setScheduleDate('');
      setScheduleTime('');
      setScheduleDuration(30);

      // Refresh list
      loadDashboardData();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Scheduling failed';
      showToast(msg, 'error');
    } finally {
      setScheduleLoading(false);
    }
  };

  // Copy meeting details helper
  const handleCopyLink = (meetingId: string) => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link)
      .then(() => showToast('Meeting link copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy link', 'error'));
  };

  if (loading && upcoming.length === 0 && recent.length === 0) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-10 w-1/3 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-28 bg-white rounded-2xl border border-slate-100" />
          <div className="h-28 bg-white rounded-2xl border border-slate-100" />
          <div className="h-28 bg-white rounded-2xl border border-slate-100" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-white rounded-2xl border border-slate-100" />
          <div className="h-96 bg-white rounded-2xl border border-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{getGreeting()}</h1>
        <p className="text-slate-500 text-sm font-medium">Ready for your next workspace session?</p>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* New Instant Action */}
        <button
          onClick={handleCreateInstant}
          className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-2xl shadow-lg shadow-blue-600/10 text-left transition-all hover:-translate-y-0.5 group flex items-start justify-between"
        >
          <div className="space-y-2.5">
            <div className="p-3 bg-white/10 rounded-xl w-fit">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg">New Meeting</div>
              <div className="text-blue-100 text-xs mt-0.5">Start an instant video room</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* Join Action */}
        <button
          onClick={() => {
            setJoinId('');
            setJoinError(null);
            setShowJoinModal(true);
          }}
          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 p-6 rounded-2xl text-left transition-all hover:-translate-y-0.5 group flex items-start justify-between"
        >
          <div className="space-y-2.5">
            <div className="p-3 bg-slate-100 rounded-xl w-fit group-hover:bg-slate-200 transition-colors">
              <Keyboard className="w-6 h-6 text-slate-650" />
            </div>
            <div>
              <div className="font-bold text-lg">Join Meeting</div>
              <div className="text-slate-500 text-xs mt-0.5">Enter meeting ID or paste link</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" />
        </button>

        {/* Schedule Action */}
        <button
          onClick={() => setShowScheduleModal(true)}
          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 p-6 rounded-2xl text-left transition-all hover:-translate-y-0.5 group flex items-start justify-between"
        >
          <div className="space-y-2.5">
            <div className="p-3 bg-slate-100 rounded-xl w-fit group-hover:bg-slate-200 transition-colors">
              <Calendar className="w-6 h-6 text-slate-650" />
            </div>
            <div>
              <div className="font-bold text-lg">Schedule</div>
              <div className="text-slate-500 text-xs mt-0.5">Schedule a future session</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" />
        </button>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Meetings List (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Upcoming Meetings</h2>
            <button 
              onClick={() => router.push('/meetings')}
              className="text-xs font-bold text-blue-600 hover:text-blue-750 transition-colors"
            >
              View all
            </button>
          </div>

          {upcoming.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <Calendar className="w-10 h-10 text-slate-350 mx-auto" />
              <div className="space-y-1">
                <div className="text-slate-800 font-bold">No upcoming meetings</div>
                <div className="text-slate-500 text-sm">Schedule a meeting to get started.</div>
              </div>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
              >
                Schedule Meeting
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {upcoming.map((meeting) => (
                <div
                  key={meeting.meeting_id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="font-bold text-slate-800 text-base">{meeting.title}</div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {meeting.scheduled_at ? `${formatDate(meeting.scheduled_at)} • ${formatTime(meeting.scheduled_at)}` : ''}
                      </span>
                      <span>•</span>
                      <span>{formatDuration(meeting.duration_minutes)}</span>
                      <span>•</span>
                      <span>ID: {meeting.meeting_id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/meeting/${meeting.meeting_id}`)}
                      className="bg-blue-650 hover:bg-blue-700 text-white font-semibold text-xs px-4.5 py-2.5 rounded-xl transition-colors shadow-sm"
                    >
                      Join Meeting
                    </button>
                    <button
                      onClick={() => handleCopyLink(meeting.meeting_id)}
                      className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-all"
                      title="Copy Invite Link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History / Recent List (Right Column) */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Recent History</h2>

          {recent.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
              <Clock className="w-8 h-8 text-slate-350 mx-auto" />
              <div className="text-slate-800 font-bold text-sm">No recent meetings</div>
              <div className="text-slate-500 text-xs">Past room stats will appear here.</div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 divide-y divide-slate-100 shadow-sm max-h-[380px] overflow-y-auto">
              {recent.map((meeting) => (
                <div key={meeting.meeting_id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-sm">
                  <div className="space-y-0.5 truncate max-w-[70%]">
                    <div className="font-bold text-slate-800 truncate">{meeting.title}</div>
                    <div className="text-xs text-slate-500">ID: {meeting.meeting_id}</div>
                  </div>
                  <button
                    onClick={() => router.push(`/meeting/${meeting.meeting_id}`)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View / Rejoin"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* JOIN MEETING MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-6 space-y-5 animate-scale-up">
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-800">Join Meeting</h3>
              <p className="text-slate-500 text-xs">Enter a valid 9-digit meeting ID or paste the full invite link.</p>
            </div>

            {joinError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl text-xs font-semibold">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="e.g. 123-456-789 or URL"
                required
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-800"
              />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4.5 py-2.5 border border-slate-200 text-slate-650 hover:bg-slate-50 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4.5 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5"
                >
                  {joinLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Join Meeting</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE MEETING MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-2xl p-6 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-800">Schedule Meeting</h3>
              <p className="text-slate-500 text-xs">Fill in meeting info to generate a persistent scheduled invite.</p>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-650">Meeting Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Design Sync"
                  required
                  value={scheduleTitle}
                  onChange={(e) => setScheduleTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-650">Description</label>
                <textarea
                  placeholder="Describe the topics to discuss (optional)"
                  rows={2}
                  value={scheduleDesc}
                  onChange={(e) => setScheduleDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-650">Date *</label>
                  <input
                    type="date"
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-650">Time *</label>
                  <input
                    type="time"
                    required
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-650">Duration (Minutes)</label>
                <select
                  value={scheduleDuration}
                  onChange={(e) => setScheduleDuration(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-800"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4.5 py-2.5 border border-slate-200 text-slate-650 hover:bg-slate-50 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4.5 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5"
                >
                  {scheduleLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Schedule Meeting</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
