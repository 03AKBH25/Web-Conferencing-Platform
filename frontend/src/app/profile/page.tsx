"use client";

import React, { useState, useEffect } from 'react';
import { User, Mail, ShieldCheck, RefreshCw, KeyRound } from 'lucide-react';
import { api, UserProfile } from '../../lib/api';
import { useToast } from '../../components/common/Toast';

export default function ProfilePage() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const handleUpdatePassword = () => {
    showToast('Password updates will be enabled when full auth models are deployed.', 'info');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Personal Profile</h1>
        <p className="text-slate-500 text-xs font-semibold">Manage your username details, account credentials, and defaults.</p>
      </div>

      {/* Main Profile Info Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="h-28 bg-gradient-to-r from-blue-600 to-indigo-700 relative" />

        {/* Profile Details Container */}
        <div className="p-6 pt-0 space-y-6 relative">
          
          {/* Avatar and Primary Details */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 pb-4 border-b border-slate-100">
            <div className="w-20 h-20 rounded-full bg-blue-600 text-white font-extrabold text-2xl flex items-center justify-center border-4 border-white shadow-md">
              {profile ? getInitials(profile.name) : 'AJ'}
            </div>
            <div className="space-y-0.5">
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-1.5">
                <span>{profile?.name || 'Alex Johnson'}</span>
                <span title="Verified Owner">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </span>
              </h2>
              <p className="text-slate-500 text-xs font-semibold">Workspace Owner</p>
            </div>
          </div>

          {/* Account properties */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Account Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>Username</span>
                </div>
                <div className="text-sm font-bold text-slate-800 mt-1">{profile?.username || 'alex'}</div>
              </div>

              <div className="space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Address</span>
                </div>
                <div className="text-sm font-bold text-slate-800 mt-1">{profile?.email || 'alex@example.com'}</div>
              </div>
            </div>
          </div>

          {/* Security Action Row */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="space-y-0.5 max-w-[70%]">
              <div className="text-sm font-bold text-slate-800">Account Security</div>
              <div className="text-xs text-slate-500">Update security parameters or credentials.</div>
            </div>
            <button
              onClick={handleUpdatePassword}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5"
            >
              <KeyRound className="w-4 h-4" />
              <span>Change Password</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
