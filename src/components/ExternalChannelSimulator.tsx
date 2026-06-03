/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ExternalSimMessage } from '../types';
import { 
  Send, 
  Trash2, 
  Clock, 
  Bot, 
  User, 
  ExternalLink,
  MessageCircle,
  HelpCircle
} from 'lucide-react';

export default function ExternalChannelSimulator() {
  const [activeChannel, setActiveChannel] = useState<'telegram' | 'whatsapp' | 'slack'>('telegram');
  const [messages, setMessages] = useState<ExternalSimMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/telegram/messages?channel=${activeChannel}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Failed to read messages", err);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(() => {
      fetchHistory();
    }, 3000);
    return () => clearInterval(interval);
  }, [activeChannel]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const textToSend = inputValue;
    setInputValue('');
    setIsLoading(true);

    // Optimized client optimistic update
    const optimisticVal: ExternalSimMessage = {
      id: `opt-${Math.random()}`,
      sender: 'human',
      senderName: 'Jay (User)',
      content: textToSend,
      timestamp: new Date().toISOString(),
      channel: activeChannel
    };
    setMessages(prev => [...prev, optimisticVal]);

    try {
      const response = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: activeChannel,
          content: textToSend
        })
      });
      if (response.ok) {
        await fetchHistory();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (confirm("Reset conversation logs inside simulator?")) {
      try {
        await fetch('/api/telegram/clear');
        setMessages([]);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Channels Picker controls */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 border border-gray-200">
          <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-[9px] font-bold tracking-widest uppercase rounded mb-3">Gateway Router</span>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Live Gateway Channels</h3>
          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            Test conversational human-in-the-loop triggers using live simulator sandboxes. At least 1 agent is connected to each interface.
          </p>

          <div className="space-y-3">
            {[
              { id: 'telegram', title: 'Telegram Bot Client Sim', badges: ['ONLINE'] },
              { id: 'whatsapp', title: 'WhatsApp Sandbox', badges: ['ONLINE'] },
              { id: 'slack', title: 'Slack Workspace Agent', badges: ['SIMULATOR ONLY'] }
            ].map(chan => {
              const active = activeChannel === chan.id;
              return (
                <button
                  key={chan.id}
                  onClick={() => setActiveChannel(chan.id as any)}
                  className={`w-full p-4 text-left border transition-all flex items-center justify-between cursor-pointer ${
                    active 
                      ? 'border-black bg-gray-50' 
                      : 'bg-white hover:bg-[#F9FAFB] border-gray-150'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-tight text-gray-900">{chan.title}</span>
                  {chan.badges.map((b, i) => (
                    <span key={i} className="px-1.5 py-0.2 bg-gray-100 border border-gray-200 text-gray-700 font-mono text-[8px] font-bold uppercase">
                      {b}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        </div>

        {/* Informational helpful tip */}
        <div className="bg-gray-50 p-6 border border-gray-150 text-xs text-gray-600 leading-relaxed space-y-2">
          <h4 className="font-bold text-gray-900 uppercase tracking-widest text-[10px] flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-gray-400 shrink-0" />
            Integrate Real Bot:
          </h4>
          <p className="text-gray-500 font-medium leading-relaxed">You can connect a live Telegram Bot! Navigate to the <b>Platform Settings</b> tab, save your credentials bot token, and text your bot on your phone. It will execute server queries in real-time!</p>
        </div>
      </div>

      {/* Messaging Shell Mockup Frame */}
      <div className="lg:col-span-3 bg-white border border-gray-200 flex flex-col h-[550px] overflow-hidden">
        {/* Chat top header */}
        <div className="p-4 bg-white border-b border-gray-150 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 bg-gray-100 text-black border border-gray-200`}>
              <MessageCircle className="w-4 h-4 animate-pulse text-gray-900" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider capitalize">{activeChannel} Channel Simulator</h3>
              <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mt-0.5">Live Webhook Sandbox Proxy Gateway</p>
            </div>
          </div>

          <button
            onClick={handleClearHistory}
            className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear History
          </button>
        </div>

        {/* Messaging Logs bubble area */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#FAFAFA]"
        >
          {messages.length === 0 ? (
            <div className="text-center py-24 text-gray-400 space-y-3">
              <Bot className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-xs font-bold uppercase tracking-widest">No conversation entries on this gateway</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto font-medium">Send an initial test message below. It will forward directly to the AI agent handling {activeChannel} communications.</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isUser = msg.sender === 'human';
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] p-4 text-xs leading-relaxed space-y-1 ${
                      isUser 
                        ? 'bg-black text-white' 
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}>
                      <div className="flex justify-between items-center gap-8 text-[9px] font-bold uppercase tracking-wider opacity-60 mb-1 select-none font-mono">
                        <span>{isUser ? '👤 You' : `🤖 ${msg.senderName}`}</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="whitespace-pre-wrap font-sans font-medium text-xs leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 p-4 max-w-[75%] text-xs text-gray-400 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-black animate-ping" />
                    <span className="font-medium font-sans">Evaluating systemic instructions and constructing response...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action interactive text entry */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-150 flex gap-3 shrink-0">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder={`Type a message to simulate external user querying ${activeChannel} bot...`}
            className="flex-1 bg-white border border-gray-200 focus:border-black text-xs text-gray-800 px-4 py-3 outline-none transition font-medium"
            disabled={isLoading}
            required
          />
          <button
            type="submit"
            className="px-6 bg-black hover:bg-gray-800 text-white uppercase tracking-widest text-[11px] font-bold cursor-pointer disabled:opacity-50 transition flex items-center justify-center"
            disabled={isLoading || !inputValue.trim()}
          >
            <Send className="w-3.5 h-3.5 fill-current" />
          </button>
        </form>
      </div>
    </div>
  );
}
