/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { 
  Agent, 
  Workflow, 
  Run, 
  RunLog, 
  InterAgentMessage, 
  ExternalSimMessage, 
  SystemSettings 
} from './src/types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const DB_PATH = path.join(process.cwd(), 'db.json');

// Memory cache for telegram message loops
let activeTelegramPolling: any = null;

// Lazy initialize Gemini client to protect startup
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY || '';
    genAIClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Ensure database file exists with starting seeding templates
function initDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    const defaultAgents: Agent[] = [
      {
        id: 'agent-support-specialist',
        name: 'Support Pro',
        role: 'Customer Support Specialist',
        systemPrompt: 'You are an ultra-empathetic Client Relations Representative. Draft a detailed, structured, friendly response to the customer\'s issue. Provide step-by-step guidance without false promises. Stick strictly to customer confidence.',
        model: 'gemini-3.5-flash',
        tools: ['google_search'],
        channels: ['telegram_external', 'web_chat'],
        schedules: 'manual',
        memoryType: 'buffer_window',
        skills: ['Empathy', 'Problem Solving', 'Structured Messaging'],
        interactionRules: 'Keep answer short and visually structured. Use bullet points.',
        guardrails: 'standard_moderation',
        createdAt: new Date().toISOString()
      },
      {
        id: 'agent-senior-qa',
        name: 'Compliance Auditor',
        role: 'Quality & Regulatory Reviewer',
        systemPrompt: 'You are an expert Compliance Auditor checking client drafts. Evaluate the draft meticulously. Your feedback must always specify if the tone is compliant and polite. If it fails, produce corrective instructions. RESPOND STRICTLY IN JSON format containing fields: "compliant" (boolean) and "feedback_guidelines" (string with specific items to correct). do NOT include markdown syntax around the JSON.',
        model: 'gemini-3.5-flash',
        tools: [],
        channels: [],
        schedules: 'manual',
        memoryType: 'short_term',
        skills: ['Quality Assurance', 'Brand Guidelines', 'Semantic Validation'],
        interactionRules: 'Strictly output JSON with keys "compliant" and "feedback_guidelines"',
        guardrails: 'strict_finance',
        createdAt: new Date().toISOString()
      },
      {
        id: 'agent-seo-writer',
        name: 'Creative Content Writer',
        role: 'SEO & Copywriter Expert',
        systemPrompt: 'You are an expert SEO Content Generator. Write a brief creative summary or blog introduction regarding the requested topic, targeting a modern tech-savvy reader. Format with rich Markdown.',
        model: 'gemini-3.5-flash',
        tools: ['google_search'],
        channels: ['web_chat'],
        schedules: 'manual',
        memoryType: 'buffer_window',
        skills: ['Copywriting', 'SEO Target Keywords', 'Formatting'],
        interactionRules: 'Inject highly relevant headings.',
        guardrails: 'standard_moderation',
        createdAt: new Date().toISOString()
      },
      {
        id: 'agent-seo-editor',
        name: 'SEO Copyeditor',
        role: 'Editor & Metadata Auditor',
        systemPrompt: 'You are an SEO Auditor examining copy drafts. Examine the density of tech keywords, formatting, and overall depth. Rate if it needs structural improvements. RESPOND IN STRICT JSON containing fields: "compliant" (boolean) and "feedback_guidelines" (string suggestions on what headers/keywords to add or improve). do NOT wrap response in markdown code blocks.',
        model: 'gemini-3.5-flash',
        tools: ['google_search'],
        channels: [],
        schedules: 'manual',
        memoryType: 'short_term',
        skills: ['Metadata check', 'Density calculation'],
        interactionRules: 'Strict JSON feedback format',
        guardrails: 'standard_moderation',
        createdAt: new Date().toISOString()
      }
    ];

    const defaultWorkflows: Workflow[] = [
      {
        id: 'wf-support-qa-loop',
        name: 'Enterprise Support Response Workflow',
        description: 'Collects user issues, drafts a meticulous reply via a Support specialist, passes it to a Senior Compliance Auditor. If QA fails compliance, it triggers feedback loops back to Support for a rewrite.',
        nodes: [
          {
            id: 'node-start',
            type: 'input',
            label: 'Customer Ticket Input',
            position: { x: 50, y: 150 }
          },
          {
            id: 'node-support-agent',
            type: 'agent',
            label: 'Support Specialist Drafts Reply',
            agentId: 'agent-support-specialist',
            position: { x: 250, y: 150 }
          },
          {
            id: 'node-qa-agent',
            type: 'agent',
            label: 'Auditor Verifies Compliance',
            agentId: 'agent-senior-qa',
            position: { x: 480, y: 150 }
          },
          {
            id: 'node-condition',
            type: 'condition',
            label: 'Tone & Quality Compliant?',
            config: {
              conditionExpression: 'compliant === true',
              yesNodeId: 'node-output-ok',
              noNodeId: 'node-support-agent', // Feedback loop back!
              loopCountLimit: 3
            },
            position: { x: 720, y: 130 }
          },
          {
            id: 'node-output-ok',
            type: 'output',
            label: 'Deliver Approved Support Response',
            position: { x: 960, y: 150 }
          }
        ],
        edges: [
          { id: 'e1', source: 'node-start', target: 'node-support-agent' },
          { id: 'e2', source: 'node-support-agent', target: 'node-qa-agent' },
          { id: 'e3', source: 'node-qa-agent', target: 'node-condition' },
          { id: 'e4', source: 'node-condition', target: 'node-output-ok', conditionLabel: 'Approved' },
          { id: 'e5', source: 'node-condition', target: 'node-support-agent', conditionLabel: 'QA Failed (Edit Redraft)', isFeedbackLoop: true }
        ],
        createdAt: new Date().toISOString()
      },
      {
        id: 'wf-seo-generation-loop',
        name: 'SEO Copywriting Feedback Pipeline',
        description: 'Generates promotional copy on any subject, audits and updates formatting / density, auto-corrects using feedback loops if editing grade is insufficient.',
        nodes: [
          {
            id: 'node-seo-start',
            type: 'input',
            label: 'Draft Topic Theme',
            position: { x: 50, y: 250 }
          },
          {
            id: 'node-seo-writer',
            type: 'agent',
            label: 'SEO Writer Outlines Article',
            agentId: 'agent-seo-writer',
            position: { x: 240, y: 250 }
          },
          {
            id: 'node-seo-editor',
            type: 'agent',
            label: 'Copyeditor Reviews Density',
            agentId: 'agent-seo-editor',
            position: { x: 460, y: 250 }
          },
          {
            id: 'node-seo-condition',
            type: 'condition',
            label: 'Density Sufficient?',
            config: {
              conditionExpression: 'compliant === true',
              yesNodeId: 'node-seo-output',
              noNodeId: 'node-seo-writer', // Loops back
              loopCountLimit: 2
            },
            position: { x: 680, y: 230 }
          },
          {
            id: 'node-seo-output',
            type: 'output',
            label: 'Publish Final SEO Copy',
            position: { x: 910, y: 250 }
          }
        ],
        edges: [
          { id: 'se-1', source: 'node-seo-start', target: 'node-seo-writer' },
          { id: 'se-2', source: 'node-seo-writer', target: 'node-seo-editor' },
          { id: 'se-3', source: 'node-seo-editor', target: 'node-seo-condition' },
          { id: 'se-4', source: 'node-seo-condition', target: 'node-seo-output', conditionLabel: 'Published' },
          { id: 'se-5', source: 'node-seo-condition', target: 'node-seo-writer', conditionLabel: 'Needs Enhancements', isFeedbackLoop: true }
        ],
        createdAt: new Date().toISOString()
      }
    ];

    const initialSettings: SystemSettings = {
      telegramBotToken: '',
      slackBotToken: '',
      systemPromptGuardrails: true,
      modelRateLimits: 20
    };

    const initialData = {
      agents: defaultAgents,
      workflows: defaultWorkflows,
      runs: [] as Run[],
      simulatorMessages: [] as ExternalSimMessage[],
      settings: initialSettings
    };

    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

