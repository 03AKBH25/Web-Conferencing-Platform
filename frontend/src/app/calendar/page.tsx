"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  ExternalLink, 
  CalendarDays,
  Copy,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';
import { Meeting } from '../../types/meeting';
import { useToast } from '../../components/common/Toast';
import { formatTime, formatDuration } from '../../lib/utils';

export default function CalendarPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar dates state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  
  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAllMeetings('scheduled');
      setMeetings(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load scheduled calendar events', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMeetings();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadMeetings]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Days of week header
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Helper calculations for calendar monthly view grid
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonthDays = Array.from(
    { length: firstDayIndex },
    (_, i) => daysInPrevMonth - firstDayIndex + i + 1
  );
  
  const currentMonthDays = Array.from(
    { length: totalDays },
    (_, i) => i + 1
  );

  // Month navigators
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDaySelect = (dayNum: number) => {
    setSelectedDate(new Date(year, month, dayNum));
  };

  // Get meetings scheduled on a specific calendar cell day
  const getMeetingsForDay = (checkDate: Date) => {
    return meetings.filter((meeting) => {
      if (!meeting.scheduled_at) return false;
      const mDate = new Date(meeting.scheduled_at);
      return (
        mDate.getFullYear() === checkDate.getFullYear() &&
        mDate.getMonth() === checkDate.getMonth() &&
        mDate.getDate() === checkDate.getDate()
      );
    });
  };

  // Check if a cell date is the currently selected date
  const isSelectedCell = (dayNum: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === dayNum
    );
  };

  // Check if a cell date is "Today"
  const isTodayCell = (dayNum: number) => {
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === dayNum
    );
  };

  // Active meetings on selected day
  const activeDayMeetings = selectedDate ? getMeetingsForDay(selectedDate) : [];

  const handleCopyLink = (meetingId: string) => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link)
      .then(() => showToast('Invite link copied successfully!', 'success'))
      .catch(() => showToast('Failed to copy invite', 'error'));
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Calendar Planner</h1>
        <p className="text-slate-500 text-xs font-semibold">Organize and visualize scheduled sessions inside your monthly planner.</p>
      </div>

      {/* Main Grid split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Monthly Calendar View (Left 2 columns) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
          
          {/* Header controllers */}
          <div className="flex items-center justify-between pb-2">
            <h2 className="font-extrabold text-slate-800 text-lg">
              {monthNames[month]} {year}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToday}
                className="bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                Today
              </button>
              <div className="flex items-center border border-slate-200 rounded-lg">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-slate-50 text-slate-500 border-r border-slate-200 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-slate-50 text-slate-500 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Days headers */}
            {daysOfWeek.map((day) => (
              <div key={day} className="text-slate-400 font-bold text-xs py-2 select-none uppercase tracking-wider">
                {day}
              </div>
            ))}

            {/* Leading blank/previous month cells */}
            {prevMonthDays.map((day, idx) => (
              <div
                key={`prev-${idx}`}
                className="h-16 border border-slate-50 text-slate-300 text-xs p-1 bg-slate-50/20 text-left select-none pointer-events-none"
              >
                {day}
              </div>
            ))}

            {/* Current month cells */}
            {currentMonthDays.map((day) => {
              const checkDate = new Date(year, month, day);
              const dayMeetings = getMeetingsForDay(checkDate);
              const isSelected = isSelectedCell(day);
              const isToday = isTodayCell(day);

              return (
                <div
                  key={`curr-${day}`}
                  onClick={() => handleDaySelect(day)}
                  className={`h-16 border border-slate-100 p-1.5 text-left text-xs transition-all relative cursor-pointer select-none group flex flex-col justify-between ${
                    isSelected 
                      ? 'bg-blue-600/5 border-blue-400 ring-1 ring-blue-400' 
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                    isToday 
                      ? 'bg-blue-600 text-white' 
                      : isSelected 
                      ? 'text-blue-600' 
                      : 'text-slate-700'
                  }`}>
                    {day}
                  </span>
                  
                  {/* Event marker count dots */}
                  {dayMeetings.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 overflow-hidden shrink-0">
                      {dayMeetings.slice(0, 3).map((m, idx) => (
                        <span key={idx} className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                      ))}
                      {dayMeetings.length > 3 && (
                        <span className="text-[9px] text-slate-400 font-bold leading-none shrink-0">
                          +{dayMeetings.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected date Details view (Right Column) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 space-y-1">
            <div className="text-xs font-extrabold text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" />
              <span>Agenda Planner</span>
            </div>
            <h3 className="font-extrabold text-slate-805 text-sm">
              {selectedDate ? selectedDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Select Date'}
            </h3>
          </div>

          {loading ? (
            <div className="text-center py-6 text-xs text-slate-400">Loading events...</div>
          ) : activeDayMeetings.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Info className="w-8 h-8 text-slate-350 mx-auto" />
              <div className="text-slate-800 font-bold text-sm">No scheduled events</div>
              <div className="text-slate-500 text-xs">There are no conferences planned for this date.</div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {activeDayMeetings.map((meeting) => (
                <div
                  key={meeting.meeting_id}
                  className="p-3.5 border border-slate-150 rounded-xl space-y-3.5 hover:border-slate-300 transition-colors shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-slate-800 text-sm">{meeting.title}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{meeting.scheduled_at ? formatTime(meeting.scheduled_at) : ''} ({formatDuration(meeting.duration_minutes)})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/meeting/${meeting.meeting_id}`)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <span>Join</span>
                      <ExternalLink className="w-3 h-3 text-white" />
                    </button>
                    <button
                      onClick={() => handleCopyLink(meeting.meeting_id)}
                      className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl transition-all"
                      title="Copy Invite Details"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
