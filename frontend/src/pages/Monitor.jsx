import React, { useEffect, useState, useRef } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Activity, ShieldAlert, Cpu, Layers, Disc, DollarSign, ArrowLeft } from 'lucide-react';
import LogStream from '../components/LogStream';

export default function Monitor() {
  const { id } = useParams();
  const [execution, setExecution] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchExecutionData = async () => {
    try {
      const [resExec, resMsgs] = await Promise.all([
        fetch(`/api/executions/${id}`),
        fetch(`/api/messages?execution_id=${id}`)
      ]);

      if (resExec.ok) setExecution(await resExec.json());
      if (resMsgs.ok) setMessages(await resMsgs.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutionData();
    // Poll execution metrics status
    const interval = setInterval(fetchExecutionData, 4030);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  // Calculate approximate pricing indices
  const tokenCount = messages.reduce((sum, m) => sum + (m.token_count || 120), 0) + 400;
  const estimatedCost = tokenCount * 0.00001;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner metrics display */}
      <div className="bg-white border border-gray-200 p-6 flex flex-col md:flex-row justify-between gap-6">
        <div className="flex items-center gap-3">
          <NavLink to="/messages" className="p-2 border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700">
            <ArrowLeft className="w-4 h-4" />
          </NavLink>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-600" /> Active Run Trace: {id}
            </h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 tracking-tight">Real-time systemic profiling & LangGraph evaluation</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 text-left">
          <div className="border-l-2 border-gray-150 pl-4">
            <span className="block text-[8px] font-bold uppercase tracking-widest text-gray-400">Pipeline Status</span>
            <span className={`inline-block mt-0.5 font-mono text-[10px] font-bold uppercase ${
              execution?.status === 'completed' 
                ? 'text-emerald-600' 
                : execution?.status === 'failed' 
                  ? 'text-rose-600' 
                  : 'text-sky-600 animate-pulse'
            }`}>
              ● {execution?.status || 'RUNNING'}
            </span>
          </div>

          <div className="border-l-2 border-gray-150 pl-4">
            <span className="block text-[8px] font-bold uppercase tracking-widest text-gray-400">Approx Tokens Consumed</span>
            <span className="block font-mono text-xs font-black text-gray-900 mt-0.5">{tokenCount} Tokens</span>
          </div>

          <div className="border-l-2 border-gray-150 pl-4">
            <span className="block text-[8px] font-bold uppercase tracking-widest text-gray-400">Total Accrued Cost</span>
            <span className="block font-mono text-xs font-black text-emerald-600 mt-0.5">
              ${estimatedCost.toFixed(5)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Dual-Panel Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[550px]">
        {/* Left Panel: Real-time WebSocket Stream */}
        <div className="h-full">
          <LogStream runId={id} />
        </div>

        {/* Right Panel: Chat Message Thread Viewer */}
        <div className="bg-white border border-gray-200 flex flex-col h-full overflow-hidden">
          <div className="h-14 border-b border-gray-150 px-6 flex items-center justify-between bg-[#F9FAFB] shrink-0 text-xs font-bold uppercase tracking-widest">
            <span className="flex items-center gap-1.5 matches-minimalist text-gray-700">
              <Cpu className="w-4 h-4 text-zinc-650" /> Message Payload Thread
            </span>
            <span className="text-[10px] text-gray-400 font-mono font-bold">{messages.length} DISPATCHES</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                <p className="text-xs font-bold uppercase tracking-widest leading-none">Starting agent generation cycle...</p>
                <p className="text-[9px] text-gray-400 mt-1 uppercase font-semibold">WebSockets tunnel established successfully.</p>
              </div>
            ) : (
              messages.map(msg => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                      {isUser ? 'Customer Input' : 'Agent: ' + (msg.agent_id || 'Summarizer')}
                    </span>
                    <div className={`p-4 max-w-[85%] border leading-relaxed text-xs font-medium ${
                      isUser 
                        ? 'bg-zinc-50 border-gray-200 text-gray-900' 
                        : 'bg-white border-zinc-200 text-gray-800'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
