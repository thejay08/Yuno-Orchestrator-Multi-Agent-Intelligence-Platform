from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_db, SessionLocal, DB_Agent, DB_Workflow
from backend.routers import agents, workflows, executions, messages
from backend.integrations.telegram_bot import run_telegram_service
import asyncio
import logging
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_database_templates():
    """Inserts pre-built agent templates and multi-agent workflow routers on first run."""
    db = SessionLocal()
    try:
        # Check if database already has seeded agents
        if db.query(DB_Agent).count() > 0:
            return

        logger.info("[Database Seed] Inserting default cognitive agent profiles & templates")
        
        # 1. Default Agents
        researcher = DB_Agent(
            id="agent-researcher",
            name="Alpha Researcher",
            role="Technical Information Researcher",
            system_prompt="You are an expert technical facts researcher. Leverage web search to retrieve the most up-to-date documentation on technical subjects. Summarize parameters clearly.",
            model="gpt-4o",
            tools=["web_search"],
            memory_enabled=True,
            max_tokens=2000,
            guardrails={"max_iterations": 10, "forbidden_topics": []},
            telegram_enabled=False
        )

        summarizer = DB_Agent(
            id="agent-summarizer",
            name="Copylight Summarizer",
            role="Document Copyeditor & Summarizer",
            system_prompt="You are a meticulous content editor. Take comprehensive raw research data and synthesize it into brief, beautifully formatted Markdown summaries with actionable metrics.",
            model="gpt-4o-mini",
            tools=["summarizer"],
            memory_enabled=True,
            max_tokens=1000,
            guardrails={"max_iterations": 5, "forbidden_topics": []},
            telegram_enabled=True
        )

        classifier = DB_Agent(
            id="agent-classifier",
            name="Triage Specialist",
            role="Customer Inbox Classifier",
            system_prompt="Evaluate customer email requests. Group into categories: BILLING, TECH_SUPPORT, or GENERAL. Your response MUST strictly print either 'BILLING' or 'TECH_SUPPORT' or 'GENERAL' and nothing else.",
            model="gpt-4o-mini",
            tools=[],
            memory_enabled=False,
            max_tokens=100,
            telegram_enabled=False
        )

        db.add_all([researcher, summarizer, classifier])
        db.commit()

        # 2. Template Workflows
        template_1 = DB_Workflow(
            id="wf-template-research-summary",
            name="Research + Summary Pipeline",
            description="Searches DuckDuckGo on a given topic using the Researcher Agent, then compiles edit guidelines using the Summarizer.",
            is_template=True,
            graph_definition={
                "nodes": [
                    {"id": "node-in", "type": "input", "label": "Search Keyword Prompt"},
                    {"id": "node-research", "type": "agent", "agentId": "agent-researcher", "label": "Technical Facts Search"},
                    {"id": "node-summary", "type": "agent", "agentId": "agent-summarizer", "label": "Markdown Copy Summarizer"},
                    {"id": "node-out", "type": "output", "label": "Approved Document Outcome"}
                ],
                "edges": [
                    {"id": "edge-1", "source": "node-in", "target": "node-research"},
                    {"id": "edge-2", "source": "node-research", "target": "node-summary"},
                    {"id": "edge-3", "source": "node-summary", "target": "node-out"}
                ]
            }
        )

        template_2 = DB_Workflow(
            id="wf-template-support-triage",
            name="Customer Support Triage",
            description="Filters support threads using a triage classifier, routing Billing queries directly to a billing context and Tech queries elsewhere.",
            is_template=True,
            graph_definition={
                "nodes": [
                    {"id": "n-start", "type": "input", "label": "Client Inbox Ticket"},
                    {"id": "n-triage", "type": "agent", "agentId": "agent-classifier", "label": "Triage Classifier Specialist"},
                    {"id": "n-condition", "type": "condition", "label": "Billing Routing Check", "config": {
                        "conditionExpression": "compliant === true", # Evaluated criteria
                        "yesNodeId": "n-billing-handler",
                        "noNodeId": "n-tech-handler"
                    }},
                    {"id": "n-billing-handler", "type": "agent", "agentId": "agent-summarizer", "label": "Billing Agent Responder"},
                    {"id": "n-tech-handler", "type": "agent", "agentId": "agent-researcher", "label": "Engineering Support Responder"}
                ],
                "edges": [
                    {"id": "eg-1", "source": "n-start", "target": "n-triage"},
                    {"id": "eg-2", "source": "n-triage", "target": "n-condition"},
                    {"id": "eg-3", "source": "n-condition", "target": "n-billing-handler", "conditionLabel": "Is Billing Match"},
                    {"id": "eg-4", "source": "n-condition", "target": "n-tech-handler", "conditionLabel": "Is Engineering Support"}
                ]
            }
        )

        db.add_all([template_1, template_2])
        db.commit()

    except Exception as err:
        logger.error(f"Error seeding initial database: {str(err)}")
    finally:
        db.close()


import os
import json
from pydantic import BaseModel
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect
from backend.routers.executions import manager

class SystemSettings(BaseModel):
    telegramBotToken: Optional[str] = None
    slackBotToken: Optional[str] = None
    systemPromptGuardrails: Optional[bool] = None
    modelRateLimits: Optional[int] = None

SETTINGS_FILE = "./backend/settings.json"

def read_settings() -> dict:
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def write_settings(data: dict):
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    init_db()
    # Populate preset seed templates
    seed_database_templates()
    
    # Load settings from JSON into environment variables
    settings = read_settings()
    if settings.get("telegramBotToken"):
        os.environ["TELEGRAM_BOT_TOKEN"] = settings.get("telegramBotToken")
        logger.info("[Lifespan Startup] Configured live Telegram Bot connection token.")

    # Launch active Telegram polling gateway inside asyncio loops
    telegram_task = asyncio.create_task(run_telegram_service())
    
    yield
    
    # Shutting down operations
    telegram_task.cancel()
    try:
        await telegram_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="AI Agent Orchestration Platform API",
    description="LangGraph StateGraph multi-agent execution pipeline server dashboard.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS Cross-Origin allowances
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router controllers
app.include_router(agents.router, prefix="/api")
app.include_router(workflows.router, prefix="/api")
app.include_router(executions.router, prefix="/api")
app.include_router(messages.router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "AI Orchestration Platform Server"}

@app.get("/api/settings")
def get_settings():
    return read_settings()

@app.post("/api/settings")
def save_settings(settings: SystemSettings):
    current = read_settings()
    updated = {**current, **settings.dict(exclude_unset=True)}
    write_settings(updated)
    
    if settings.telegramBotToken:
        os.environ["TELEGRAM_BOT_TOKEN"] = settings.telegramBotToken
        # If bot token changes, we can dynamically trigger re-initialising
        logger.info("[Settings Hook] Saved and updated TELEGRAM_BOT_TOKEN environment variable.")
    return updated

@app.websocket("/ws/logs/{run_id}")
async def ws_logs_top_level(websocket: WebSocket, run_id: str):
    await manager.connect(run_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(json.dumps({"ping": "received", "data": data}))
    except WebSocketDisconnect:
        manager.disconnect(run_id, websocket)
    except Exception:
        manager.disconnect(run_id, websocket)
