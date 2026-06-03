/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Workflow as WorkflowIcon, 
  Activity, 
  MessageSquare, 
  Settings as SettingsIcon,
  HelpCircle,
  Network
} from 'lucide-react';
import { Agent, Workflow, Run, SystemSettings } from './types';
import AgentCrud from './components/AgentCrud';
import VisualWorkflowBuilder from './components/VisualWorkflowBuilder';
import ExecutionMonitor from './components/ExecutionMonitor';
import ExternalChannelSimulator from './components/ExternalChannelSimulator';
import SettingsView from './components/SettingsView';

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeTab, setActiveTab] = useState<'runs' | 'builder' | 'agents' | 'playground' | 'settings'>('runs');

  const [loading, setLoading] = useState(true);

  // Synchronize master states
  const refreshData = async () => {
    try {
      const [resAgents, resWorkflows, resRuns] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/workflows'),
        fetch('/api/runs')
      ]);

      if (resAgents.ok) setAgents(await resAgents.json());
      if (resWorkflows.ok) setWorkflows(await resWorkflows.json());
      if (resRuns.ok) {
        const sortedRuns = await resRuns.json();
        // Sort newest first
        sortedRuns.sort((a: Run, b: Run) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRuns(sortedRuns);
      }
    } catch (err) {
      console.error("State synch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    document.title = "Yuno Orchestrator | Multi-Agent Intelligence Platform";
  }, []);

  const handleSaveAgent = async (payload: Partial<Agent>) => {
    const isEdit = !!payload.id;
    const url = isEdit ? `/api/agents/${payload.id}` : '/api/agents';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (confirm("Disconnect and delete this Agent's profile database?")) {
      try {
        const response = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
        if (response.ok) {
          await refreshData();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSaveWorkflow = async (workflow: Workflow) => {
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      });
      if (response.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (confirm("Permanently wipe pipeline canvas and connections?")) {
      try {
        const response = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
        if (response.ok) {
          await refreshData();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleTriggerRun = async (workflowId: string, inputs: Record<string, string>): Promise<Run> => {
    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, inputs })
      });
      if (!response.ok) {
        throw new Error("Failed to start workflow pipeline");
      }
      const newRun = await response.json();
      await refreshData();
      return newRun;
    } catch (err: any) {
      alert(`Runtime start error: ${err.message}`);
      throw err;
    }
  };

  const handleSaveSettings = async (settings: SystemSettings) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!response.ok) {
        throw new Error("Failed to save credentials");
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center">
        <div className="h-10 w-10 border-2 border-black border-t-transparent rounded-none animate-spin mb-4" />
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest leading-none">Initializing Yuno Platform...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-between text-[#111827] antialiased font-sans">
      
      {/* Dynamic Minimal Header */}
      <header className="h-20 bg-white border-b border-gray-200 sticky top-0 z-40 shrink-0 px-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-black rounded-none flex items-center justify-center">
            <span className="text-white font-bold text-xl font-mono">Y</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight uppercase">Yuno Orchestrator</h1>
            <p className="text-xs text-gray-500">Multi-Agent Intelligence Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">Jay</p>
            <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Application Active</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-xs">
            J
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-10 py-12">
        
        {/* Intro Hero Section for Clean Minimalism Theme */}
        <div className="mb-10">
          <h2 className="text-4xl font-extrabold tracking-tighter leading-[1.1] mb-2">
            Yuno Orchestrator <span className="text-gray-400">& Multi-Agent Intelligence Platform</span>
          </h2>
          <p className="text-sm text-gray-500 max-w-2xl leading-relaxed">
            Build autonomous agent pipelines, configure cognitive profiles, and deploy across messaging channels from a single canvas.
          </p>
        </div>

        {/* Navigation Tabs Selector */}
        <div className="flex border-b border-gray-200 mb-8 overflow-x-auto shrink-0 space-x-1.5 scrollbar-thin">
          <button
            onClick={() => setActiveTab('runs')}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'runs' 
                ? 'border-black text-black' 
                : 'border-transparent text-gray-400 hover:text-black'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" /> Execution Tracer
          </button>

          <button
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'builder' 
                ? 'border-black text-black' 
                : 'border-transparent text-gray-400 hover:text-black'
            }`}
          >
            <WorkflowIcon className="w-4 h-4 shrink-0" /> Pipeline Canvas
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'agents' 
                ? 'border-black text-black' 
                : 'border-transparent text-gray-400 hover:text-black'
            }`}
          >
            <Bot className="w-4 h-4 shrink-0" /> Cognitive Profiles
          </button>

          <button
            onClick={() => setActiveTab('playground')}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'playground' 
                ? 'border-black text-black' 
                : 'border-transparent text-gray-400 hover:text-black'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" /> Channels Sandbox
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'settings' 
                ? 'border-black text-black' 
                : 'border-transparent text-gray-400 hover:text-black'
            }`}
          >
            <SettingsIcon className="w-4 h-4 shrink-0" /> Credentials
          </button>
        </div>

        {/* Tab Viewport Switcher */}
        <div className="animate-fade-in duration-300">
          {activeTab === 'runs' && (
            <ExecutionMonitor 
              workflows={workflows}
              runs={runs}
              onTriggerRun={handleTriggerRun}
              onRefreshRuns={refreshData}
            />
          )}

          {activeTab === 'builder' && (
            <VisualWorkflowBuilder 
              workflows={workflows}
              agents={agents}
              onSaveWorkflow={handleSaveWorkflow}
              onDeleteWorkflow={handleDeleteWorkflow}
            />
          )}

          {activeTab === 'agents' && (
            <AgentCrud 
              agents={agents}
              onSaveAgent={handleSaveAgent}
              onDeleteAgent={handleDeleteAgent}
            />
          )}

          {activeTab === 'playground' && (
            <ExternalChannelSimulator />
          )}

          {activeTab === 'settings' && (
            <SettingsView 
              onSaveSettings={handleSaveSettings}
            />
          )}
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="h-14 bg-white border-t border-gray-200 px-10 flex items-center justify-between flex-shrink-0 text-xs text-gray-400 font-medium">
        <p className="uppercase tracking-widest font-bold text-[10px]">© 2026 EXT India • Bogotá • Hyderabad • Singapore</p>
        <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest">
          <span className="text-gray-400">System Status: <span className="text-green-600">Active</span></span>
        </div>
      </footer>
    </div>
  );
}
