"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Bell, 
  Menu,
  ChevronDown,
  ExternalLink,
  Check,
  CheckCheck
} from 'lucide-react';
import { api, UserProfile, NotificationItem, NotificationsResponse } from '../../lib/api';
import { Meeting } from '../../types/meeting';
import { useToast } from '../common/Toast';

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const router = useRouter();
  const { showToast } = useToast();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Meeting[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Dropdown Refs for outside click cleanups
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const loadNotifications = () => {
    setNotificationLoading(true);
    setNotificationError(null);
    api.getNotifications()
      .then((data: NotificationsResponse) => {
        setNotifications(data.notifications);
      })
      .catch((err: unknown) => {
        console.error('Failed to load notifications:', err);
        setNotificationError('Failed to load notifications.');
      })
      .finally(() => {
        setNotificationLoading(false);
      });
  };

  // Fetch initial profile & notifications
  useEffect(() => {
    api.getProfile()
      .then(setProfile)
      .catch((err) => console.error('Failed to load profile:', err));

    const timer = setTimeout(() => {
      loadNotifications();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Debounced search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      const timer = setTimeout(() => {
        setSearchResults([]);
        setSearchLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    const delayDebounce = setTimeout(() => {
      setSearchLoading(true);
      api.searchMeetings(searchQuery)
        .then((results) => {
          setSearchResults(results);
          setSearchLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setSearchLoading(false);
        });
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotificationDropdown(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notifications Actions
  const handleMarkAsRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      showToast('Notification marked as read', 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showToast('All notifications marked as read', 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleSearchResultClick = (meetingId: string) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    router.push(`/meeting/${meetingId}`);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0 shadow-sm relative z-30">
      {/* Left Menu / Greeting */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="md:hidden text-slate-650 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block text-sm font-semibold text-slate-500">
          SyncMeet Workspace
        </div>
      </div>

      {/* Global Search Bar */}
      <div ref={searchRef} className="flex-1 max-w-md mx-6 relative">
        <div className="relative">
          <input
            type="text"
            placeholder="Search meetings by ID, title..."
            value={searchQuery}
            onFocus={() => setShowSearchDropdown(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all placeholder-slate-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Search Results Dropdown */}
        {showSearchDropdown && searchQuery && (
          <div className="absolute top-12 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
            {searchLoading ? (
              <div className="p-4 text-center text-sm text-slate-400">Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">No meetings found</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {searchResults.map((meeting) => (
                  <div
                    key={meeting.meeting_id}
                    onClick={() => handleSearchResultClick(meeting.meeting_id)}
                    className="p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{meeting.title}</div>
                      <div className="text-xs text-slate-400">ID: {meeting.meeting_id} ({meeting.status})</div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-350" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action items */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div ref={notificationRef} className="relative">
          <button
            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
            className="p-2 text-slate-605 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4.5 h-4.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotificationDropdown && (
            <div className="absolute top-12 right-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-96">
              <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-slate-50">
                <span className="font-bold text-slate-800 text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-blue-600 hover:text-blue-750 font-bold flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-72">
                {notificationLoading ? (
                  <div className="p-6 text-center text-sm text-slate-400">Loading notifications...</div>
                ) : notificationError ? (
                  <div className="p-6 text-center text-sm text-rose-500">{notificationError}</div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-455">No notifications</div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3.5 transition-colors flex items-start gap-2.5 ${
                        notif.is_read ? 'bg-white' : 'bg-blue-50/20'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-800">{notif.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {new Date(notif.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {!notif.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="p-1 rounded bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-slate-100 transition-all text-left"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
              {profile ? getInitials(profile.name) : 'AJ'}
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {/* Profile Dropdown */}
          {showProfileDropdown && (
            <div className="absolute top-12 right-0 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100">
              <div className="p-4 bg-slate-50">
                <div className="text-sm font-bold text-slate-800 truncate">{profile?.name || 'Alex Johnson'}</div>
                <div className="text-xs text-slate-500 truncate mt-0.5">{profile?.email || 'alex@example.com'}</div>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => {
                    setShowProfileDropdown(false);
                    router.push('/profile');
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm text-slate-650 hover:bg-slate-100 hover:text-slate-900 transition-colors font-medium"
                >
                  My Profile
                </button>
                <button
                  onClick={() => {
                    setShowProfileDropdown(false);
                    router.push('/settings');
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm text-slate-650 hover:bg-slate-100 hover:text-slate-900 transition-colors font-medium"
                >
                  Account Settings
                </button>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => {
                    setShowProfileDropdown(false);
                    showToast('Host auth bypass toggle active', 'info');
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm text-blue-600 hover:bg-blue-50 font-bold transition-colors"
                >
                  Demo Mode Host Override
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
export default Header;
