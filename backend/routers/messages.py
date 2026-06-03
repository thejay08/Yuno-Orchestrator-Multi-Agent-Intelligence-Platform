from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db, DB_Message
from backend.models import MessageOut

router = APIRouter(prefix="/messages", tags=["Messages"])

@router.get("", response_model=List[MessageOut])
def list_messages(
    execution_id: Optional[str] = Query(None, description="Filter messages by execution ID"),
    agent_id: Optional[str] = Query(None, description="Filter messages by agent ID"),
    db: Session = Depends(get_db)
):
    query = db.query(DB_Message)
    if execution_id:
        query = query.filter(DB_Message.execution_id == execution_id)
    if agent_id:
        query = query.filter(DB_Message.agent_id == agent_id)
    
    messages = query.order_by(DB_Message.timestamp.asc()).all()
    return messages
