/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Run, Workflow, RunLog, InterAgentMessage } from '../types';
import { 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  AlertTriangle, 
  Plus, 
  Clock, 
  Activity, 
  Hash, 
  DollarSign, 
  MessageSquare, 
  Terminal,
  MousePointer2,
  ListRestart
} from 'lucide-react';

interface ExecutionMonitorProps {
  workflows: Workflow[];
  runs: Run[];
  onTriggerRun: (workflowId: string, inputs: Record<string, string>) => Promise<Run>;
  onRefreshRuns: () => Promise<void>;
}

export default function ExecutionMonitor({ workflows, runs, onTriggerRun, onRefreshRuns }: ExecutionMonitorProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(workflows[0]?.id || '');
  const [ticketTopic, setTicketTopic] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [liveLogs, setLiveLogs] = useState<any[]>([]);

  const activeRun = runs.find(r => r.id === selectedRunId) || runs[0];

  useEffect(() => {
    if (runs.length > 0 && !selectedRunId) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs]);

  // Synchronize static log state on run selection shift
  useEffect(() => {
    if (activeRun) {
      setLiveLogs(activeRun.logs || []);
    }
  }, [activeRun?.id, activeRun?.logs]);

  // Handle live WebSockets log streaming during background execution
  useEffect(() => {
    if (!activeRun || (activeRun.status !== 'running' && activeRun.status !== 'idle')) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketHost = window.location.host || 'localhost:3000';
    const wsUrl = `${protocol}//${socketHost}/ws/logs/${activeRun.id}`;
    
    console.log("[WS Setup] Listening live trace events from", wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const logItem = JSON.parse(event.data);
        if (logItem && logItem.run_id === activeRun.id) {
          setLiveLogs(prev => {
            if (prev.some(l => l.id === logItem.id)) return prev;
            return [...prev, logItem];
          });
          onRefreshRuns();
        }
      } catch (err) {
        console.error("Failed to parse WebSocket trace JSON frame", err);
      }
    };

    ws.onerror = (err) => {
      console.warn("WebSocket client trace channel encountered warning", err);
    };

    return () => {
      console.log("[WS Connection] Disposed connection to active run trace observer", activeRun.id);
      ws.close();
    };
  }, [activeRun?.id, activeRun?.status]);

  // Handle periodic refresh during active run executions
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'running' || r.status === 'idle');
    if (hasRunning) {
      const interval = setInterval(() => {
        onRefreshRuns();
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [runs]);

  const handleStartTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkflowId) return;

    const inputs = {
      topic: ticketTopic || 'Integrate Rappi MCD API Checkout failure for McDonald\'s Bogota'
    };

    const newRun = await onTriggerRun(selectedWorkflowId, inputs);
    setSelectedRunId(newRun.id);
    setTicketTopic('');
  };

  return (
    <div className="space-y-8">
      {/* Trigger & Quick Start inputs */}
      <div className="bg-white p-8 border border-gray-200">
        <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-[9px] font-bold tracking-widest uppercase rounded mb-3">Live Pipeline Controller</span>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight leading-none mb-1">Trigger Autonomous Agent Pipeline</h3>
        <p className="text-xs text-gray-400 mt-1">Designate a workspace task context or customer issue and start the agent workflow runtime.</p>
        
        <form onSubmit={handleStartTask} className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 pb-1">
          <div className="md:col-span-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Target Pipeline</label>
            <select
              value={selectedWorkflowId}
              onChange={e => setSelectedWorkflowId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 bg-[#F9FAFB] text-xs font-semibold outline-none focus:border-black transition"
            >
              {workflows.map(wf => (
                <option key={wf.id} value={wf.id}>{wf.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Task Context Topic / Ticket Description</label>
              <input
                type="text"
                value={ticketTopic}
                onChange={e => setTicketTopic(e.target.value)}
                placeholder="e.g. Write a brief SEO article introducing Payments Orchestration in Colombia"
                className="w-full px-3.5 py-2.5 border border-gray-200 bg-white text-xs text-gray-700 outline-none focus:border-black transition"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto shrink-0 px-6 py-2.5 bg-black hover:bg-gray-800 text-white font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 cursor-pointer transition-colors duration-150"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Trigger Runtime
            </button>
          </div>
        </form>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-24 bg-white border border-gray-200">
          <Activity className="w-10 h-10 text-gray-300 mx-auto animate-pulse" />
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-4">Platform runtime is silent</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">Trigger an active workflow template above. The system will auto-compile agent prompts and communicate to deliver outcomes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* List of Prior Pipeline Runs */}
          <div className="bg-white border border-gray-200 p-6 h-[600px] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">Pipeline History</h3>
              <button 
                onClick={onRefreshRuns}
                className="px-2.5 py-1 bg-[#F9FAFB] hover:bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 animate-spin-reverse" /> Synchronize
              </button>
            </div>

            <div className="space-y-3">
              {runs.map(run => {
                const isActive = run.id === (activeRun?.id);
                return (
                  <div
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className={`w-full text-left p-4 border transition-all cursor-pointer ${
                      isActive 
                        ? 'border-black bg-gray-50/50' 
                        : 'border-gray-100 hover:border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-xs text-gray-900 block truncate max-w-[140px] uppercase tracking-tight">
                        {run.workflowName}
                      </span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        run.status === 'completed' 
                          ? 'bg-gray-100 text-gray-800 border border-gray-250' 
                          : run.status === 'running'
                            ? 'bg-black text-white animate-pulse'
                            : run.status === 'failed'
                              ? 'bg-red-50 text-red-700 border border-red-100'
                              : 'bg-gray-100 text-gray-500'
                      }`}>
                        {run.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 text-[10px] text-gray-400 mt-3 gap-1 font-mono">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-right">
                        #{run.id.substring(4, 9)}
                      </span>
                    </div>

                    <div className="mt-3 flex justify-between items-center text-[10px] pt-2 border-t border-gray-100 text-gray-500 font-mono">
                      <span>{run.tokenCount.toLocaleString()} tkn</span>
                      <span className="font-bold text-gray-800">${run.estimatedCost.toFixed(5)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active run trace detail viewport */}
          <div className="lg:col-span-2 flex flex-col h-[600px] gap-6">
            {activeRun && (
              <>
                {/* Statistics Box */}
                <div className="grid grid-cols-3 gap-4 bg-white p-5 border border-gray-200 text-gray-900 shrink-0">
                  <div className="text-center p-2 bg-[#F9FAFB] border border-gray-100">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-gray-400 block mb-1">State Run Status</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 inline-block uppercase tracking-wider ${
                      activeRun.status === 'completed' 
                        ? 'text-gray-800' 
                        : activeRun.status === 'running'
                          ? 'text-black animate-pulse'
                          : 'text-red-600'
                    }`}>
                      {activeRun.status}
                    </span>
                  </div>
                  <div className="text-center p-2 bg-[#F9FAFB] border border-gray-100">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-gray-400 block mb-1">Consumed Tokens</span>
                    <span className="text-xs font-mono font-bold text-gray-900 flex items-center justify-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-gray-400" /> {activeRun.tokenCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-center p-2 bg-[#F9FAFB] border border-gray-100">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-gray-400 block mb-1">Cost Tracker</span>
                    <span className="text-xs font-mono font-bold text-gray-900 flex items-center justify-center gap-0.5">
                      <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                      {activeRun.estimatedCost.toFixed(5)}
                    </span>
                  </div>
                </div>

                {/* Real-time Trace logs AND Inter-Agent Collaboration Conversations */}
                <div className="bg-white border border-gray-200 flex-1 min-h-0 flex flex-col p-6">
                  <div className="flex border-b border-gray-100 pb-4 shrink-0 justify-between items-center">
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-gray-500" />
                      Runtime Event Trace
                    </h3>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-gray-50 text-gray-500 tracking-tight border border-gray-100">
                      ID: {activeRun.id}
                    </span>
                  </div>

                  {/* Logs & Messages wrapper */}
                  <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-6">
                    {/* Inter Agent dialogue chat transcript */}
                    {activeRun.messages && activeRun.messages.length > 0 && (
                      <div className="space-y-4 pb-4 border-b border-gray-150">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">
                          Inter-Agent Collaboration Dialogues
                        </span>
                        
                        <div className="space-y-3">
                          {activeRun.messages.map((msg, i) => (
                            <div key={i} className="p-4 bg-gray-50 border border-gray-200">
                              <div className="flex justify-between items-center mb-1 text-[10px]">
                                <span className="font-bold text-black uppercase tracking-tight">
                                  {msg.senderName}
                                </span>
                                <span className="text-gray-400 font-mono text-[9px]">
                                  {new Date(msg.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-xs text-gray-650 leading-relaxed font-sans whitespace-pre-wrap">
                                {msg.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step-by-step logs */}
                    <div className="space-y-3">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">
                        Process Event Trail
                      </span>
                      {liveLogs && liveLogs.length > 0 ? (
                        <div className="space-y-1">
                          {liveLogs.map((log) => (
                            <div key={log.id} className="flex gap-2 text-xs leading-relaxed font-mono">
                              <span className="text-gray-400 shrink-0 select-none">
                                [{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                              </span>
                              
                              <span className={`shrink-0 uppercase font-extrabold text-[9px] tracking-wide ${
                                log.level === 'agent_response' 
                                  ? 'text-emerald-600' 
                                  : log.level === 'tool_call'
                                    ? 'text-amber-500'
                                    : log.level === 'input'
                                      ? 'text-blue-500'
                                      : log.level === 'error'
                                        ? 'text-rose-650'
                                        : 'text-gray-500'
                              }`}>
                                [{log.level || 'info'}]
                              </span>

                              <span className="text-gray-700 font-sans">
                                {log.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400 text-xs text-medium">
                          No trace logs recorded. Trigger a run above.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Output Display if execution complete */}
                  {activeRun.outputs && activeRun.outputs.finalResult && (
                    <div className="mt-4 p-5 border border-black bg-white rounded-none shrink-0">
                      <span className="text-[10px] font-bold text-gray-900 uppercase block tracking-wider mb-2">
                        🎉 Final Published Outcome Output
                      </span>
                      <div className="text-xs text-gray-750 font-sans prose max-w-none prose-sm leading-relaxed whitespace-pre-wrap bg-[#F9FAFB] p-4 border border-gray-100 font-medium">
                        {activeRun.outputs.finalResult}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
