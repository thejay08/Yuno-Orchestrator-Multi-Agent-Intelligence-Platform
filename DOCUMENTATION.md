# Yuno Orchestrator: Platform Documentation & Developer Guide

Welcome to the official developer and architecture guide for **Yuno Orchestrator** (Multi-Agent Intelligence Platform). This document provides an exhaustive developer manual covering the system design, directory structures, backend runtime engines, database schema, state orchestration logic using LangGraph, real-time telemetry tracing, and configuration routines.

---

## 🗺️ Architectural Overview

Yuno Orchestrator is a full-stack, local-first application designed for composing, executing, monitoring, and scaling autonomous multi-agent AI workflows. Rather than abstracting agent behaviors into opaque black-boxes, Yuno utilizes **state-machine graphs (via LangGraph)** to structure deterministic execution, conditional loops, tool invocations, and live system-wide telemetry.

```
                   +-----------------------------------------------+
                   |              Yuno React Frontend              |
                   |      Interactive UI, Canvas & Telemetry       |
                   +-----------------------+-----------------------+
                                           |
                    REST (CRUD) API Actions| Live WS Event Logs Tracer
                                           v
+------------------+       +-----------------------------------------------+
|  Telegram Bot    | <---> |             FastAPI Web Server                |
|  Channel client  |       |       SQLite / SQLAlchemy Core Db Store       |
|  (v20 Asyncio)   |       +-----------------------+-----------------------+
+------------------+                               |
                                                   v
                                   +-------------------------------+
                                   |    LangGraph Orchestrator    |
                                   |  (StateGraph + Node Runners)  |
                                   +---------------+---------------+
                                                   |
                                                   v
                                   +-------------------------------+
                                   |  Google Gemini API Gateway    |
                                   |  (Using gemini-2.5-flash)     |
                                   +-------------------------------+
```

### Key Technology Stack Decisions:
1. **LangGraph (StateGraph)**: Selected over traditional autonomous frameworks (such as CrewAI or AutoGen) due to its emphasis on explicit **cyclic network state machines**. This allows developers to build clear, testable loops and multi-agent consensus chains with predictable error boundaries, human-in-the-loop gates, and token trace telemetry.
2. **FastAPI (ASGI)**: Provides high-throughput, asynchronous endpoints coupled with native WebSockets support for real-time trace log streaming.
3. **SQLite & SQLAlchemy ORM**: Eliminates heavy cloud infrastructure requirements. The databases compile locally instantly, facilitating quick code delivery, portable environments, and immediate inspection.
4. **Vite + React (TypeScript)**: Delivers a responsive browser interface featuring interactive canvas flows, real-time message streams, live chart telemetries, and editable agent profiles.

---

## 📂 Codebase Directory Walkthrough

```text
├── backend/                   # FastAPI Server Core
│   ├── integrations/          # External channels and message webhooks
│   │   ├── __init__.py
│   │   └── telegram_bot.py    # Python-Telegram-Bot v20 async runner
│   ├── routers/               # APIRouters mapping database & execution logic
│   │   ├── __init__.py
│   │   ├── agents.py          # Agent settings & credentials CRUD
│   │   ├── executions.py      # Triggering workflows, run histories & WebSockets
│   │   ├── messages.py        # Database historic chat messages
│   │   └── workflows.py       # Workflow structures & interactive Canvas schemas
│   ├── runtime/               # LangGraph compiler & agent runtimes
│   │   ├── __init__.py
│   │   ├── langgraph_runner.py# Main StateGraph composition, compiling & run wrapper
│   │   ├── memory.py          # Chat memory architectures (Buffer window, Short/Long term)
│   │   └── tools.py           # Native tool execution interfaces (Search, Synthesizer)
│   ├── database.py            # SQLite engine, models (DB_Agent, DB_Workflow, etc.)
│   ├── main.py                # Server initialization & FastAPI entry point
│   ├── models.py              # Pydantic schemas for request/response serialization
│   └── settings.json          # System settings file (Telegram credentials, tokens)
│
├── src/                       # React Frontend (Vite)
│   ├── components/            # Visual Dashboard views and modules
│   │   ├── AgentCard.tsx      # Agent rendering component
│   │   ├── AgentCrud.tsx      # Active agent parameters setting list
│   │   ├── Canvas.tsx         # Interactive visual workflow graph grid
│   │   ├── ChannelSandbox.tsx # Unified Chat channel & Telegram testing panel
│   │   ├── ExecutionMonitor.tsx# Live WebSocket debugger tracer console
│   │   ├── SettingsPanel.tsx  # Token credentials configuration
│   │   └── StatusIndicator.tsx# System state and telemetry stats
│   ├── App.tsx                # Principal visual entry point (Desktop-first layout)
│   ├── data.ts                # Preset dashboard structures and icons
│   ├── index.css              # Global styles (including Tailwind theme configuration)
│   └── main.tsx               # Client bootstrap entry file
│
├── metadata.json              # Platform manifest descriptors 
├── setup.sh                   # Automated dependency construction script
└── start.sh                   # Double-process launcher script (Frontend + Backend)
```

