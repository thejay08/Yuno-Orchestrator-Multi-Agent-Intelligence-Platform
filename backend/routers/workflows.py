from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db, DB_Workflow
from backend.models import WorkflowCreate, WorkflowOut
import uuid

router = APIRouter(prefix="/workflows", tags=["Workflows"])

@router.get("", response_model=List[WorkflowOut])
def list_workflows(db: Session = Depends(get_db)):
    workflows = db.query(DB_Workflow).all()
    return workflows

@router.post("", response_model=WorkflowOut)
def create_or_update_workflow(wf_in: WorkflowCreate, db: Session = Depends(get_db)):
    workflow_id = wf_in.id or f"wf-{uuid.uuid4().hex[:8]}"
    
    # Upsert pattern
    db_wf = db.query(DB_Workflow).filter(DB_Workflow.id == workflow_id).first()
    
    if db_wf:
        db_wf.name = wf_in.name
        db_wf.description = wf_in.description
        db_wf.graph_definition = wf_in.graph_definition
        db_wf.is_template = wf_in.is_template
    else:
        db_wf = DB_Workflow(
            id=workflow_id,
            name=wf_in.name,
            description=wf_in.description,
            graph_definition=wf_in.graph_definition,
            is_template=wf_in.is_template
        )
        db.add(db_wf)

    db.commit()
    db.refresh(db_wf)
    return db_wf

@router.get("/templates", response_model=List[WorkflowOut])
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(DB_Workflow).filter(DB_Workflow.is_template == True).all()
    return templates

@router.get("/{id}", response_model=WorkflowOut)
def get_workflow(id: str, db: Session = Depends(get_db)):
    wf = db.query(DB_Workflow).filter(DB_Workflow.id == id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Pipeline workflow schema not found")
    return wf

@router.delete("/{id}")
def delete_workflow(id: str, db: Session = Depends(get_db)):
    wf = db.query(DB_Workflow).filter(DB_Workflow.id == id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow schema not found")
    
    db.delete(wf)
    db.commit()
    return {"success": True, "detail": "Workflow wiped successfully"}
