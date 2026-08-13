"use client";

import React, { useState, useEffect } from 'react';
import { Mail, Shield, User, Search, RefreshCw, MessageSquare } from 'lucide-react';
import { api, UserProfile } from '../../lib/api';
import { useToast } from '../../components/common/Toast';

interface Contact {
  id: number;
  name: string;
  email: string;
  role: 'Host' | 'Manager' | 'Participant';
  status: 'online' | 'offline';
}

export default function ContactsPage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.getProfile()
      .then((data: UserProfile) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // Mock workspace team contacts to complement the default backend user
  const teamDirectory: Contact[] = [
    { id: 1, name: profile?.name || 'Alex Johnson', email: profile?.email || 'alex@example.com', role: 'Host', status: 'online' },
    { id: 2, name: 'Sarah Miller', email: 'sarah.m@example.com', role: 'Manager', status: 'online' },
    { id: 3, name: 'David Chen', email: 'd.chen@example.com', role: 'Participant', status: 'offline' },
    { id: 4, name: 'Emily Taylor', email: 'emily.t@example.com', role: 'Participant', status: 'online' },
    { id: 5, name: 'Robert Johnson', email: 'r.johnson@example.com', role: 'Participant', status: 'offline' },
  ];

  const filteredDirectory = teamDirectory.filter((contact) => {
    const q = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(q) ||
      contact.email.toLowerCase().includes(q) ||
      contact.role.toLowerCase().includes(q)
    );
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const handleStartChat = (name: string) => {
    showToast(`Direct message chat with ${name} will be active in the next phase!`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Workspace Directory</h1>
        <p className="text-slate-500 text-xs font-semibold">Connect with active members and teammates on your SyncMeet instance.</p>
      </div>

      {/* Controllers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="text-sm font-bold text-slate-650">
          Members ({filteredDirectory.length})
        </div>

        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            placeholder="Search directory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-250 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder-slate-400"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : filteredDirectory.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
          <User className="w-10 h-10 text-slate-350 mx-auto" />
          <div className="text-slate-800 font-bold">No contacts found</div>
          <div className="text-slate-500 text-sm">No members match your directory search criteria.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDirectory.map((contact) => (
            <div
              key={contact.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-4 hover:border-slate-300 transition-colors"
            >
              {/* Avatar status */}
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-blue-600/10 text-blue-600 font-bold flex items-center justify-center text-sm border border-blue-500/10">
                  {getInitials(contact.name)}
                </div>
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                  contact.status === 'online' ? 'bg-emerald-500' : 'bg-slate-350'
                }`} />
              </div>

              {/* Bio details */}
              <div className="flex-1 space-y-1 truncate">
                <div className="flex items-center gap-2 max-w-full">
                  <span className="font-extrabold text-slate-800 text-sm truncate">{contact.name}</span>
                  {contact.role === 'Host' && (
                    <span title="Workspace Owner">
                      <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{contact.email}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                    {contact.role}
                  </span>
                  <button
                    onClick={() => handleStartChat(contact.name)}
                    className="text-xs text-blue-600 hover:text-blue-750 font-bold flex items-center gap-1 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
