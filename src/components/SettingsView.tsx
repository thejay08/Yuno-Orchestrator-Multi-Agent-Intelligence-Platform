/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../types';
import { 
  ShieldAlert, 
  Settings, 
  Cpu, 
  Lock, 
  HelpCircle, 
  Check, 
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface SettingsViewProps {
  onSaveSettings: (settings: SystemSettings) => Promise<void>;
}

export default function SettingsView({ onSaveSettings }: SettingsViewProps) {
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [slackBotToken, setSlackBotToken] = useState('');
  const [systemPromptGuardrails, setSystemPromptGuardrails] = useState(true);
  const [modelRateLimits, setModelRateLimits] = useState(20);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Read dynamic settings on mount
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setTelegramBotToken(data.telegramBotToken || '');
          setSlackBotToken(data.slackBotToken || '');
          setSystemPromptGuardrails(data.systemPromptGuardrails !== false);
          setModelRateLimits(data.modelRateLimits || 20);
        }
      } catch (err) {
        console.error("Failed to read platform settings", err);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onSaveSettings({
        telegramBotToken,
        slackBotToken,
        systemPromptGuardrails,
        modelRateLimits
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert("Failed to save credentials");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white p-8 border border-gray-200">
        <div className="flex items-center gap-3 pb-5 border-b border-gray-200">
          <Settings className="w-5 h-5 text-black" />
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">System Parameters</h3>
            <p className="text-xs text-gray-400 mt-0.5">Configure OAuth credentials, platform tokens, and safeguard levels.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Telegram Bot Setting */}
          <div className="space-y-2">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Telegram Bot Token
              </label>
              <a 
                href="https://t.me/BotFather" 
                target="_blank" 
                rel="noreferrer"
                className="text-[9px] text-gray-500 font-bold uppercase tracking-wider hover:text-black flex items-center gap-1 shrink-0"
              >
                Via @BotFather <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4 shrink-0" />
              </div>
              <input
                type="text"
                value={telegramBotToken}
                onChange={e => setTelegramBotToken(e.target.value)}
                placeholder="e.g. 7483921029:AAFjld...-sd82jslaK1"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 text-xs font-mono select-all focus:outline-none focus:border-black transition"
              />
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
              Updating this value registers a real-time web socket to forward customer Telegram messages straight into the designated pipeline workflow.
            </p>
          </div>

          {/* Slack Workspace Token Setting */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Slack Integration Client Token (Optional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={slackBotToken}
                onChange={e => setSlackBotToken(e.target.value)}
                placeholder="e.g. xoxb-workspace-token..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 text-xs font-mono focus:outline-none focus:border-black transition"
              />
            </div>
          </div>

          {/* Core switches */}
          <div className="pt-6 border-t border-gray-200 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5 mt-0.5">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wide block">
                  Systemic Security Guardrails
                </span>
                <span className="text-[10px] uppercase font-semibold text-gray-400 block tracking-tight leading-relaxed">
                  Enforces prompt sanitization across LLM triggers.
                </span>
              </div>
              <div className="relative shrink-0 flex items-center h-5">
                <input
                  type="checkbox"
                  checked={systemPromptGuardrails}
                  onChange={e => setSystemPromptGuardrails(e.target.checked)}
                  className="rounded-none border-gray-200 text-black focus:ring-black cursor-pointer h-4 w-4"
                />
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5 mt-0.5">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wide block">
                  Parallel Execution Throttle IP/RPM
                </span>
                <span className="text-[10px] uppercase font-semibold text-gray-400 block tracking-tight leading-relaxed">
                  Throttles parallel AI requests to prevent API credit exhaustion.
                </span>
              </div>
              <input
                type="number"
                value={modelRateLimits}
                onChange={e => setModelRateLimits(parseInt(e.target.value) || 20)}
                className="w-16 px-1.5 py-2 border border-gray-200 text-center text-xs font-mono font-bold"
              />
            </div>
          </div>

          {/* Saving notifications */}
          <div className="pt-6 border-t border-gray-200 flex justify-between items-center gap-4">
            <div className="flex-1">
              {saveSuccess && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 px-3.5 py-2 border border-green-200 flex items-center gap-1.5 matches-minimalist">
                  <Check className="w-3.5 h-3.5 shrink-0" /> Settings updated successfully
                </div>
              )}
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-black hover:bg-gray-800 text-white text-[10px] font-bold uppercase tracking-widest cursor-pointer transition flex items-center gap-2 shrink-0"
              disabled={isSaving}
            >
              {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Save System Parameters'}
            </button>
          </div>
        </form>
      </div>

      {/* Cloud Diagnostics */}
      <div className="bg-gray-50 p-6 border border-gray-150 text-xs text-gray-600 space-y-3 font-mono">
        <h4 className="font-bold text-gray-900 uppercase tracking-widest text-[10px] font-sans">Status Audit</h4>
        <div className="space-y-2">
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <span className="uppercase text-[9px] font-bold text-gray-400 tracking-wider">Database Status</span>
            <span className="text-green-600 font-bold uppercase text-[10px]">JSON PERSISTENT</span>
          </div>
          <div className="flex justify-between">
            <span className="uppercase text-[9px] font-bold text-gray-400 tracking-wider">Server Local Time</span>
            <span className="text-gray-900 font-bold text-[10px]">{new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
