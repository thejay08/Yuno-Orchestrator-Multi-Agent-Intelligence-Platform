import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Bot, Plus, Trash2, Edit3, ShieldAlert, BadgeInfo } from 'lucide-react';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        setAgents(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this cognitive agent profile?")) {
      try {
        const response = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
        if (response.ok) {
          fetchAgents();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="h-6 w-6 border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      <div className="flex justify-between items-center bg-white p-6 border border-gray-200">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">Cognitive Agent Directory</h2>
          <p className="text-xs text-gray-400 mt-1">Configure systemic prompts, rate throttles, and tools assigned directly to model endpoints.</p>
        </div>
        <NavLink 
          to="/agents/new" 
          className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition duration-150"
        >
          <Plus className="w-3.5 h-3.5" /> New Agent Profile
        </NavLink>
      </div>

      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-gray-150 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <th className="py-4 px-6">Profile Identifier</th>
              <th className="py-4 px-6">Agent Role</th>
              <th className="py-4 px-6">Assigned LLM</th>
              <th className="py-4 px-6">Tools Bound</th>
              <th className="py-4 px-6">Bot Gateway</th>
              <th className="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150 text-xs">
            {agents.map(agent => (
              <tr key={agent.id} className="hover:bg-[#FCFDFD] transition">
                <td className="py-4 px-6 font-bold text-gray-900 flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5 text-gray-600" />
                  <div>
                    <span>{agent.name}</span>
                    <span className="block text-[9px] font-mono font-bold text-gray-400">{agent.id}</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-gray-500 font-medium font-sans uppercase text-[10px] tracking-tight">{agent.role}</td>
                <td className="py-4 px-6 text-gray-700 font-mono text-[10px] font-bold">{agent.model}</td>
                <td className="py-4 px-6">
                  {agent.tools && agent.tools.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {agent.tools.map(t => (
                        <span key={t} className="px-1.5 py-0.2 bg-gray-50 border border-gray-150 text-gray-655 font-mono text-[9px]">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 font-medium italic text-[10px]">No Tools Connected</span>
                  )}
                </td>
                <td className="py-4 px-6">
                  <span className={`inline-block px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase ${
                    agent.telegram_enabled 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' 
                      : 'bg-gray-50 text-gray-400 border border-gray-250'
                  }`}>
                    {agent.telegram_enabled ? 'TELEGRAM LIVE' : 'PLAYGROUND ONLY'}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="flex justify-end gap-3">
                    <NavLink
                      to={`/agents/${agent.id}`}
                      className="p-1 px-2 hover:bg-gray-50 border border-gray-150 text-gray-700 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                      title="Edit Agent"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </NavLink>
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="p-1 px-2 hover:bg-rose-50 border border-gray-150 text-rose-600 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                      title="Delete Agent"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
