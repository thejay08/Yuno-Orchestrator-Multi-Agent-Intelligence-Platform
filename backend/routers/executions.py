from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from backend.database import get_db, DB_WorkflowExecution, DB_Workflow, DB_Agent, DB_Message
from backend.models import WorkflowExecutionOut
from backend.runtime.langgraph_runner import LangGraphWorkflowRunner
import datetime
import uuid
import json
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Executions"])

# Manage active WebSockets connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, run_id: str, websocket: WebSocket):
        await websocket.accept()
        if run_id not in self.active_connections:
            self.active_connections[run_id] = []
        self.active_connections[run_id].append(websocket)

    def disconnect(self, run_id: str, websocket: WebSocket):
        if run_id in self.active_connections:
            self.active_connections[run_id].remove(websocket)
            if not self.active_connections[run_id]:
                del self.active_connections[run_id]

    async def broadcast(self, run_id: str, payload: Any):
        if run_id in self.active_connections:
            message_str = json.dumps(payload)
            for connection in self.active_connections[run_id]:
                try:
                    await connection.send_text(message_str)
                except Exception:
                    pass

manager = ConnectionManager()

def format_execution_to_run(execution: DB_WorkflowExecution, db: Session) -> Dict[str, Any]:
    """Translates database execution and intermediate agent messages into a clean model conforming to the React client's Run schema."""
    workflow = db.query(DB_Workflow).filter(DB_Workflow.id == execution.workflow_id).first()
    wf_name = workflow.name if workflow else f"Pipeline Workflow"

    db_messages = db.query(DB_Message).filter(DB_Message.execution_id == execution.id).order_by(DB_Message.timestamp.asc()).all()

    messages_list = []
    for msg in db_messages:
        sender_name = "Customer User Input" if msg.role == "user" else "AI Collaborator"
        if msg.agent_id:
            agent = db.query(DB_Agent).filter(DB_Agent.id == msg.agent_id).first()
            if agent:
                sender_name = agent.name

        messages_list.append({
            "id": msg.id,
            "timestamp": msg.timestamp.isoformat() + "Z",
            "senderId": msg.agent_id or "user",
            "senderName": sender_name,
            "receiverId": "channel",
            "receiverName": "Workspace Channel",
            "content": msg.content
        })

    result_data = execution.result or {}
    logs = result_data.get("logs", [])
    token_count = result_data.get("token_count", 0)
    estimated_cost = result_data.get("estimated_cost", 0.0)

    # Resolve final result text
    final_result_text = None
    if "final_state" in result_data and "messages" in result_data["final_state"]:
        state_msgs = result_data["final_state"]["messages"]
        if state_msgs and isinstance(state_msgs, list):
            final_result_text = state_msgs[-1].get("content")

    if not final_result_text and "error" in result_data:
        final_result_text = f"Execution failed: {result_data['error']}"

    outputs = {"finalResult": final_result_text} if final_result_text else {}

    # Extract initial topic input from logs/messages or default
    topic_input = "Initiated execution"
    if db_messages:
        user_msgs = [m for m in db_messages if m.role == "user"]
        if user_msgs:
            topic_input = user_msgs[0].content

    return {
        "id": execution.id,
        "workflowId": execution.workflow_id,
        "workflowName": wf_name,
        "status": execution.status,
        "createdAt": execution.started_at.isoformat() + "Z",
        "completedAt": execution.completed_at.isoformat() + "Z" if execution.completed_at else None,
        "tokenCount": token_count,
        "estimatedCost": estimated_cost,
        "logs": logs,
        "messages": messages_list,
        "inputs": {"topic": topic_input},
        "outputs": outputs
    }

@router.get("/executions", response_model=List[WorkflowExecutionOut])
def list_executions(db: Session = Depends(get_db)):
    return db.query(DB_WorkflowExecution).order_by(DB_WorkflowExecution.started_at.desc()).all()

