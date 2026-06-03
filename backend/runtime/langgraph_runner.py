from typing import TypedDict, List, Dict, Any, Callable, Optional
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from backend.database import DB_Agent, DB_Workflow, DB_Message
from backend.runtime.tools import get_tool_by_name
from backend.runtime.memory import AgentMemoryStore
from sqlalchemy.orm import Session
import json
import logging
import asyncio

logger = logging.getLogger(__name__)

class WorkflowState(TypedDict):
    messages: List[Dict[str, str]]
    current_agent: str
    shared_memory: Dict[str, Any]
    last_node_executed: str
    run_id: str
    loop_states: Dict[str, int]

class LangGraphWorkflowRunner:
    def __init__(self, db: Session, websocket_helper: Optional[Callable[[str, Any], Any]] = None):
        self.db = db
        self.websocket_helper = websocket_helper

    async def log_event(self, run_id: str, message: str, level: str = "info", agent_id: str = None, node_id: str = None):
        """Dispatches progress logs to the background logger and active live websocket."""
        import datetime
        import uuid
        from backend.database import DB_WorkflowExecution

        # Map levels according to theme instructions:
        # blue=input, green=agent_response, orange=tool_call, red=error
        mapped_level = level
        lower_msg = message.lower()
        if level == "success" or "response completed" in lower_msg or "finalized pipeline" in lower_msg:
            mapped_level = "agent_response"
        elif "requested tool invoking" in lower_msg or "tool success response" in lower_msg or "attached validation" in lower_msg:
            mapped_level = "tool_call"
        elif "starting pipeline trigger" in lower_msg or "current workflow progress" in lower_msg:
            mapped_level = "input"
        elif level == "error" or "failed" in lower_msg or "error" in lower_msg:
            mapped_level = "error"

        # Calculate a reasonable token estimate based on message size
        tokens_used = len(message.split()) + 4

        timestamp_str = datetime.datetime.utcnow().isoformat() + "Z"
        log_payload = {
            "id": f"log-{uuid.uuid4().hex[:6]}",
            "timestamp": timestamp_str,
            "run_id": run_id,
            "message": message,
            "level": mapped_level,
            "agent_id": agent_id,
            "node_id": node_id,
            "tokens_used": tokens_used
        }

        # Persist log event to execution record in database
        try:
            execution = self.db.query(DB_WorkflowExecution).filter(DB_WorkflowExecution.id == run_id).first()
            if execution:
                res_data = execution.result or {}
                logs_list = res_data.get("logs", [])
                logs_list.append(log_payload)
                res_data["logs"] = logs_list

                # Dynamic tokens and cost calculation
                total_tokens = sum(l.get("tokens_used", 0) for l in logs_list)
                res_data["token_count"] = total_tokens
                res_data["estimated_cost"] = total_tokens * 0.000002

                execution.result = res_data
                self.db.commit()
        except Exception as db_err:
            logger.error(f"Error saving log to DB row: {str(db_err)}")

        if self.websocket_helper:
            # Non-blocking async fire-and-forget
            asyncio.create_task(self.websocket_helper(run_id, log_payload))
        logger.info(f"[{mapped_level.upper()}] Execution {run_id}: {message}")

    def build_and_compile_graph(self, workflow: DB_Workflow) -> StateGraph:
        """Dynamically translates our database Workflow diagram into a compiled StateGraph structure."""
        graph_definition = workflow.graph_definition
        nodes_list = graph_definition.get("nodes", [])
        edges_list = graph_definition.get("edges", [])

        builder = StateGraph(WorkflowState)

        # 1. Define nodes
        for node in nodes_list:
            node_id = node["id"]
            node_type = node["type"]

            if node_type == "input":
                # Entry node
                def make_input_node(nid=node_id):
                    async def input_node_fn(state: WorkflowState):
                        await self.log_event(state["run_id"], f"Starting pipeline trigger input block: {nid}", "info", node_id=nid)
                        return {**state, "last_node_executed": nid}
                    return input_node_fn
                builder.add_node(node_id, make_input_node())

            elif node_type == "agent":
                agent_id = node.get("agentId")
                def make_agent_node(nid=node_id, aid=agent_id):
                    async def agent_node_fn(state: WorkflowState):
                        # Fetch agent profile
                        agent = self.db.query(DB_Agent).filter(DB_Agent.id == aid).first()
                        if not agent:
                            await self.log_event(state["run_id"], f"Agent config missing in database: {aid}", "error", node_id=nid)
                            raise ValueError(f"Agent {aid} not found.")

                        await self.log_event(state["run_id"], f"Activating pipeline agent node '{agent.name}' (Role: {agent.role})", "info", agent_id=aid, node_id=nid)
                        
                        # Load previous 20 memory context entries if enabled
                        context_history = []
                        if agent.memory_enabled:
                            memory_store = AgentMemoryStore(self.db)
                            context_history = memory_store.get_agent_context(aid, limit=20)
                            await self.log_event(state["run_id"], f"Loaded {len(context_history)} memory messages into '{agent.name}' context", "info", agent_id=aid, node_id=nid)

                        # Assemble LLM inputs
                        chat_messages = [SystemMessage(content=agent.system_prompt)]
                        for historical in context_history:
                            if historical["role"] == "user":
                                chat_messages.append(HumanMessage(content=historical["content"]))
                            else:
                                chat_messages.append(AIMessage(content=historical["content"]))

                        # Pack current execution timeline inputs
                        prompt_body = f"Current workflow progress data input:\n{json.dumps(state['messages'])}"
                        chat_messages.append(HumanMessage(content=prompt_body))

                        # Integrate LLM call
                        import os
                        openai_key = os.environ.get("OPENAI_API_KEY", "")
                        gemini_key = os.environ.get("GEMINI_API_KEY", "")
                        
                        agent_model = agent.model or "gemini-3.5-flash"
                        if "gemini" in agent_model.lower() or (gemini_key and not openai_key):
                            target_key = gemini_key or openai_key or "mock_key"
                            fallback_model = "gemini-2.5-flash" if "flash" in agent_model.lower() else "gemini-2.5-pro"
                            llm = ChatOpenAI(
                                model=fallback_model,
                                api_key=target_key,
                                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                                max_tokens=agent.max_tokens or 2000
                            )
                        else:
                            llm = ChatOpenAI(
                                model=agent_model,
                                api_key=openai_key or "mock_key",
                                max_tokens=agent.max_tokens or 2000
                            )
                        
                        binded_tools = []
                        if agent.tools:
                            for tool_name in agent.tools:
                                tool_fn = get_tool_by_name(tool_name)
                                if tool_fn:
                                    binded_tools.append(tool_fn)
                        
                        if binded_tools:
                            llm = llm.bind_tools(binded_tools)
                            await self.log_event(state["run_id"], f"Attached validation tools to '{agent.name}': {agent.tools}", "info", agent_id=aid, node_id=nid)

                        # Invoke Chat API
                        try:
                            response = await asyncio.to_thread(llm.invoke, chat_messages)
                            response_content = response.content

                            # Handle any Tool Call outcomes
                            if hasattr(response, "tool_calls") and response.tool_calls:
                                for tool_call_item in response.tool_calls:
                                    tname = tool_call_item["name"]
                                    targs = tool_call_item["args"]
                                    await self.log_event(state["run_id"], f"Agent '{agent.name}' requested tool invoking: {tname}({json.dumps(targs)})", "info", agent_id=aid, node_id=nid)
                                    
                                    ttool = get_tool_by_name(tname)
                                    if ttool:
                                        tresult = await asyncio.to_thread(ttool.invoke, targs)
                                        await self.log_event(state["run_id"], f"Tool success response: {tresult}", "success", agent_id=aid, node_id=nid)
                                        # Inject tool result to prompt
                                        chat_messages.append(AIMessage(content=f"Tool {tname} executed. Result: {tresult}"))
                                        # Secondary invocation
                                        response = await asyncio.to_thread(llm.invoke, chat_messages)
                                        response_content = response.content

                            # Save to Database messages history
                            db_store = AgentMemoryStore(self.db)
                            db_store.add_message(aid, "assistant", response_content, execution_id=state["run_id"])

                            await self.log_event(state["run_id"], f"Response completed by '{agent.name}': {response_content[:150]}...", "success", agent_id=aid, node_id=nid)

                            # Put outcome in state
                            updated_messages = list(state["messages"])
                            updated_messages.append({
                                "agent_id": aid,
                                "agent_name": agent.name,
                                "content": response_content
                            })

                            return {
                                **state,
                                "messages": updated_messages,
                                "last_node_executed": nid,
                                "current_agent": aid
                            }
                        except Exception as chat_err:
                            await self.log_event(state["run_id"], f"LLM calling failed for '{agent.name}': {str(chat_err)}", "error", agent_id=aid, node_id=nid)
                            raise chat_err
                    return agent_node_fn
                builder.add_node(node_id, make_agent_node())

            elif node_type == "condition":
                node_config = node.get("config", {})
                def make_condition_node(nid=node_id, cfg=node_config):
                    async def condition_node_fn(state: WorkflowState):
                        await self.log_event(state["run_id"], f"Evaluating rule expression block {nid}", "info", node_id=nid)
                        return {**state, "last_node_executed": nid}
                    return condition_node_fn
                builder.add_node(node_id, make_condition_node())

            elif node_type == "output":
                def make_output_node(nid=node_id):
                    async def output_node_fn(state: WorkflowState):
                        await self.log_event(state["run_id"], "Finalized pipeline execution. Saving output data.", "success", node_id=nid)
                        return {**state, "last_node_executed": nid}
                    return output_node_fn
                builder.add_node(node_id, make_output_node())

        # 2. Set structural entries
        input_node = next((n for n in nodes_list if n["type"] == "input"), None)
        if not input_node:
            raise ValueError("No start input block declared on this pipeline.")
        builder.set_entry_point(input_node["id"])

        # 3. Compile connected edge routings
        for node in nodes_list:
            node_id = node["id"]
            node_type = node["type"]

            # Filter outgoing edges
            outgoing_edges = [e for e in edges_list if e["source"] == node_id]
            if not outgoing_edges:
                continue

            if node_type != "condition":
                # Standard straight sequential routing edge
                target_node_id = outgoing_edges[0]["target"]
                builder.add_edge(node_id, target_node_id)
            else:
                # Conditional fork routing edge based on state evaluation
                node_config = node.get("config", {})
                yes_target = node_config.get("yesNodeId")
                no_target = node_config.get("noNodeId")
                expr = node_config.get("conditionExpression", "compliant === true")

                def make_router_fn(nid=node_id, yes_id=yes_target, no_id=no_target, evaluation_rule=expr):
                    def condition_router(state: WorkflowState):
                        # Inspect the last generated message text
                        last_message = ""
                        if state["messages"]:
                            last_message = state["messages"][-1]["content"]

                        # Check if criteria is evaluated in the output
                        is_yes = True
                        if "compliant" in evaluation_rule:
                            # Parse JSON or substring match
                            lower_msg = last_message.lower()
                            if "compliant" in lower_msg:
                                if "false" in lower_msg or '"compliant": false' in lower_msg.replace(" ", ""):
                                    is_yes = False
                            else:
                                if "fail" in lower_msg or "incorrect" in lower_msg or "reject" in lower_msg:
                                    is_yes = False

                        routing_decision = "yes" if is_yes else "no"
                        
                        # Loop throttling mechanism to prevent client billing drain
                        loop_limit = selector_cfg.get("loopCountLimit", 3) if "selector_cfg" in locals() else 3
                        state["loop_states"] = state.get("loop_states") or {}
                        loop_key = f"{nid}_key"
                        state["loop_states"][loop_key] = state["loop_states"].get(loop_key, 0)
                        
                        if routing_decision == "no":
                            state["loop_states"][loop_key] += 1
                            if state["loop_states"][loop_key] > loop_limit:
                                # Safe bypass
                                return "bypass_to_yes"
                            return "no"
                        return "yes"
                    return condition_router

                # Connect routing outputs
                builder.add_conditional_edges(
                    node_id,
                    make_router_fn(),
                    {
                        "yes": yes_target if yes_target else END,
                        "no": no_target if no_target else END,
                        "bypass_to_yes": yes_target if yes_target else END
                    }
                )

        # Build execution pipeline graph
        return builder.compile()

    async def execute_run(self, workflow_obj: DB_Workflow, run_id: str, initial_prompt: str) -> Dict[str, Any]:
        """Boots compilation, sets initial payload, and triggers state progression."""
        compiled_graph = self.build_and_compile_graph(workflow_obj)

        initial_state: WorkflowState = {
            "messages": [{
                "agent_id": "customer_trigger",
                "agent_name": "Customer User Input",
                "content": initial_prompt
            }],
            "current_agent": "customer_trigger",
            "shared_memory": {},
            "last_node_executed": "",
            "run_id": run_id,
            "loop_states": {}
        }

        await self.log_event(run_id, "Compiling multi-agent state state-graph", "info")
        
        # Execute StateGraph
        final_state = await compiled_graph.ainvoke(initial_state)
        
        await self.log_event(run_id, "Workflow graph execution successfully finalized database transaction.", "success")
        return final_state
