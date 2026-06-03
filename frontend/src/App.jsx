import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Agents from './pages/Agents';
import AgentEditor from './pages/AgentEditor';
import Workflows from './pages/Workflows';
import WorkflowBuilder from './pages/WorkflowBuilder';
import Messages from './pages/Messages';
import Monitor from './pages/Monitor';
import { BadgeInfo } from 'lucide-react';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-[#F9FAFB] text-[#111827] overflow-hidden antialiased font-sans">
        
        {/* Dark Sidebar Navigation Panel */}
        <Sidebar />

        {/* Content Viewport Wrapper */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Header Dashboard Bar */}
          <header className="h-20 bg-white border-b border-gray-200 shrink-0 px-10 flex items-center justify-between z-10 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="p-1 px-2.5 bg-zinc-900 text-white font-mono text-[10px] font-bold uppercase tracking-widest leading-none">STREAMS OFF</span>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">Autonomous Operations Hub</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-900">Jay Koshta</p>
                <p className="text-[9px] text-green-600 font-bold uppercase tracking-wider mt-0.5">Assessment Lead</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-zinc-150 border border-zinc-250 flex items-center justify-center font-bold text-xs uppercase shadow-inner bg-zinc-50">
                JK
              </div>
            </div>
          </header>

          {/* Interactive Workspace Body Area */}
          <main className="flex-1 overflow-y-auto p-10 bg-[#FCFCFD]">
            <Routes>
              <Route path="/" element={<Navigate to="/agents" replace />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/new" element={<AgentEditor />} />
              <Route path="/agents/:id" element={<AgentEditor />} />
              <Route path="/workflows" element={<Workflows />} />
              <Route path="/workflows/:id" element={<WorkflowBuilder />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/monitor/:id" element={<Monitor />} />
              <Route path="*" element={<Navigate to="/agents" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
