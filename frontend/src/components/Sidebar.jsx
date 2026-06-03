import React from 'react';
import { NavLink } from 'react-router-dom';
import { Bot, Workflow, Activity, MessageSquare, Settings, Command } from 'lucide-react';

export default function Sidebar() {
  const activeStyle = "flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white bg-zinc-800 border-l-4 border-white transition-all";
  const inactiveStyle = "flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#9CA3AF] hover:text-white hover:bg-zinc-900 border-l-4 border-transparent transition-all";

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between text-white shrink-0">
      <div className="flex flex-col">
        {/* Sidebar Header Category */}
        <div className="h-20 border-b border-zinc-900 px-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold text-md font-mono">
            Y
          </div>
          <div>
            <h1 className="text-xs font-black tracking-widest uppercase">YUNO COGNITIVE</h1>
            <p className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">Multi-Agent Engine</p>
          </div>
        </div>

        {/* Sidebar Middle Navigation List */}
        <nav className="mt-8 flex flex-col space-y-1">
          <NavLink 
            to="/agents" 
            className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
          >
            <Bot className="w-4 h-4" /> Cognitive Profiles
          </NavLink>

          <NavLink 
            to="/workflows" 
            className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
          >
            <Workflow className="w-4 h-4" /> Pipeline Canvas
          </NavLink>

          <NavLink 
            to="/messages" 
            className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
          >
            <MessageSquare className="w-4 h-4" /> Session History
          </NavLink>

          <NavLink 
            to="/monitor" 
            className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
          >
            <Activity className="w-4 h-4" /> Live Tracer
          </NavLink>
        </nav>
      </div>

      {/* Sidebar Footer Category */}
      <div className="p-4 border-t border-zinc-900 text-[10px] font-bold uppercase tracking-widest text-zinc-600 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 matches-minimalist text-zinc-500">
          <Command className="w-3.5 h-3.5" /> status: online
        </div>
        <p className="leading-tight text-[9px] font-medium">© 2026 YUNO PLATFORM. CO.</p>
      </div>
    </aside>
  );
}
