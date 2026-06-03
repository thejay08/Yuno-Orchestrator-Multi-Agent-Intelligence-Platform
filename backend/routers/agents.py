from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db, DB_Agent
from backend.models import AgentCreate, AgentOut
import uuid

router = APIRouter(prefix="/agents", tags=["Agents"])

@router.get("", response_model=List[AgentOut])
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(DB_Agent).all()
    return agents

@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(agent_in: AgentCreate, db: Session = Depends(get_db)):
    agent_id = agent_in.id or f"agent-{uuid.uuid4().hex[:8]}"
    
    # Check duplicate
    existing = db.query(DB_Agent).filter(DB_Agent.id == agent_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Agent with identifier '{agent_id}' already registered."
        )

    db_agent = DB_Agent(
        id=agent_id,
        name=agent_in.name,
        role=agent_in.role,
        system_prompt=agent_in.system_prompt,
        model=agent_in.model,
        tools=agent_in.tools,
        memory_enabled=agent_in.memory_enabled,
        max_tokens=agent_in.max_tokens,
        guardrails=agent_in.guardrails,
        telegram_enabled=agent_in.telegram_enabled
    )
    
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    return db_agent

@router.get("/{id}", response_model=AgentOut)
def get_agent(id: str, db: Session = Depends(get_db)):
    agent = db.query(DB_Agent).filter(DB_Agent.id == id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent profile not matched")
    return agent

@router.put("/{id}", response_model=AgentOut)
def update_agent(id: str, agent_in: AgentCreate, db: Session = Depends(get_db)):
    agent = db.query(DB_Agent).filter(DB_Agent.id == id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.name = agent_in.name
    agent.role = agent_in.role
    agent.system_prompt = agent_in.system_prompt
    agent.model = agent_in.model
    agent.tools = agent_in.tools
    agent.memory_enabled = agent_in.memory_enabled
    agent.max_tokens = agent_in.max_tokens
    agent.guardrails = agent_in.guardrails
    agent.telegram_enabled = agent_in.telegram_enabled

    db.commit()
    db.refresh(agent)
    return agent

@router.delete("/{id}")
def delete_agent(id: str, db: Session = Depends(get_db)):
    agent = db.query(DB_Agent).filter(DB_Agent.id == id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    db.delete(agent)
    db.commit()
    return {"success": True, "detail": "Cognitive agent wiped from database memory"}
