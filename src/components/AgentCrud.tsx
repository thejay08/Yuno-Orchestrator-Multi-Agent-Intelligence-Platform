/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Agent } from '../types';
import { 
  Bot, 
  Plus, 
  Trash2, 
  Check, 
  Cpu, 
  ShieldAlert, 
  HelpCircle, 
  Clock, 
  Sparkle,
  Bookmark
} from 'lucide-react';

interface AgentCrudProps {
  agents: Agent[];
  onSaveAgent: (agent: Partial<Agent>) => Promise<void>;
  onDeleteAgent: (id: string) => Promise<void>;
}

export default function AgentCrud({ agents, onSaveAgent, onDeleteAgent }: AgentCrudProps) {
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Partial<Agent> | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('gemini-3.5-flash');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [schedules, setSchedules] = useState('manual');
  const [memoryType, setMemoryType] = useState('buffer_window');
  const [skillsInput, setSkillsInput] = useState('');
  const [interactionRules, setInteractionRules] = useState('');
  const [guardrails, setGuardrails] = useState('standard_moderation');

  const availableTools = [
    { id: 'google_search', label: 'Google Search Integration (API Tool)', desc: 'Invokes real-time web grounding for modern references.' },
    { id: 'math_engine', label: 'Compiler Math Engine', desc: 'Secure formula parser evaluating standard client equations.' },
    { id: 'file_writer', label: 'Persistent Document Writer', desc: 'Saves collaborative text directly to shared runtime folders.' },
    { id: 'file_reader', label: 'Document Schema Reader', desc: 'Retrieves prior written notes from workspace file layers.' }
  ];

  const availableChannels = [
    { id: 'telegram_external', label: 'Telegram External Bot API' },
    { id: 'whatsapp_external', label: 'WhatsApp Sandbox' },
    { id: 'web_chat', label: 'Web Platform Simulator' }
  ];

  const handleOpenEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setName(agent.name);
    setRole(agent.role);
    setSystemPrompt(agent.systemPrompt);
    setModel(agent.model);
    setSelectedTools(agent.tools || []);
    setSelectedChannels(agent.channels || []);
    setSchedules(agent.schedules);
    setMemoryType(agent.memoryType);
    setSkillsInput(agent.skills?.join(', ') || '');
    setInteractionRules(agent.interactionRules || '');
    setGuardrails(agent.guardrails || 'standard_moderation');
    setIsNewModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingAgent(null);
    setName('');
    setRole('');
    setSystemPrompt('');
    setModel('gemini-3.5-flash');
    setSelectedTools([]);
    setSelectedChannels(['web_chat']);
    setSchedules('manual');
    setMemoryType('buffer_window');
    setSkillsInput('');
    setInteractionRules('');
    setGuardrails('standard_moderation');
    setIsNewModalOpen(true);
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]
    );
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev => 
      prev.includes(channelId) ? prev.filter(c => c !== channelId) : [...prev, channelId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role || !systemPrompt) {
      alert("Please complete the required Name, Role and System instruction fields.");
      return;
    }

    const payload: Partial<Agent> = {
      ...(editingAgent?.id ? { id: editingAgent.id } : {}),
      name,
      role,
      systemPrompt,
      model,
      tools: selectedTools,
      channels: selectedChannels,
      schedules,
      memoryType,
      skills: skillsInput.split(',').map(s => s.trim()).filter(Boolean),
      interactionRules,
      guardrails
    };

    await onSaveAgent(payload);
    setIsNewModalOpen(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-[9px] font-bold tracking-widest uppercase rounded mb-2">Cognitive Architecture</span>
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">AI Agent Management</h2>
          <p className="text-xs text-gray-400">Configure core behavioral prompt structures, distinct skills, tool triggers, and schedules for individual agents.</p>
        </div>
        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-5 py-3 bg-black text-white text-[11px] font-bold uppercase tracking-widest transition-colors duration-150 hover:bg-gray-800"
        >
          <Plus className="w-4 h-4 text-white" /> Add Custom Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white border border-gray-200 p-6 flex flex-col justify-between hover:border-black transition-all">
            <div>
              <div className="flex justify-between items-start">
                <div className="p-3 bg-gray-100 text-black">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleOpenEdit(agent)}
                    className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-50 transition-colors cursor-pointer"
                    title="Edit Profile"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onDeleteAgent(agent.id)}
                    className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-50 transition-colors cursor-pointer"
                    title="Delete Agent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-bold uppercase text-gray-900 tracking-tight leading-tight">{agent.name}</h3>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">{agent.role}</p>
              </div>

              <p className="text-xs text-gray-650 mt-3 line-clamp-3 leading-relaxed bg-[#F9FAFB] p-3 border border-gray-100 font-mono">
                {agent.systemPrompt}
              </p>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-dashed border-gray-100">
                  <span className="text-gray-400">Model Space</span>
                  <span className="font-mono text-gray-700 font-bold">{agent.model}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-gray-100">
                  <span className="text-gray-400">Memory Store</span>
                  <span className="font-bold text-gray-700 uppercase tracking-tight">{agent.memoryType.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-gray-100">
                  <span className="text-gray-400">Guardrails Mode</span>
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-800 font-bold text-[9px] uppercase tracking-wider border border-gray-200">
                    {agent.guardrails.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-400">Schedule</span>
                  <span className="text-gray-700 font-bold uppercase">{agent.schedules}</span>
                </div>
              </div>

              {agent.skills && agent.skills.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1">
                  {agent.skills.map((skill, i) => (
                    <span key={i} className="px-2.5 py-0.5 bg-gray-50 text-gray-600 text-[9px] uppercase font-bold tracking-wider border border-gray-100">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                <Cpu className="w-3.5 h-3.5 text-gray-400" />
                <span>{agent.tools?.length || 0} Tools active</span>
              </div>
              <div className="flex items-center gap-1">
                {agent.channels?.map((chan, idx) => (
                  <span 
                    key={idx} 
                    className="px-2 py-0.5 bg-gray-100 text-gray-800 text-[9px] font-bold uppercase tracking-wider border border-gray-200"
                    title={`Channel connected: ${chan}`}
                  >
                    {chan.split('_')[0]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in animate-duration-150">
          <div className="bg-white border-2 border-black max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative">
            <h3 className="text-base font-bold uppercase tracking-wide text-gray-900 mb-1">
              {editingAgent ? 'Edit Agent Profile' : 'Configure New Agent'}
            </h3>
            <p className="text-xs text-gray-400">Determine cognitive characteristics and connection bindings targeting the real-time AI executor.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Agent Custom Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Finance Inspector"
                    className="w-full px-3.5 py-2.5 border border-gray-200 text-xs font-semibold uppercase tracking-tight outline-none focus:border-black transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Workplace Role / Duty *</label>
                  <input
                    type="text"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder="e.g. Risk Auditor"
                    className="w-full px-3.5 py-2.5 border border-gray-200 text-xs font-semibold uppercase tracking-tight outline-none focus:border-black transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Brain Model Engine</label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 bg-white text-xs font-bold uppercase tracking-wide outline-none focus:border-black transition"
                >
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Factual Reasoning & Highly Standard)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Advanced Audit, Coding & Highly reasoning)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">System Instructions (Prompt Anchor) *</label>
                <textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  rows={4}
                  placeholder="State how this agent behaves, evaluates data, formats output, and complies with instructions..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 text-xs font-mono outline-none focus:border-black transition"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Memory Architecture</label>
                  <select
                    value={memoryType}
                    onChange={e => setMemoryType(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 bg-white text-xs font-bold uppercase tracking-wide outline-none focus:border-black transition"
                  >
                    <option value="short_term">Short-term (Volatile session state)</option>
                    <option value="buffer_window">Buffer window (Prior 10 steps conversation history)</option>
                    <option value="long_term">Long-term Core Memory (Persistent Database embeddings)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Safety & Content Moderation Guardrails</label>
                  <select
                    value={guardrails}
                    onChange={e => setGuardrails(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 bg-white text-xs font-bold uppercase tracking-wide outline-none focus:border-black transition"
                  >
                    <option value="standard_moderation">Standard Moderation checks</option>
                    <option value="strict_finance">Strict Corporate Trust (Financial checks active)</option>
                    <option value="none">None (Raw experimental prompt execution)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Autonomous Trigger Schedule</label>
                  <select
                    value={schedules}
                    onChange={e => setSchedules(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 bg-white text-xs font-bold uppercase tracking-wide outline-none focus:border-black transition text-gray-755"
                  >
                    <option value="manual">Manual trigger (Only on Workflow execution)</option>
                    <option value="hourly">Hourly (Polls sources every hour)</option>
                    <option value="daily">Daily Cron (Executes checklist daily at 9:00 AM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Specific Skills (Comma-separated)</label>
                  <input
                    type="text"
                    value={skillsInput}
                    onChange={e => setSkillsInput(e.target.value)}
                    placeholder="e.g. Audit, SEO Keywords, French language"
                    className="w-full px-3.5 py-2.5 border border-gray-200 text-xs font-semibold outline-none focus:border-black transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Assign Behavioral Guardrails & Interaction Rules</label>
                <input
                  type="text"
                  value={interactionRules}
                  onChange={e => setInteractionRules(e.target.value)}
                  placeholder="e.g. Always outputs in highly structured bulleted formats. No conversational pleasantries."
                  className="w-full px-3.5 py-2.5 border border-gray-200 text-xs font-semibold outline-none focus:border-black transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2.5">Real Platform Tools Bindings</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableTools.map(t => (
                    <div 
                      key={t.id}
                      onClick={() => toggleTool(t.id)}
                      className={`p-4 border text-left cursor-pointer transition-all ${
                        selectedTools.includes(t.id) 
                          ? 'border-black bg-gray-50 text-black' 
                          : 'border-gray-200 hover:border-gray-300 text-gray-500'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-tight">{t.id.replace('_', ' ')}</span>
                        {selectedTools.includes(t.id) && <Check className="w-3.5 h-3.5 text-black" />}
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Connect Channels (Human interaction capability)</label>
                <div className="flex flex-wrap gap-2">
                  {availableChannels.map(c => {
                    const active = selectedChannels.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleChannel(c.id)}
                        className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                          active 
                            ? 'bg-black border-black text-white' 
                            : 'bg-white border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-600 bg-gray-50 hover:bg-gray-100 transition duration-150 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-black hover:bg-gray-800 transition duration-150 cursor-pointer shadow"
                >
                  {editingAgent ? 'Save Profile' : 'Instantiate Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
