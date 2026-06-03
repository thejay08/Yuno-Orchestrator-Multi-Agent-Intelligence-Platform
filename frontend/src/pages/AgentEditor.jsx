import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Bot, Save } from 'lucide-react';

export default function AgentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [tools, setTools] = useState([]);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [maxIterations, setMaxIterations] = useState(10);
  const [forbiddenTopicsString, setForbiddenTopicsString] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit) {
      // Find and load existing profiles
      fetch(`/api/agents/${id}`)
        .then(res => res.json())
        .then(data => {
          setName(data.name || '');
          setRole(data.role || '');
          setSystemPrompt(data.system_prompt || '');
          setModel(data.model || 'gpt-4o');
          setTools(data.tools || []);
          setMemoryEnabled(data.memory_enabled !== false);
          setMaxTokens(data.max_tokens || 2000);
          setTelegramEnabled(!!data.telegram_enabled);
          setMaxIterations(data.guardrails?.max_iterations || 10);
          setForbiddenTopicsString((data.guardrails?.forbidden_topics || []).join(', '));
        })
        .catch(err => console.error("Error fetching agent", err));
    }
  }, [id, isEdit]);

  const handleToolToggle = (tName) => {
    setTools(prev => prev.includes(tName) ? prev.filter(x => x !== tName) : [...prev, tName]);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      name,
      role,
      system_prompt: systemPrompt,
      model,
      tools,
      memory_enabled: memoryEnabled,
      max_tokens: parseInt(maxTokens) || 2000,
      telegram_enabled: telegramEnabled,
      guardrails: {
        max_iterations: parseInt(maxIterations) || 10,
        forbidden_topics: forbiddenTopicsString.split(',').map(x => x.trim()).filter(Boolean)
      }
    };

    try {
      const url = isEdit ? `/api/agents/${id}` : '/api/agents';
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        navigate('/agents');
      } else {
        alert("Failed to submit profile config.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 font-sans">
      <div className="flex items-center gap-3">
        <NavLink 
          to="/agents" 
          className="p-2 border border-gray-200 hover:bg-gray-50 flex items-center justify-center cursor-pointer text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
        </NavLink>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">
            {isEdit ? 'Modify Cognitive Agent' : 'Register New AI Block'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">Fine-tune system constraints, temperature levels, and active tools.</p>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="bg-white border border-gray-200 p-8 space-y-6">
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-widest">Agent Block Title</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Compliance Auditor"
              className="w-full px-3.5 py-2.5 border border-gray-200 text-xs font-semibold outline-none focus:border-black transition bg-white"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-widest">Agent Role / Context Specialist</label>
            <input 
              type="text" 
              value={role} 
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Code Reviewer & Style Auditor"
              className="w-full px-3.5 py-2.5 border border-gray-200 text-xs font-semibold outline-none focus:border-black transition"
              required
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-widest">Target Model Endpoint</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 text-xs font-bold uppercase tracking-wide bg-white outline-none focus:border-black transition"
            >
              <option value="gpt-4o">OpenAI GPT-4o Production Node</option>
              <option value="gpt-4o-mini">OpenAI GPT-4o-Mini (Inference Fast)</option>
              <option value="gpt-3.5-turbo">Legacy GPT-3.5-Turbo</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-widest">Max Token Threshold</label>
            <input 
              type="number" 
              value={maxTokens} 
              onChange={e => setMaxTokens(parseInt(e.target.value) || 2000)}
              className="w-full px-3.5 py-2.5 border border-gray-200 text-xs font-semibold outline-none focus:border-black transition bg-white"
              min={1}
            />
          </div>
        </div>

        {/* System Prompt */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-widest">System Instructions & Core Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder="Introduce system guidelines, tone boundaries, formatting instructions, and cognitive boundaries."
            className="w-full px-4 py-3 border border-gray-200 text-xs font-medium outline-none focus:border-black transition h-32 leading-relaxed bg-white"
            required
          />
        </div>

        {/* Multi-Select for Tools requested in spec */}
        <div className="space-y-3">
          <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-widest">Bound Validation Tools</label>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'DuckDuckGo Web Search', val: 'web_search' },
              { label: 'Sandbox Safe Math Calculator', val: 'calculator' },
              { label: 'ChatGPT Summarizer Agent', val: 'summarizer' },
              { label: 'Inter-Agent Dispatcher', val: 'send_message' }
            ].map(toolObj => {
              const selected = tools.includes(toolObj.val);
              return (
                <button
                  type="button"
                  key={toolObj.val}
                  onClick={() => handleToolToggle(toolObj.val)}
                  className={`p-3.5 border text-left cursor-pointer transition ${
                    selected ? 'border-black bg-gray-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-900">{toolObj.val}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{toolObj.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Channels Enable toggles */}
        <div className="border-t border-gray-150 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start justify-between p-4 bg-gray-55 border border-gray-150">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-900 block">Agent Memory Active (SQLite Tracer)</span>
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-tight block mt-0.5">Injects last 20 messages logs.</span>
            </div>
            <input 
              type="checkbox" 
              checked={memoryEnabled} 
              onChange={e => setMemoryEnabled(e.target.checked)}
              className="rounded-none border-gray-200 text-black focus:ring-black h-4 w-4 h-4"
            />
          </div>

          <div className="flex items-start justify-between p-4 bg-gray-55 border border-gray-150">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-900 block">Polling Bot Gateway Channel</span>
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-tight block mt-0.5">Launches poller for conversational chats.</span>
            </div>
            <input 
              type="checkbox" 
              checked={telegramEnabled} 
              onChange={e => setTelegramEnabled(e.target.checked)}
              className="rounded-none border-gray-200 text-black focus:ring-black h-4 w-4 h-4"
            />
          </div>
        </div>

        {/* Guardrails Category specifically requested in spec */}
        <div className="border-t border-gray-150 pt-6 space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Systemic Guardrails & Topics Moderation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Max Iterations Limit</label>
              <input 
                type="number" 
                value={maxIterations} 
                onChange={e => setMaxIterations(parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-200 text-xs font-bold outline-none focus:border-black transition"
                min={1}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Forbidden Topics (Comma Separated)</label>
              <input 
                type="text" 
                value={forbiddenTopicsString} 
                onChange={e => setForbiddenTopicsString(e.target.value)}
                placeholder="e.g. pricing disclosures, medical, legal suggestions"
                className="w-full px-3 py-2 border border-gray-200 text-xs font-semibold outline-none focus:border-black transition cursor-text"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-150 pt-6 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-black hover:bg-gray-800 text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 cursor-pointer transition duration-150"
          >
            {submitting ? 'COMMITTING WRITE...' : 'SAVE COGNITIVE PARAMETERS'} <Save className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