---

## 🗄️ Database Schema & Persistence

All records are persistently maintained within a local SQLite database file, controlled through SQLAlchemy models in `/backend/database.py`.

### 1. `DB_Agent` (AI Cognitive Profiles)
* **`id`** (`String`, PK): Unique agent identifier.
* **`name`** (`String`): Representative display name.
* **`role`** (`String`): Primary domain (e.g., *Security Compliance*, *Finance Reviewer*).
* **`system_prompt`** (`Text`): Cognitive directive framing the LLM's system persona.
* **`model`** (`String`): Target LLM model selection (defaults to `gemini-3.5-flash`).
* **`temperature`** (`Float`): Creativity/determinism variance parameter from `0.0` to `1.2`.
* **`max_tokens`** (`Integer`): Absolute completion roof limit container.
* **`memory_type`** (`String`): Chat history retrieval layout (`short_term`, `buffer_window`, `long_term`).
* **`guardrails`** (`String`): Verification policies attached (`standard_moderation`, `strict_finance`, `none`).
* **`telegram_enabled`** (`Boolean`): Directs incoming Telegram bot messages to this agent when flagged `True`.
* **`tools`** (`JSON`): Enabled tools array (e.g., `["web_search", "text_summarize"]`).

### 2. `DB_Workflow` (Orchestration Canvas Structures)
* **`id`** (`String`, PK): Unique workflow template profile ID.
* **`name`** (`String`): Title of the workflow chain.
* **`description`** (`Text`): Short summary highlighting the execution goals of the chain.
* **`graph_definition`** (`JSON`): Nodes and connecting edges serialized to JSON representing the drag-and-drop canvas layout:
  ```json
  {
    "nodes": [
      { "id": "node-1", "type": "agent", "agentId": "agent-lead", "x": 100, "y": 150 },
      { "id": "node-2", "type": "agent", "agentId": "agent-reviewer", "x": 350, "y": 150 }
    ],
    "edges": [
      { "id": "edge-1", "source": "node-1", "target": "node-2" }
    ]
  }
  ```

### 3. `DB_WorkflowExecution` (Historic Runs Tracing)
* **`id`** (`String`, PK): Unique execution tracking ID.
* **`workflow_id`** (`String`): ID of the underlying workflow template.
* **`status`** (`String`): Operational progress state (`idle`, `running`, `completed`, `failed`).
* **`started_at`** / **`completed_at`** (`DateTime`): Timestamp descriptors.
* **`result`** (`JSON`): Complex payload store tracking telemetry metadata:
  ```json
  {
    "logs": [
      {
        "id": "log-abcde",
        "timestamp": "2026-06-03T06:28:37Z",
        "message": "Initiated LangGraph workflow...",
        "level": "input",
        "tokens_used": 15
      }
    ],
    "token_count": 550,
    "estimated_cost": 0.0011,
    "final_state": { "messages": [...] }
  }
  ```

### 4. `DB_Message` (Conversational Message Vaults)
* **`id`** (`String`, PK): Unique message entry ID.
* **`execution_id`** (`String`, FK, Nullable): Run reference tracing source.
* **`agent_id`** (`String`, FK, Nullable): Author agent referencing profile code.
* **`role`** (`String`): Author classification (`user`, `assistant`).
* **`content`** (`Text`): Explicit text message body payload.
* **`timestamp`** (`DateTime`): Creation timestamp.
* **`token_count`** (`Integer`): Recorded semantic weight estimation.

---

## ⚡ LangGraph Run Execution Flow

When a user triggers a workflow by pointing to a specific template and giving a task input via the "/api/workflows/execute" trigger:

1. **Graph Construction**:
   Inside `/backend/runtime/langgraph_runner.py`, the system maps the saved `graph_definition` nodes and edges. For each node of type `"agent"`, a corresponding node step function is dynamically registered with the underlying `StateGraph`:
   ```python
   def make_agent_node(agent_record):
       async def agent_node(state):
           # Fetches latest conversation logs
           # Compiles prompts and invokes the configured Gemini LLM Model
           # Intercepts tool calls and dispatches them
           # Appends completion text to State messages
           return {"messages": updated_messages}
       return agent_node
   ```
2. **Dynamic Flow Compilation**:
   The compiler connects nodes according to the visual edges mapped on the canvas. If the canvas defines linear pathways or cyclic feedback wires, LangGraph executes each block sequentially, passing state messages cleanly downstream.
