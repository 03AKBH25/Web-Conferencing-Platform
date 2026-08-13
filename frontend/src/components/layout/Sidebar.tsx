"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Video, 
  Calendar, 
  Users, 
  Settings, 
  User, 
  HelpCircle,
  X
} from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Meetings', href: '/meetings', icon: Video },
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Contacts', href: '/contacts', icon: Users },
  ];

  const bottomItems = [
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-full shrink-0">
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-slate-850 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-600">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-base tracking-tight select-none">SyncMeet</span>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Nav */}
      <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-500 px-3 mb-2 uppercase tracking-wider select-none">
          Workspace
        </div>
        {navItems.map((item) => {
          const Active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                Active
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-5 h-5 ${Active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Nav */}
      <div className="p-4 border-t border-slate-850 space-y-1.5 shrink-0">
        {bottomItems.map((item) => {
          const Active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                Active
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-5 h-5 ${Active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-350 cursor-pointer select-none">
          <HelpCircle className="w-5 h-5 text-slate-500" />
          <span>Help Support</span>
        </div>
      </div>
    </div>
  );
};
export default Sidebar;