initDatabase();

// DB Access Methods
function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to read db', error);
    return { agents: [], workflows: [], runs: [], simulatorMessages: [], settings: {} };
  }
}

function writeDB(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write db', error);
  }
}

// Real agent tool execution definitions
async function executeTool(toolName: string, query: string, logs: RunLog[], runId: string, agentName: string): Promise<string> {
  const logId = Math.random().toString(36).substring(7);
  logs.push({
    id: logId,
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `[Tool] Executing tool '${toolName}' with parameters: "${query.substring(0, 80)}..."`
  });

  if (toolName === 'google_search') {
    try {
      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Provide modern facts and answer queries utilizing Google Search: ${query}`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      const txt = response.text || "No response search data found.";
      const citations = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web?.uri).filter(Boolean) || [];
      
      logs.push({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `[Tool] Search successful. Found references: ${citations.length > 0 ? citations.slice(0, 3).join(', ') : 'None'}`
      });
      return `${txt}\n\n[Google Search References:\n${citations.join('\n')}]`;
    } catch (err: any) {
      logs.push({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `[Tool] Search error: ${err.message}`
      });
      return `Failed to perform search. Error: ${err.message}`;
    }
  } else if (toolName === 'math_engine') {
    try {
      // Evaluate safe mathematical strings
      // Extract math expression e.g. "calculate 23 * 45"
      const mathExp = query.replace(/[a-zA-Z]/g, '').trim();
      // Replace safe characters
      const sanitized = mathExp.replace(/[^0-9+\-*/().\s]/g, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      logs.push({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `[Tool] Math engine result: ${result}`
      });
      return `Mathematical evaluation result of expression (${sanitized}) = ${result}`;
    } catch (err) {
      return `Math engine failed to parse expression. Make sure it contains correct mathematical digits.`;
    }
  } else if (toolName === 'file_writer') {
    try {
      const tempPath = path.join(process.cwd(), `runtime_shared_file.txt`);
      fs.writeFileSync(tempPath, query, 'utf-8');
      logs.push({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `[Tool] Wrote data into workspace virtual file 'runtime_shared_file.txt'`
      });
      return `Successfully saved content to workspace cluster file runtime_shared_file.txt`;
    } catch (err: any) {
      return `File writing failed: ${err.message}`;
    }
  } else if (toolName === 'file_reader') {
    try {
      const tempPath = path.join(process.cwd(), `runtime_shared_file.txt`);
      if (fs.existsSync(tempPath)) {
        const data = fs.readFileSync(tempPath, 'utf-8');
        logs.push({
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString(),
          level: 'success',
          message: `[Tool] Successfully read 'runtime_shared_file.txt'`
        });
        return `Workspace Shared File Contents:\n--- \n${data}\n---`;
      } else {
        return `File 'runtime_shared_file.txt' does not exist yet. Please write to it first.`;
      }
    } catch (err: any) {
      return `File reading failed: ${err.message}`;
    }
  }
  return `Tool ${toolName} execution not supported or failed.`;
}

// Core Async Runtime Workflow Runner
async function runEngine(runId: string) {
  const db = readDB();
  const run = db.runs.find((r: any) => r.id === runId);
  if (!run) return;

  const workflow = db.workflows.find((w: any) => w.id === run.workflowId);
  if (!workflow) {
    run.status = 'failed';
    run.logs.push({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'Workflow not found in the orchestrator registry.'
    });
    writeDB(db);
    return;
  }

  run.status = 'running';
  run.logs.push({
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Initialized workflow run execution engine for process: ${workflow.name}`
  });
  writeDB(db);

  try {
    // Find Starter node
    let currentNode = workflow.nodes.find((n: any) => n.type === 'input');
    if (!currentNode) {
      throw new Error("No Input trigger node declared in this workflow diagram.");
    }

    let inputValues = run.inputs || {};
    let lastGeneratedData = inputValues.topic || inputValues.text || "Default general inquiry topic";
    let lastAgentFeedback = "";

    // Track loop limits defensively to avoid infinite API drain
    const loopStates: Record<string, number> = {};

    while (currentNode) {
      const activeDb = readDB();
      const updatedRun = activeDb.runs.find((r: any) => r.id === runId);
      if (!updatedRun) break;

      updatedRun.currentNodeId = currentNode.id;
      writeDB(activeDb);

      // 1. Process Input type node
      if (currentNode.type === 'input') {
        const logId = Math.random().toString(36).substring(7);
        updatedRun.logs.push({
          id: logId,
          timestamp: new Date().toISOString(),
          level: 'info',
          nodeId: currentNode.id,
          message: `[Trigger] Registered Workflow task input string: "${lastGeneratedData}"`
        });
        const edge = workflow.edges.find((e: any) => e.source === currentNode?.id);
        currentNode = edge ? workflow.nodes.find((n: any) => n.id === edge.target) : null;
      }
      
      // 2. Process Agent execution
      else if (currentNode.type === 'agent') {
        const agentId = currentNode.agentId;
        const currentAgent = db.agents.find((a: any) => a.id === agentId);
        
        if (!currentAgent) {
          throw new Error(`Target Agent profile '${agentId}' is missing or deleted.`);
        }

        updatedRun.logs.push({
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString(),
          level: 'info',
          nodeId: currentNode.id,
          agentId: currentAgent.id,
          agentName: currentAgent.name,
          message: `[Agent Node Activation] Calling '${currentAgent.name}' to execute role '${currentAgent.role}'`
        });
        writeDB(activeDb);

        // Run real tools if declared in the agent profile
        let toolAugmentedSummary = "";
        if (currentAgent.tools && currentAgent.tools.length > 0) {
          // Execute first tool as reference
          const chosenTool = currentAgent.tools[0];
          toolAugmentedSummary = await executeTool(chosenTool, lastGeneratedData, updatedRun.logs, runId, currentAgent.name);
        }

        // Construct context prompt for AI
        let systemPrompt = currentAgent.systemPrompt;
        if (currentAgent.guardrails === 'strict_finance') {
          systemPrompt += "\nCRITICAL GUARDRAIL: Do not offer financial, investment, legal or medical suggestions. Stick purely to quality evaluation.";
        }
        if (currentAgent.interactionRules) {
          systemPrompt += `\nInteraction Guideline: ${currentAgent.interactionRules}`;
        }

        let userMessage = `Current task topic/data state: "${lastGeneratedData}"`;
        if (lastAgentFeedback) {
          userMessage += `\nPrevious Audit/Feedback comments to correct or rewrite: "${lastAgentFeedback}"`;
        }
        if (toolAugmentedSummary) {
          userMessage += `\nActive Tool Execution Context data retrieved:\n${toolAugmentedSummary}`;
        }

        // Call Gemini server-side using the genuine @google/genai SDK
        try {
          const ai = getGenAI();
          // Log prompt execution
          updatedRun.logs.push({
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            level: 'info',
            nodeId: currentNode.id,
            agentId: currentAgent.id,
            agentName: currentAgent.name,
            message: `[Gemini API] Requesting generation from key-space model: '${currentAgent.model}'`
          });
          writeDB(activeDb);

          const response = await ai.models.generateContent({
            model: currentAgent.model || 'gemini-3.5-flash',
            contents: userMessage,
            config: {
              systemInstruction: systemPrompt
            }
          });

          const responseText = response.text || "No response received.";
          const tokensUsed = response.usageMetadata?.totalTokenCount || 400;
          const costAmt = tokensUsed * 0.0000015; // Average approximation on token sizes

          updatedRun.tokenCount += tokensUsed;
          updatedRun.estimatedCost += costAmt;

          // Record Inter-agent message
          updatedRun.messages.push({
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            senderId: currentAgent.id,
            senderName: currentAgent.name,
            receiverId: workflow.id,
            receiverName: workflow.name,
            content: responseText
          });

          updatedRun.logs.push({
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            level: 'success',
            nodeId: currentNode.id,
            agentId: currentAgent.id,
            agentName: currentAgent.name,
            message: `[Agent Node Response Received] Completed content production. (Used ${tokensUsed} tokens, estimated cost: $${costAmt.toFixed(6)})`
          });

          // Save node outcome. Let the condition block parse if needed.
          lastGeneratedData = responseText;
          writeDB(activeDb);

          // Find out next edge
          const nextEdge = workflow.edges.find((e: any) => e.source === currentNode?.id);
          currentNode = nextEdge ? workflow.nodes.find((n: any) => n.id === nextEdge.target) : null;

        } catch (apiErr: any) {
          updatedRun.logs.push({
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            level: 'error',
            nodeId: currentNode.id,
            message: `Gemini API execution failed: ${apiErr.message}`
          });
          throw apiErr;
        }
      }

      // 3. Process Condition block / Feedback Loop
      else if (currentNode.type === 'condition') {
        updatedRun.logs.push({
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString(),
          level: 'info',
          nodeId: currentNode.id,
          message: `[Auditing Condition Gate] Reading compliance flags...`
        });
        writeDB(activeDb);

        // Attempt to parse lastGeneratedData as JSON to see if compliant
        let compliant = true;
        let feedback = "";
        try {
          // Clean JSON if wrapper issues
          let sanitizedJsonString = lastGeneratedData.trim();
          if (sanitizedJsonString.startsWith('```json')) {
            sanitizedJsonString = sanitizedJsonString.replace(/```json|```/g, '').trim();
          } else if (sanitizedJsonString.startsWith('```')) {
            sanitizedJsonString = sanitizedJsonString.replace(/```/g, '').trim();
          }
          const parsed = JSON.parse(sanitizedJsonString);
          compliant = (parsed.compliant === true || parsed.compliant === 'true');
          feedback = parsed.feedback_guidelines || "";
        } catch (err) {
          // If fallback parsing fails, we look for matches
          compliant = lastGeneratedData.toLowerCase().includes('"compliant": true') || 
                      lastGeneratedData.toLowerCase().includes('"compliant":true') || 
                      !lastGeneratedData.toLowerCase().includes('fail') ||
                      lastGeneratedData.toLowerCase().includes('approved');
          feedback = "Review tone density parameters and adjust wording for compliance.";
        }

        updatedRun.logs.push({
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString(),
          level: compliant ? 'success' : 'warn',
          nodeId: currentNode.id,
          message: `[Evaluation Result] Gate assessed: Compliant = ${compliant}. Feedback text length: ${feedback.length} chars`
        });
        writeDB(activeDb);

        const nodeConfig = currentNode.config || {};
        const yesNodeId = nodeConfig.yesNodeId;
        const noNodeId = nodeConfig.noNodeId;
        const limitCount = nodeConfig.loopCountLimit || 3;

        // Count loops
        const loopKey = `${currentNode.id}_to_${noNodeId}`;
        loopStates[loopKey] = (loopStates[loopKey] || 0) + 1;

        if (compliant) {
          // Path: Yes
          updatedRun.logs.push({
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            level: 'info',
            nodeId: currentNode.id,
            message: `[Routing] Quality pass certified. Forking path forward.`
          });
          currentNode = workflow.nodes.find((n: any) => n.id === yesNodeId) || null;
        } else {
          // Path: No
          if (loopStates[loopKey] <= limitCount) {
            updatedRun.logs.push({
              id: Math.random().toString(36).substring(7),
              timestamp: new Date().toISOString(),
              level: 'warn',
              nodeId: currentNode.id,
              message: `[COLLABORATIVE FEEDBACK LOOP APPROVED] Loop attempt ${loopStates[loopKey]}/${limitCount}. Passing feedback payload directly back to generator Agent: "${feedback.substring(0, 80)}..."`
            });
            lastAgentFeedback = feedback;
            currentNode = workflow.nodes.find((n: any) => n.id === noNodeId) || null;
          } else {
            updatedRun.logs.push({
              id: Math.random().toString(36).substring(7),
              timestamp: new Date().toISOString(),
              level: 'warn',
              nodeId: currentNode.id,
              message: `[Loop Limit Hit] Loop threshold ${limitCount} reached to prevent credit consumption. Forcing bypass forward.`
            });
            currentNode = workflow.nodes.find((n: any) => n.id === yesNodeId) || null;
          }
        }
        writeDB(activeDb);
      }

      // 4. Process Output Node
      else if (currentNode.type === 'output') {
        const logId = Math.random().toString(36).substring(7);
        updatedRun.logs.push({
          id: logId,
          timestamp: new Date().toISOString(),
          level: 'success',
          nodeId: currentNode.id,
          message: `[Workflow Finalized] Outcome publication saved. Draft response payload available.`
        });
        updatedRun.outputs = {
          finalResult: lastGeneratedData
        };
        currentNode = null; // Ends process loop
      }

      // Small pause to simulate real runtime processing delay safely
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    // Mark completed
    const finalDb = readDB();
    const finalRun = finalDb.runs.find((r: any) => r.id === runId);
    if (finalRun) {
      finalRun.status = 'completed';
      finalRun.completedAt = new Date().toISOString();
      finalRun.logs.push({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        level: 'success',
        message: 'Successfully finalized end-to-end task execution pipeline.'
      });
      writeDB(finalDb);
    }

  } catch (err: any) {
    const errorDb = readDB();
    const failedRun = errorDb.runs.find((r: any) => r.id === runId);
    if (failedRun) {
      failedRun.status = 'failed';
      failedRun.completedAt = new Date().toISOString();
      failedRun.logs.push({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Execution pipeline halted with exception: ${err.message}`
      });
      writeDB(errorDb);
    }
  }
}

// Telegram/WhatsApp Channel Simulation and Webhook logic
async function processExternalMessage(channel: 'telegram'|'whatsapp'|'slack', content: string) {
  const db = readDB();
  
  // Find an agent with that channel configured
  const agent = db.agents.find((a: any) => a.channels.includes(`${channel}_external`)) || db.agents[0];
  
  const incomingId = Math.random().toString(36).substring(7);
  db.simulatorMessages.push({
    id: incomingId,
    sender: 'human',
    senderName: 'Jay (User)',
    content: content,
    timestamp: new Date().toISOString(),
    channel: channel
  });
  writeDB(db);

  // Invoke server side Gemini in conversational mode
  try {
    const ai = getGenAI();
    let instruction = `You are the specific Agent: [${agent.name}]. Role: [${agent.role}]. 
Your instructions are: "${agent.systemPrompt}"
You are connected to an external user through ${channel.toUpperCase()} messaging. Speak with character. Keep it medium density. Do NOT write metadata.`;

    const response = await ai.models.generateContent({
      model: agent.model || 'gemini-3.5-flash',
      contents: content,
      config: {
        systemInstruction: instruction
      }
    });

    const responseText = response.text || "Hello! Agent processing loop didn't reply. Try again.";
    
    const responseDb = readDB();
    responseDb.simulatorMessages.push({
      id: Math.random().toString(36).substring(7),
      sender: 'agent',
      senderName: agent.name,
      content: responseText,
      timestamp: new Date().toISOString(),
      channel: channel
    });
    writeDB(responseDb);

    return responseText;
  } catch (err: any) {
    const errDb = readDB();
    errDb.simulatorMessages.push({
      id: Math.random().toString(36).substring(7),
      sender: 'agent',
      senderName: agent.name,
      content: `[API Connection Error]: ${err.message}`,
      timestamp: new Date().toISOString(),
      channel: channel
    });
    writeDB(errDb);
    return `An error occurred: ${err.message}`;
  }
}

// Setup real live Telegram Bot polling if TOKEN is provided in Settings
function startTelegramPolling(token: string) {
  if (activeTelegramPolling) {
    clearInterval(activeTelegramPolling);
    activeTelegramPolling = null;
  }

  if (!token) return;

  console.log(`[Telegram Integration] Starting secure polling service (Offset mode) for Telegram Bot Token: ...${token.substring(token.length - 6)}`);

  let lastUpdateId = 0;

  activeTelegramPolling = setInterval(async () => {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`);
      if (!response.ok) return;

      const data: any = await response.json();
      if (data.ok && data.result?.length > 0) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          const message = update.message;
          if (!message || !message.text) continue;

          console.log(`[Telegram Bot] Incoming message from user: "${message.text}"`);
          
          // Trigger the genuine agent processor logic
          const replyText = await processExternalMessage('telegram', message.text);

          // Reply back to live Telegram user via Bot API
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: message.chat.id,
              text: replyText
            })
          });
        }
      }
    } catch (err) {
      // Slitently handle disconnects
    }
  }, 4000);
}


// --- EXPOSED API ENDPOINTS ---

// AGENTS API
app.get('/api/agents', (req, res) => {
  const db = readDB();
  res.json(db.agents);
});

app.post('/api/agents', (req, res) => {
  const db = readDB();
  const newAgent: Agent = {
    ...req.body,
    id: `agent-${Math.random().toString(36).substring(7)}`,
    createdAt: new Date().toISOString()
  };
  db.agents.push(newAgent);
  writeDB(db);
  res.status(201).json(newAgent);
});

app.put('/api/agents/:id', (req, res) => {
  const db = readDB();
  const index = db.agents.findIndex((a: any) => a.id === req.params.id);
  if (index !== -1) {
    db.agents[index] = { ...db.agents[index], ...req.body };
    writeDB(db);
    res.json(db.agents[index]);
  } else {
    res.status(404).json({ error: 'Agent not found' });
  }
});

app.delete('/api/agents/:id', (req, res) => {
  const db = readDB();
  db.agents = db.agents.filter((a: any) => a.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// WORKFLOWS API
app.get('/api/workflows', (req, res) => {
  const db = readDB();
  res.json(db.workflows);
});

app.post('/api/workflows', (req, res) => {
  const db = readDB();
  const existingIndex = db.workflows.findIndex((w: any) => w.id === req.body.id);
  const workflowToSave: Workflow = {
    ...req.body,
    id: req.body.id || `wf-${Math.random().toString(36).substring(7)}`,
    createdAt: req.body.createdAt || new Date().toISOString()
  };

  if (existingIndex !== -1) {
    db.workflows[existingIndex] = workflowToSave;
  } else {
    db.workflows.push(workflowToSave);
  }
  writeDB(db);
  res.status(200).json(workflowToSave);
});

app.delete('/api/workflows/:id', (req, res) => {
  const db = readDB();
  db.workflows = db.workflows.filter((w: any) => w.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// RUNS API
app.get('/api/runs', (req, res) => {
  const db = readDB();
  res.json(db.runs);
});

app.post('/api/runs', (req, res) => {
  const db = readDB();
  const { workflowId, inputs } = req.body;
  const workflow = db.workflows.find((w: any) => w.id === workflowId);
  
  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found.' });
  }

  const newRun: Run = {
    id: `run-${Math.random().toString(36).substring(7)}`,
    workflowId,
    workflowName: workflow.name,
    status: 'idle',
    logs: [],
    messages: [],
    tokenCount: 0,
    estimatedCost: 0,
    inputs: inputs || {},
    createdAt: new Date().toISOString()
  };

  db.runs.push(newRun);
  writeDB(db);

  // Trigger engine asynchronously but return response immediately
  runEngine(newRun.id);

  res.status(201).json(newRun);
});

app.get('/api/runs/:id', (req, res) => {
  const db = readDB();
  const run = db.runs.find((r: any) => r.id === req.params.id);
  if (run) {
    res.json(run);
  } else {
    res.status(404).json({ error: 'Run not found' });
  }
});

// CUSTOM SETTINGS
app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json(db.settings || {});
});

app.post('/api/settings', (req, res) => {
  const db = readDB();
  db.settings = { ...db.settings, ...req.body };
  writeDB(db);

  // Auto trigger live Telegram Bot polling if key changes
  if (db.settings.telegramBotToken) {
    startTelegramPolling(db.settings.telegramBotToken);
  } else {
    if (activeTelegramPolling) {
      clearInterval(activeTelegramPolling);
      activeTelegramPolling = null;
    }
  }

  res.json(db.settings);
});

// EXTERNAL CHANNEL PLAYGROUND / SIMULATOR
app.get('/api/telegram/messages', (req, res) => {
  const db = readDB();
  const { channel } = req.query;
  const filtered = db.simulatorMessages.filter((m: any) => m.channel === (channel || 'telegram'));
  res.json(filtered);
});

app.get('/api/telegram/clear', (req, res) => {
  const db = readDB();
  db.simulatorMessages = [];
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/telegram/simulate', async (req, res) => {
  const { channel, content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Message content is missing.' });
  }

  const reply = await processExternalMessage(channel || 'telegram', content);
  res.json({ reply });
});


// INIT ANY PERSISTENT SERVICE LOOPS ON BOOT (e.g. if bot token is pre-saved)
const startupDb = readDB();
if (startupDb.settings?.telegramBotToken) {
  startTelegramPolling(startupDb.settings.telegramBotToken);
}


// --- INTEGRATE SPA VITE DEV ENVIRONMENT OR BUILD FOLDER SERVING ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server Ready] Platform running at http://localhost:${PORT}`);
  });
}

startServer();
