"use client";

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Detect if we are inside a meeting room
  const isMeetingRoom = pathname?.startsWith('/meeting/');

  if (isMeetingRoom) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* Sidebar for Desktop */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar Drawer for Mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/60 backdrop-blur-sm">
          <div className="relative animate-slide-right h-full">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
          <div 
            onClick={() => setMobileOpen(false)} 
            className="flex-1 cursor-pointer" 
          />
        </div>
      )}

      {/* Main App Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header onMenuToggle={() => setMobileOpen(true)} />
        
        {/* Scrollable Workspace content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
export default AppShell;
