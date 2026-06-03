/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'http';

/**
 * End-to-end validation tests for the Yuno Agent Orchestration Platform
 * Validating:
 * 1. Agent Insertion/Creation
 * 2. Workflow Execution Initialization
 * 3. Messaging Channel Delivery & Responses
 */

const BASE_URL = 'http://localhost:3000';

async function request(path: string, method: 'GET' | 'POST', body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const options: http.RequestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("=== STARTING YUNO SYSTEM DIAGNOSTICS ===");

  try {
    // 1. Validate Agent Creation Path
    console.log("\n[Test 1] Testing AI Agent Creation profile CRUD path...");
    const agentPayload = {
      name: 'Diagnostic Auditor',
      role: 'System Diagnostician',
      systemPrompt: 'Validate server states and respond strictly with PASS if everything looks good.',
      model: 'gemini-3.5-flash',
      tools: [],
      channels: ['web_chat'],
      schedules: 'manual',
      memoryType: 'short_term',
      skills: ['Verification', 'Unit Checkups'],
      interactionRules: 'Say only PASS or FAIL',
      guardrails: 'none'
    };

    const newAgent = await request('/api/agents', 'POST', agentPayload);
    if (newAgent && newAgent.id) {
      console.log(`✅ [Test 1 Passed] Agent registration successful. Created ID: ${newAgent.id}`);
    } else {
      throw new Error("Failed to register new agent profile database.");
    }

    // 2. Validate Workflow Trigger Execution Path
    console.log("\n[Test 2] Testing visual Workflow trigger and async loop processor...");
    const runPayload = {
      workflowId: 'wf-support-qa-loop',
      inputs: {
        topic: 'Test server endpoint accessibility'
      }
    };

    const runResult = await request('/api/runs', 'POST', runPayload);
    if (runResult && runResult.id) {
      console.log(`✅ [Test 2 Passed] Workflow run triggered autonomously. Registered run token ID: ${runResult.id}`);
    } else {
      throw new Error("Failed to instantiate workflow runtime context.");
    }

    // 3. Validate Messaging Channel Delivery
    console.log("\n[Test 3] Testing external channel simulation webhook passing...");
    const simPayload = {
      channel: 'telegram',
      content: 'Hello! Verify response from active support pipeline'
    };

    const channelSimResult = await request('/api/telegram/simulate', 'POST', simPayload);
    if (channelSimResult && channelSimResult.reply) {
      console.log(`✅ [Test 3 Passed] Simulation message delivery success. Received Agent feedback response: "${channelSimResult.reply.substring(0, 60)}..."`);
    } else {
      throw new Error("Messaging proxy connection failure. No response returned from model.");
    }

    console.log("\n===========================================");
    console.log("🌟 DIAGNOSTIC SUITE SUCCESS: All critical system paths fully verified!");
    console.log("===========================================");
    process.exit(0);

  } catch (err: any) {
    console.error(`❌ Diagnostic validation halted with failure: ${err.message}`);
    process.exit(1);
  }
}

// Small delay to make sure server is bound before calling
setTimeout(runTests, 2000);
