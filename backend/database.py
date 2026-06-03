import datetime
import json
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./agent_platform.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DB_Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=False)
    model = Column(String, default="gpt-4o")
    tools = Column(JSON, default=list)  # JSON list e.g. ["web_search", "calculator"]
    memory_enabled = Column(Boolean, default=True)
    max_tokens = Column(Integer, default=2000)
    guardrails = Column(JSON, default=dict)  # {"max_iterations": 10, "forbidden_topics": []}
    telegram_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class DB_Workflow(Base):
    __tablename__ = "workflows"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    graph_definition = Column(JSON, nullable=False)  # { "nodes": [...], "edges": [...] }
    is_template = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class DB_WorkflowExecution(Base):
    __tablename__ = "workflow_executions"

    id = Column(String, primary_key=True, index=True)
    workflow_id = Column(String, nullable=False)
    status = Column(String, default="running")  # running, completed, failed
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    result = Column(JSON, nullable=True)

class DB_Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, index=True)
    execution_id = Column(String, index=True, nullable=True)
    agent_id = Column(String, index=True, nullable=True)
    role = Column(String, nullable=False)  # user, assistant, agent-to-agent
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    token_count = Column(Integer, default=0)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
