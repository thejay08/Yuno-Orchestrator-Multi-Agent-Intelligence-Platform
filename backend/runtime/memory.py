from sqlalchemy.orm import Session
from backend.database import DB_Message
from typing import List, Dict, Any

class AgentMemoryStore:
    def __init__(self, db: Session):
        self.db = db

    def get_agent_context(self, agent_id: str, limit: int = 20) -> List[Dict[str, str]]:
        """
        Retrieves the last N messages associated with this agent to form conversation context.
        """
        messages = (
            self.db.query(DB_Message)
            .filter(DB_Message.agent_id == agent_id)
            .order_by(DB_Message.timestamp.desc())
            .limit(limit)
            .all()
        )
        
        # Reverse list to keep chronological order
        messages.reverse()
        
        context = []
        for msg in messages:
            # Format to dict format expected by models
            context.append({
                "role": msg.role,
                "content": msg.content
            })
        return context

    def add_message(self, agent_id: str, role: str, content: str, execution_id: str = None) -> DB_Message:
        """
        Persists a message to the database, automatically updating the agent's memory trace.
        """
        import uuid
        db_msg = DB_Message(
            id=f"msg-{uuid.uuid4().hex[:8]}",
            execution_id=execution_id,
            agent_id=agent_id,
            role=role,
            content=content,
            token_count=len(content.split()) * 1.3  # Simple approximation
        )
        self.db.add(db_msg)
        self.db.commit()
        self.db.refresh(db_msg)
        return db_msg
