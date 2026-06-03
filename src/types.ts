/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Agent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  model: string; // e.g. "gemini-3.5-flash"
  tools: string[]; // e.g. ["google_search", "math_engine", "file_writer"]
  channels: string[]; // e.g. ["telegram_external", "web_chat", "slack_external"]
  schedules: string; // e.g. "manual" | "hourly" | "daily" (autonomous triggers)
  memoryType: string; // e.g. "short_term" | "buffer_window" | "long_term"
  skills: string[]; // e.g. ["reasoning", "coding", "negotiation"]
  interactionRules: string; // e.g. "always verify facts" | "be professional"
  guardrails: string; // e.g. "standard_moderation" | "strict_finance" | "none"
  createdAt: string;
}

export interface WorkflowNode {
  id: string;
  type: 'agent' | 'condition' | 'input' | 'output';
  label: string;
  agentId?: string;
  config?: {
    conditionExpression?: string; // e.g. "if status is approved" or regex
    yesNodeId?: string;
    noNodeId?: string;
    loopBackNodeId?: string; // For feedback loops
    loopCountLimit?: number;
    outputPath?: string;
  };
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string; // node ID
  target: string; // node ID
  conditionLabel?: string; // label like "Approved" or "Fix Draft" or "Default"
  isFeedbackLoop?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
}

export interface RunLog {
  id: string;
  timestamp: string;
  nodeId?: string;
  agentId?: string;
  agentName?: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface InterAgentMessage {
  id: string;
  timestamp: string;
  senderId: string; // agentId or "user" or "system"
  senderName: string;
  receiverId: string; // agentId or "user" or "channel"
  receiverName: string;
  content: string;
  payload?: any;
}

export interface Run {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  currentNodeId?: string;
  logs: RunLog[];
  messages: InterAgentMessage[];
  tokenCount: number;
  estimatedCost: number; // in USD
  createdAt: string;
  completedAt?: string;
  inputs?: Record<string, string>;
  outputs?: Record<string, string>;
  loopCounts?: Record<string, number>; // Keep track of feedback runs
}

export interface ExternalSimMessage {
  id: string;
  sender: 'human' | 'agent';
  senderName: string;
  content: string;
  timestamp: string;
  channel: 'telegram' | 'whatsapp' | 'slack';
}

export interface SystemSettings {
  telegramBotToken?: string;
  slackBotToken?: string;
  systemPromptGuardrails?: boolean;
  modelRateLimits?: number; // max RPM
}
