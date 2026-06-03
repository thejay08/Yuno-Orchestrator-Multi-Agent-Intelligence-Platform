import safe_eval
from langchain_core.tools import tool
from duckduckgo_search import DDGS
from langchain_openai import ChatOpenAI
import os

@tool
def web_search(query: str) -> str:
    """Useful to search modern news, links, facts, and public web information about any topic."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
            if not results:
                return f"No search results found on web for: {query}"
            
            output = []
            for r in results:
                output.append(f"Title: {r.get('title')}\nSource: {r.get('href')}\nSummary: {r.get('body')}\n")
            return "\n---\n".join(output)
    except Exception as e:
        return f"Error executing DuckDuckGo search: {str(e)}"

@tool
def calculator(expression: str) -> str:
    """Evaluates mathematical strings safely. Example expression: '23 * (45 - 12)'"""
    try:
        # Sanitize string to allow only digits and math operators
        allowed_chars = set("0123456789+-*/(). ")
        if not all(char in allowed_chars for char in expression):
            return "Failed to evaluate: Restricted characters in expression."
        
        # Safe compile and eval sandbox
        result = eval(expression, {"__builtins__": None}, {})
        return f"Result: {result}"
    except Exception as e:
        return f"Error parsing mathematical expression: {str(e)}"

@tool
def summarizer(text: str) -> str:
    """Triggers an auxiliary ChatGPT thread to synthesize large blobs of text into core bullet points."""
    try:
        api_key = os.getenv("OPENAI_API_KEY", "")
        gemini_key = os.getenv("GEMINI_API_KEY", "")
        
        if not api_key and not gemini_key:
            # Fallback to simple local summarization if keys are missing
            lines = text.split("\n")
            summary_lines = [l for l in lines if len(l.strip()) > 10][:4]
            return "Local Summary (No API keys configured):\n" + "\n".join(summary_lines)

        if gemini_key and not api_key:
            llm = ChatOpenAI(
                model="gemini-2.5-flash",
                api_key=gemini_key,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
            )
        else:
            llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key)
            
        res = llm.invoke(f"Summarize the following text clearly in 4 bullet points:\n\n{text}")
        return res.content
    except Exception as e:
        return f"Summarizer module error: {str(e)}"

@tool
def send_message(recipient_agent_id: str, message_payload: str) -> str:
    """Dispatches a directed task or information message pack to another agent block."""
    return f"Successfully queued message delivery to recipient agent '{recipient_agent_id}' with payload: {message_payload}"

# Retrieve tools lookup helper
def get_tool_by_name(name: str):
    tools_map = {
        "web_search": web_search,
        "calculator": calculator,
        "summarizer": summarizer,
        "send_message": send_message
    }
    return tools_map.get(name)
