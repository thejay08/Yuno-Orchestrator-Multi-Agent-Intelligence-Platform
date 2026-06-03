from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class AgentBase(BaseModel):
    name: str
    role: str
    system_prompt: str
    model: str = "gpt-4o"
    tools: List[str] = []
    memory_enabled: bool = True
    max_tokens: int = 2000
    guardrails: Dict[str, Any] = Field(default_factory=lambda: {"max_iterations": 10, "forbidden_topics": []})
    telegram_enabled: bool = False

class AgentCreate(AgentBase):
    id: Optional[str] = None

class AgentOut(AgentBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    graph_definition: Dict[str, Any]
    is_template: bool = False

class WorkflowCreate(WorkflowBase):
    id: Optional[str] = None

class WorkflowOut(WorkflowBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class WorkflowExecutionCreate(BaseModel):
    workflow_id: str
    inputs: Dict[str, Any] = {}

class WorkflowExecutionOut(BaseModel):
    id: str
    workflow_id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    execution_id: Optional[str] = None
    agent_id: Optional[str] = None
    role: str
    content: str
    token_count: int = 0

class MessageOut(MessageCreate):
    id: str
    timestamp: datetime

    class Config:
        from_attributes = True