@router.get("/executions/{id}", response_model=WorkflowExecutionOut)
def get_execution_detail(id: str, db: Session = Depends(get_db)):
    execution = db.query(DB_WorkflowExecution).filter(DB_WorkflowExecution.id == id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution

@router.get("/executions/{id}/logs")
def get_execution_logs(id: str, db: Session = Depends(get_db)):
    execution = db.query(DB_WorkflowExecution).filter(DB_WorkflowExecution.id == id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    result_data = execution.result or {}
    return result_data.get("logs", [])

@router.get("/runs")
def list_runs(db: Session = Depends(get_db)):
    executions = db.query(DB_WorkflowExecution).order_by(DB_WorkflowExecution.started_at.desc()).all()
    return [format_execution_to_run(e, db) for e in executions]

@router.get("/runs/{id}")
def get_run_detail(id: str, db: Session = Depends(get_db)):
    execution = db.query(DB_WorkflowExecution).filter(DB_WorkflowExecution.id == id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Run mapping not found")
    return format_execution_to_run(execution, db)

async def background_execution_helper(run_id: str, workflow_id: str, user_input: str):
    """Triggers compiled LangGraph execution on separate thread stack, sending websocket updates."""
    from backend.database import SessionLocal, DB_WorkflowExecution, DB_Message
    db = SessionLocal()
    try:
        workflow = db.query(DB_Workflow).filter(DB_Workflow.id == workflow_id).first()
        if not workflow:
            return

        # 1. Log incoming user instruction to database messages
        user_msg = DB_Message(
            id=f"msg-{uuid.uuid4().hex[:8]}",
            execution_id=run_id,
            role="user",
            content=user_input,
            timestamp=datetime.datetime.utcnow(),
            token_count=len(user_input.split())
        )
        db.add(user_msg)
        db.commit()

        async def websocket_sender(r_id: str, payload: Any):
            await manager.broadcast(r_id, payload)

        runner = LangGraphWorkflowRunner(db, websocket_sender)
        
        # Execute LangGraph compile and run
        final_state = await runner.execute_run(workflow, run_id, user_input)
        
        # Save output result
        execution = db.query(DB_WorkflowExecution).filter(DB_WorkflowExecution.id == run_id).first()
        if execution:
            execution.status = "completed"
            execution.completed_at = datetime.datetime.utcnow()
            
            res_data = execution.result or {}
            res_data["final_state"] = final_state
            execution.result = res_data
            
            # Save final message to DB messages
            res_messages = final_state.get("messages", [])
            if res_messages:
                last_msg_item = res_messages[-1]
                last_msg_id = f"msg-{uuid.uuid4().hex[:8]}"
                
                bot_msg = DB_Message(
                    id=last_msg_id,
                    execution_id=run_id,
                    agent_id=last_msg_item.get("agent_id"),
                    role="assistant",
                    content=last_msg_item.get("content", ""),
                    timestamp=datetime.datetime.utcnow(),
                    token_count=len(last_msg_item.get("content", "").split())
                )
                db.add(bot_msg)
                db.commit()

            db.commit()

    except Exception as e:
        logger.error(f"LangGraph run triggered failure: {str(e)}")
        execution = db.query(DB_WorkflowExecution).filter(DB_WorkflowExecution.id == run_id).first()
        if execution:
            execution.status = "failed"
            execution.completed_at = datetime.datetime.utcnow()
            
            res_data = execution.result or {}
            res_data["error"] = str(e)
            execution.result = res_data
            db.commit()
    finally:
        db.close()

def trigger_execution_internal(workflow_id: str, user_prompt: str, background_tasks: BackgroundTasks, db: Session) -> DB_WorkflowExecution:
    workflow = db.query(DB_Workflow).filter(DB_Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Target pipeline workflow is unregistered")

    run_id = f"run-{uuid.uuid4().hex[:8]}"
    execution = DB_WorkflowExecution(
        id=run_id,
        workflow_id=workflow_id,
        status="running",
        started_at=datetime.datetime.utcnow(),
        result={"logs": []}
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    # Execute workflow runtime on separate background tasks pool
    background_tasks.add_task(background_execution_helper, run_id, workflow_id, user_prompt)

    return execution

@router.post("/runs")
def trigger_run_api(payload: Dict[str, Any], background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    workflow_id = payload.get("workflowId") or payload.get("workflow_id")
    if not workflow_id:
        raise HTTPException(status_code=400, detail="Missing workflowId")
    inputs = payload.get("inputs", {})
    user_prompt = inputs.get("topic") or inputs.get("text") or "Execute dynamic workflow prompt"
    
    execution = trigger_execution_internal(workflow_id, user_prompt, background_tasks, db)
    return format_execution_to_run(execution, db)

@router.post("/workflows/execute")
def execute_workflow_direct(payload: Dict[str, Any], background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    workflow_id = payload.get("workflow_id") or payload.get("workflowId")
    if not workflow_id:
        raise HTTPException(status_code=400, detail="Missing workflow_id")
    user_prompt = payload.get("task") or payload.get("inputs", {}).get("text") or "Trigger LangGraph pipeline rule audit."
    
    execution = trigger_execution_internal(workflow_id, user_prompt, background_tasks, db)
    return format_execution_to_run(execution, db)

@router.websocket("/ws/executions/{run_id}")
async def websocket_executions_endpoint(websocket: WebSocket, run_id: str):
    await manager.connect(run_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(json.dumps({"ping": "received", "data": data}))
    except WebSocketDisconnect:
        manager.disconnect(run_id, websocket)
    except Exception:
        manager.disconnect(run_id, websocket)

@router.websocket("/ws/logs/{run_id}")
async def websocket_logs_endpoint(websocket: WebSocket, run_id: str):
    await manager.connect(run_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(json.dumps({"ping": "received", "data": data}))
    except WebSocketDisconnect:
        manager.disconnect(run_id, websocket)
    except Exception:
        manager.disconnect(run_id, websocket)
