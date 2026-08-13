"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Clock, 
  Copy, 
  ExternalLink,
  Search, 
  Video, 
  Info,
  FileText
} from 'lucide-react';
import { api } from '../../lib/api';
import { Meeting } from '../../types/meeting';
import { useToast } from '../../components/common/Toast';
import { formatDate, formatTime, formatDuration } from '../../lib/utils';

type FilterTab = 'upcoming' | 'past' | 'all';

export default function MeetingsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  // Load all meetings based on filters
  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      let data: Meeting[] = [];
      if (activeTab === 'upcoming') {
        data = await api.getUpcomingMeetings();
      } else if (activeTab === 'past') {
        data = await api.getRecentMeetings();
      } else {
        data = await api.getAllMeetings();
      }
      setMeetings(data);
      if (data.length > 0 && !selectedMeeting) {
        setSelectedMeeting(data[0]);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load meetings list', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedMeeting, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMeetings();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadMeetings]);

  const filteredMeetings = meetings.filter((meeting) => {
    const q = searchQuery.toLowerCase();
    return (
      meeting.title.toLowerCase().includes(q) ||
      meeting.meeting_id.toLowerCase().includes(q) ||
      meeting.description.toLowerCase().includes(q)
    );
  });

  const handleCopyLink = (meetingId: string) => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link)
      .then(() => showToast('Meeting link copied!', 'success'))
      .catch(() => showToast('Failed to copy link', 'error'));
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Meetings Workspace</h1>
        <p className="text-slate-500 text-xs font-semibold">Review, manage, and join your scheduled or past conference logs.</p>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex bg-slate-200/60 p-1 rounded-xl w-fit">
          <button
            onClick={() => {
              setActiveTab('upcoming');
              setSelectedMeeting(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'upcoming' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => {
              setActiveTab('past');
              setSelectedMeeting(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'past' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Past History
          </button>
          <button
            onClick={() => {
              setActiveTab('all');
              setSelectedMeeting(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Meetings
          </button>
        </div>

        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            placeholder="Filter by title or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-250 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder-slate-400"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Meeting Cards List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-20 bg-white rounded-xl border border-slate-100" />
              <div className="h-20 bg-white rounded-xl border border-slate-100" />
              <div className="h-20 bg-white rounded-xl border border-slate-100" />
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
              <Video className="w-10 h-10 text-slate-350 mx-auto" />
              <div className="text-slate-800 font-bold">No meetings found</div>
              <div className="text-slate-500 text-sm">No meeting entries match this filter criteria.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMeetings.map((meeting) => (
                <div
                  key={meeting.meeting_id}
                  onClick={() => setSelectedMeeting(meeting)}
                  className={`bg-white border p-4.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-4 shadow-sm hover:border-slate-350 ${
                    selectedMeeting?.meeting_id === meeting.meeting_id
                      ? 'border-blue-550 ring-2 ring-blue-500/10'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-1.5 truncate">
                    <div className="font-bold text-slate-800 text-sm truncate">{meeting.title}</div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {meeting.scheduled_at ? formatTime(meeting.scheduled_at) : 'Instant'}
                      </span>
                      <span>•</span>
                      <span className="truncate">ID: {meeting.meeting_id}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/meeting/${meeting.meeting_id}`);
                    }}
                    className="bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-650 font-bold px-3 py-2 rounded-xl text-xs transition-all shrink-0 flex items-center gap-1"
                  >
                    <span>Join</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Details Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
          {selectedMeeting ? (
            <div className="space-y-5">
              <div className="space-y-1.5 border-b border-slate-100 pb-4">
                <div className="text-xs font-extrabold text-blue-600 uppercase tracking-widest">Selected Meeting</div>
                <h2 className="text-lg font-extrabold text-slate-800">{selectedMeeting.title}</h2>
                <div className="text-xs text-slate-450 mt-1">ID: {selectedMeeting.meeting_id}</div>
              </div>

              {selectedMeeting.description && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Description</span>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {selectedMeeting.description}
                  </p>
                </div>
              )}

              <div className="space-y-3.5 text-xs text-slate-650">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Type:</span>
                  <span className="capitalize font-bold text-slate-800">{selectedMeeting.meeting_type}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Status:</span>
                  <span className="capitalize font-bold text-slate-800">{selectedMeeting.status}</span>
                </div>
                {selectedMeeting.scheduled_at && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Date:</span>
                      <span className="font-bold text-slate-800">{formatDate(selectedMeeting.scheduled_at)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Time:</span>
                      <span className="font-bold text-slate-800">{formatTime(selectedMeeting.scheduled_at)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Duration:</span>
                      <span className="font-bold text-slate-800">{formatDuration(selectedMeeting.duration_minutes)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                <button
                  onClick={() => router.push(`/meeting/${selectedMeeting.meeting_id}`)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-md shadow-blue-600/10"
                >
                  Join Meeting
                </button>
                <button
                  onClick={() => handleCopyLink(selectedMeeting.meeting_id)}
                  className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Invite Link</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 space-y-2">
              <Info className="w-8 h-8 text-slate-350 mx-auto" />
              <div className="text-slate-800 font-bold text-sm">No meeting selected</div>
              <div className="text-slate-500 text-xs">Select a meeting from the list to view its full details.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
