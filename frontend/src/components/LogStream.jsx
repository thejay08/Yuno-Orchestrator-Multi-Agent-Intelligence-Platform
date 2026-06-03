import React, { useEffect, useRef, useState } from 'react';
import { Terminal, RefreshCw } from 'lucide-react';

export default function LogStream({ runId }) {
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!runId) return;

    // Connect to FastAPI workspace WebSocket server
    const socketUrl = `ws://localhost:8000/api/executions/ws/executions/${runId}`;
    const ws = new WebSocket(socketUrl);

    ws.onopen = () => {
      setConnected(true);
      setLogs([{
        timestamp: new Date().toISOString(),
        message: "STREAMS MANAGER: Handshake established with LangGraph execution engine.",
        level: "system"
      }]);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.message) {
          setLogs(prev => [...prevs = prev, {
            timestamp: new Date().toISOString(),
            message: payload.message,
            level: payload.level || 'info'
          }]);
        }
      } catch (err) {
        // Handle non-JSON keepalives silently
      }
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [runId]);

  // Handle auto-scroll to latest updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLevelStyles = (level) => {
    switch (level) {
      case 'system': return 'text-zinc-500 font-bold';
      case 'success': return 'text-emerald-600 font-bold';
      case 'warn': return 'text-amber-600 font-bold';
      case 'error': return 'text-rose-600 font-bold';
      default: return 'text-sky-600 font-semibold';
    }
  };

  return (
    <div className="bg-[#FCFDFD] border border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Stream Header controls */}
      <div className="h-14 border-b border-gray-150 px-6 flex items-center justify-between text-xs font-bold uppercase tracking-widest bg-[#F9FAFB]">
        <span className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-zinc-600 animate-pulse" /> Live Event Stream
        </span>
        <span className="flex items-center gap-1.5 matches-minimalist text-[10px] text-zinc-400">
          <RefreshCw className={`w-3.5 h-3.5 ${connected ? 'animate-spin text-green-600' : 'text-gray-450'}`} />
          {connected ? 'STREAMS LIVE' : 'TUNNEL CLOSED'}
        </span>
      </div>

      {/* Actual console contents */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-xs">
        {logs.map((log, idx) => (
          <div key={idx} className="flex gap-4">
            <span className="text-gray-400 select-none text-[10px]">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <div className="flex-1 whitespace-pre-wrap leading-relaxed">
              <span className={`mr-2 [${getLevelStyles(log.level)}]`}>
                [{log.level || 'info'}]
              </span>
              <span className="text-gray-800 font-medium">
                {log.message}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
