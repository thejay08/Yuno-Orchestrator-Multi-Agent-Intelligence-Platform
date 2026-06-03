import asyncio
import logging
import os
from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from sqlalchemy.orm import Session
from backend.database import SessionLocal, DB_Agent, DB_Message
from backend.runtime.langgraph_runner import LangGraphWorkflowRunner
import uuid

logger = logging.getLogger(__name__)

# Cache active user state: {chat_id: agent_id}
USER_AGENT_SELECTION = {}

async def start_telegram_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Answers /start command, listing available agents that support telegram channel."""
    chat_id = update.effective_chat.id
    db = SessionLocal()
    try:
        # Query agents with telegram channel enabled
        agents = db.query(DB_Agent).filter(DB_Agent.telegram_enabled == True).all()
        if not agents:
            await update.message.reply_text(
                "Welcome to Yuno Bot! 🤖\nNo agents are currently configured in the orchestrator database with Telegram enabled.\nActivate 'Telegram Channel' in your Settings panel first."
            )
            return

        keyboard = [[agent.name] for agent in agents]
        markup = ReplyKeyboardMarkup(keyboard, one_time_keyboard=True, resize_keyboard=True)

        await update.message.reply_text(
            "Welcome to Yuno Orchestration! 🤖\nChoose an AI agent block profile to converse with:",
            reply_markup=markup
        )
    finally:
        db.close()

async def handle_text_messages(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Processes either an agent selection button OR directs a prompt to the chosen agent."""
    text = update.message.text
    chat_id = update.effective_chat.id
    db = SessionLocal()
    
    try:
        # Check if text matches any active agent name to select it
        agents = db.query(DB_Agent).filter(DB_Agent.telegram_enabled == True).all()
        selected_agent = next((a for a in agents if a.name == text), None)

        if selected_agent:
            USER_AGENT_SELECTION[chat_id] = selected_agent.id
            await update.message.reply_text(
                f"Active Connection set to **{selected_agent.name}** ({selected_agent.role}).\nType your message below to send a prompt.",
                reply_markup=ReplyKeyboardRemove()
            )
            return

        # On user message, find the agent with telegram_enabled=True, or fallback to selected
        agent = db.query(DB_Agent).filter(DB_Agent.telegram_enabled == True).first()
        
        if not agent:
            active_agent_id = USER_AGENT_SELECTION.get(chat_id)
            if active_agent_id:
                agent = db.query(DB_Agent).filter(DB_Agent.id == active_agent_id).first()

        if not agent:
            await update.message.reply_text("Welcome! Please configure at least one agent with 'Telegram Channel' enabled in your Credentials/Settings first, or choose one via /start.")
            return

        # Notify user that agent is writing
        await update.message.reply_chat_action("typing")

        # 1. Log customer incoming message to messages history
        user_msg = DB_Message(
            id=f"msg-{uuid.uuid4().hex[:8]}",
            agent_id=agent.id,
            role="user",
            content=text,
            token_count=len(text.split())
        )
        db.add(user_msg)
        db.commit()

        # 2. Run that agent through LangGraph single-node execution
        from langgraph.graph import StateGraph, END
        from typing import TypedDict, List
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import SystemMessage, HumanMessage

        class BotState(TypedDict):
            messages: List[Any]
            response: str

        async def single_agent_node(state: BotState):
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

            chat_history = [
                SystemMessage(content=f"You are {agent.name}, a {agent.role}. {agent.system_prompt}"),
                HumanMessage(content=text)
            ]
            
            res = await asyncio.to_thread(llm.invoke, chat_history)
            return {"messages": state["messages"], "response": res.content}

        # Build Graph
        builder = StateGraph(BotState)
        builder.add_node("agent_block", single_agent_node)
        builder.set_entry_point("agent_block")
        builder.add_edge("agent_block", END)
        graph = builder.compile()

        # Invoke dynamic single-node graph
        result_state = await graph.ainvoke({"messages": [], "response": ""})
        reply_content = result_state["response"]

        # 3. Save assistant reply in database
        bot_msg = DB_Message(
            id=f"msg-{uuid.uuid4().hex[:8]}",
            agent_id=agent.id,
            role="assistant",
            content=reply_content,
            token_count=len(reply_content.split())
        )
        db.add(bot_msg)
        db.commit()

        # 4. Reply to customer
        await update.message.reply_text(reply_content)

    except Exception as e:
        logger.error(f"Telegram polling handler error: {str(e)}")
        await update.message.reply_text(f"An error occurred while routing message through agent processor block: {str(e)}")
    finally:
        db.close()

async def run_telegram_service():
    """Loops bot client application polling inside background asyncio thread."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token or token == "your_token_here":
        logger.warning("TELEGRAM_BOT_TOKEN missing in server credentials. Polling service inactive.")
        return

    try:
        app = Application.builder().token(token).build()
        app.add_handler(CommandHandler("start", start_telegram_command))
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_messages))

        # Initialise bot application state
        await app.initialize()
        await app.start()
        
        logger.info("[Telegram Service] Launching Bot polling listener loops.")
        await app.updater.start_polling()
        
        # Keep alive
        while True:
            await asyncio.sleep(5)
            
    except Exception as err:
        logger.error(f"[Telegram Bot Error] Closed loop: {str(err)}")