3. **Trace Stream Broadcast**:
   Each agent step and tool invocation outputs rich logging arrays containing visual highlight tags:
   * `input` (blue) -> Starting pipeline workflows, user topic prompts.
   * `agent_response` (green) -> Agent nodes completing natural language analysis.
   * `tool_call` (orange) -> Invoking tools (e.g. Google search or text summaries).
   * `error` (red) -> Execution exceptions or empty credentials catches.

---

## ⚙️ Real Telegram Channel Webhooks Sandbox

Yuno incorporates a live, fully asynchronous service in `/backend/integrations/telegram_bot.py` powered by `python-telegram-bot` (v20+):

* **How it Operates**: The service boots on startup inside the server's event loop.
* **Active Poll Gateway**:
  * On a message update, the database is queried to find an agent profile with `telegram_enabled = True`.
  * If found, the service builds an execution container representing a single-agent LangGraph.
  * The incoming message is appended to the message vault of that agent and model queries are executed securely via Gemini.
  * The agent's final text response is packaged and dispatched directly back to the active Telegram user.
* **Live Sandbox Verification**: Under the "Channels Sandbox" tab, the dashboard displays active Telegram configurations, real-time message histories persisted inside the SQLite database, and a direct testing portal.

---

## 🔗 Endpoint Reference Guide

The backend server is mounted at port `3000`/`8000` executing matching REST APIs:

### 🤖 Agents Manager
* `GET /api/agents` - Pulls list of all defined agent profiles.
* `POST /api/agents` - Creates or updates a cognitive profile.
* `DELETE /api/agents/{id}` - Unregisters an agent profile.

### 📐 Workflow Studio Canvas
* `GET /api/workflows` - Fetches registered workflow canvas designs.
* `POST /api/workflows` - Persists canvas layouts including coordinate matrices.
* `DELETE /api/workflows/{id}` - Deletes a custom canvas design template.

### ⚡ Executes & System Telemetry
* `POST /api/workflows/execute` - Accepts `{ workflow_id, task }`, instantiates a background `DB_WorkflowExecution`, and fires the LangGraph runtime.
* `GET /api/executions/{id}/logs` - Returns the real-time event logs array for a running workflow execution.
* `GET /api/runs` - Returns historical execution metrics, costs, list of participants, and result content in React-compatible formats.
* `GET /api/runs/{id}` - Details specific stats or diagnostics for a single past run execution.

### 📡 WebSocket Pipes
* `ws://localhost:8000/ws/logs/{run_id}` - Provides real-time log event subscription. Used by the Execution Monitor canvas to render logs as they happen without database polling.

---

## 🛠️ Step-by-Step Extensibility Tutorials

### 1. How to Add a New Built-In Agent Tool
1. Register the tool name definition inside `/backend/runtime/tools.py`.
2. Map a dedicated python implementation. For instance, creating an address validation utility:
   ```python
   async def validate_address_tool(address: str) -> str:
       # Implement parsing, validation, or geo lookup here.
       return f"Validated address: {address} (Region: Global-Standard)"
   ```
3. Expose the execution helper in the routing block in `/backend/runtime/langgraph_runner.py` inside the tool parsing loop:
   ```python
   if tool_name == "address_validator":
       tool_output = await validate_address_tool(tool_arg)
   ```
4. Add the `"address_validator"` identifier to the interactive checklist inside `/src/components/AgentCrud.tsx` so users can assign it to agents from the UI.

### 2. How to Initialize a New Hardcoded Seed Template
1. Open `/backend/database.py` and scroll down to the `seed_database_templates(db)` execution function.
2. Formulate your new workflow template:
   ```python
   custom_wf = DB_Workflow(
       id="wf-template-security-audit",
       name="SecOps Evaluation Loop",
       description="Audits critical policy logs and issues compliance approvals using validation loops.",
       graph_definition={
           "nodes": [
               { "id": "n-start", "type": "input", "label": "Security Topic Log" },
               { "id": "n-sec", "type": "agent", "agentId": "agent-security-lead", "label": "SecOps Evaluator" }
           ],
           "edges": [
               { "id": "ed-sec-0", "source": "n-start", "target": "n-sec" }
           ]
       }
   )
   ```
3. Append `custom_wf` into the execution seed list inside `seed_database_templates()`, save, and run `restart_dev_server` to seed the database immediately.

---

## 🛡️ Best Practices & Setup Verification

### Launch Instructions
Execute the local scripts to start development:
```bash
# Executing dependency installs
./setup.sh

# Igniting server & Vite UI dashboards concurrently
./start.sh
```

### LLM Configurations
This system is configured to prioritize **Google Gemini API** keys loaded securely through your system settings. It relies on the modern **`gemini-2.5-flash`** model (via standard ChatOpenAI OpenAPI-compatible routes on `https://generativelanguage.googleapis.com/v1beta/openai/`) to provide fast, cost-effective reasoning, robust structural validation, and reliable tool calling.
