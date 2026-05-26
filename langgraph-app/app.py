import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional, TypedDict

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


APP_NAME = "reduOS LangGraph Agent API"
LANGGRAPH_API_KEY = os.getenv("LANGGRAPH_API_KEY", "")

AI_ENABLED = env_bool("LANGGRAPH_AI_ENABLED", env_bool("AI_ENABLED", True))
AI_PROVIDER = os.getenv("LANGGRAPH_AI_PROVIDER", os.getenv("AI_PROVIDER", "openai-compatible"))
AI_BASE_URL = os.getenv("LANGGRAPH_AI_BASE_URL", os.getenv("AI_CHAT_BASE_URL", ""))
AI_API_KEY = os.getenv("LANGGRAPH_AI_API_KEY", os.getenv("AI_CHAT_API_KEY", ""))
AI_MODEL = os.getenv("LANGGRAPH_AI_MODEL", os.getenv("AI_CHAT_MODEL", "local-deepseek"))
OLLAMA_URL = os.getenv("OLLAMA_URL", "")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:1.5b")

MEMORY_ENABLED = env_bool("LANGGRAPH_MEMORY_ENABLED", True)
MEMORY_SEARCH_URL = os.getenv("LANGGRAPH_MEMORY_SEARCH_URL", "")
MEMORY_API_KEY = os.getenv("LANGGRAPH_MEMORY_API_KEY", "")
MEMORY_SEARCH_LIMIT = int(os.getenv("LANGGRAPH_MEMORY_SEARCH_LIMIT", "5"))

COLLECTOR_ENABLED = env_bool("LANGGRAPH_COLLECTOR_ENABLED", True)
COLLECTOR_URL = os.getenv("LANGGRAPH_COLLECTOR_URL", "")
COLLECTOR_API_KEY = os.getenv("LANGGRAPH_COLLECTOR_API_KEY", "")

AUTOMATION_ENABLED = env_bool("LANGGRAPH_AUTOMATION_ENABLED", False)
AUTOMATION_WEBHOOK_URL = os.getenv("LANGGRAPH_AUTOMATION_WEBHOOK_URL", "")
AUTOMATION_WEBHOOK_API_KEY = os.getenv("LANGGRAPH_AUTOMATION_WEBHOOK_API_KEY", "")

REQUIRE_HUMAN_APPROVAL_FOR_HIGH_RISK = env_bool("LANGGRAPH_REQUIRE_HUMAN_APPROVAL_FOR_HIGH_RISK", True)


class AgentRequest(BaseModel):
    type: str = Field(default="generic")
    source: str = Field(default="manual")
    severity: str = Field(default="medium")
    message: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    require_approval: Optional[bool] = None
    trigger_automation: bool = False
    record_to_collector: bool = False


class AgentState(TypedDict, total=False):
    run_id: str
    event: dict[str, Any]
    memory_query: str
    similar_context: list[dict[str, Any]]
    insight: dict[str, Any]
    action: dict[str, Any]
    automation_result: dict[str, Any]
    collector_result: dict[str, Any]
    warnings: list[str]


app = FastAPI(title=APP_NAME, version="1.0.0")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_api_key(x_api_key: Optional[str]) -> None:
    if not LANGGRAPH_API_KEY or x_api_key != LANGGRAPH_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def is_placeholder(value: Optional[str]) -> bool:
    if not value:
        return True
    return any(marker in value for marker in ["YOUR_", "PASTE_", "CHANGE_ME", "AUTO_GENERATE", "replace-with-"])


def normalize_openai_base_url(url: str) -> str:
    return url.rstrip("/").removesuffix("/v1")


def safe_json_from_text(text: str) -> Optional[dict[str, Any]]:
    cleaned = re.sub(r"<think>.*?</think>", "", text.strip(), flags=re.DOTALL).strip()
    cleaned = re.sub(r"^```(?:json)?|```$", "", cleaned, flags=re.MULTILINE).strip()

    try:
        value = json.loads(cleaned)
        return value if isinstance(value, dict) else None
    except Exception:
        pass

    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if not match:
        return None

    try:
        value = json.loads(match.group(0))
        return value if isinstance(value, dict) else None
    except Exception:
        return None


def fallback_insight(event: dict[str, Any], reason: str) -> dict[str, Any]:
    severity = str(event.get("severity") or "medium").lower()
    event_type = str(event.get("type") or "generic").lower()
    message = str(event.get("message") or "")
    text = message.lower()

    priority = "medium"
    if severity in {"critical", "high"} or any(word in text for word in ["down", "failed", "error", "incident", "outage"]):
        priority = "high"
    if severity == "low":
        priority = "low"

    if event_type == "incident":
        category = "Incident Response"
        action = "Investigate recent errors, compare with similar incidents, and notify the team."
    elif event_type == "support":
        category = "Support Triage"
        action = "Draft a concise support reply and check similar previous tickets."
    elif event_type == "onboarding":
        category = "Startup Onboarding"
        action = "Classify the lead and recommend a tailored onboarding path."
    elif event_type == "product_signal":
        category = "Product Intelligence"
        action = "Look for repeated patterns and recommend a product improvement."
    else:
        category = "General Operations"
        action = "Summarize the event, check memory, and recommend the next operational step."

    return {
        "category": category,
        "priority": priority,
        "sentiment": "negative" if priority == "high" else "neutral",
        "summary": message[:280] if message else "No message provided.",
        "recommended_action": action,
        "risk_level": "high" if priority == "high" else priority,
        "requires_human_approval": priority == "high" and REQUIRE_HUMAN_APPROVAL_FOR_HIGH_RISK,
        "confidence": 0.45,
        "fallback": True,
        "fallback_reason": reason,
    }


def repaired_insight_from_text(event: dict[str, Any], raw: str, reason: str) -> dict[str, Any]:
    insight = fallback_insight(event, reason)
    text = raw.strip()
    lowered = text.lower()

    if "critical" in lowered:
        insight["priority"] = "critical"
        insight["risk_level"] = "high"
    elif "high" in lowered:
        insight["priority"] = "high"
        insight["risk_level"] = "high"
    elif "low" in lowered:
        insight["priority"] = "low"
        insight["risk_level"] = "low"

    if "positive" in lowered:
        insight["sentiment"] = "positive"
    elif "negative" in lowered or "cannot" in lowered or "failed" in lowered:
        insight["sentiment"] = "negative"

    recommendation_match = re.search(r"(?:recommendation|recommended action|next step)\s*:\s*(.+)", text, flags=re.IGNORECASE)
    if recommendation_match:
        insight["recommended_action"] = recommendation_match.group(1).strip().split("\n")[0][:500]

    insight["fallback"] = False
    insight["repaired_from_text"] = True
    insight["fallback_reason"] = reason
    insight["ai_raw"] = raw[:2000]
    return insight


def clean_choice(value: Any, allowed: set[str], fallback: str) -> str:
    text = str(value or "").strip().lower()
    if "|" in text or "," in text:
        return fallback
    for item in sorted(allowed, key=len, reverse=True):
        if item in text:
            return item
    return fallback


def clean_bool(value: Any, fallback: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in {"1", "true", "yes", "on"}
    return fallback


def clean_insight(event: dict[str, Any], parsed: dict[str, Any]) -> dict[str, Any]:
    fallback = fallback_insight(event, "defaults")
    priority = clean_choice(parsed.get("priority"), {"low", "medium", "high", "critical"}, fallback["priority"])
    risk_level = clean_choice(parsed.get("risk_level"), {"low", "medium", "high"}, fallback["risk_level"])
    sentiment = clean_choice(parsed.get("sentiment"), {"negative", "neutral", "positive"}, fallback["sentiment"])
    approval_value = parsed.get("requires_human_approval", parsed.get("requires_humanApproval"))

    if str(event.get("severity", "")).lower() in {"critical", "high"} and REQUIRE_HUMAN_APPROVAL_FOR_HIGH_RISK:
        requires_approval = True
    else:
        requires_approval = clean_bool(approval_value, bool(fallback["requires_human_approval"]))

    category = str(parsed.get("category") or fallback["category"]).strip()
    if "|" in category or len(category) > 120:
        category = fallback["category"]

    return {
        "category": category,
        "priority": priority,
        "sentiment": sentiment,
        "summary": str(parsed.get("summary") or fallback["summary"])[:500],
        "recommended_action": str(parsed.get("recommended_action") or fallback["recommended_action"])[:500],
        "risk_level": "high" if priority in {"high", "critical"} else risk_level,
        "requires_human_approval": requires_approval,
        "confidence": float(parsed.get("confidence") or 0.7),
        "fallback": False,
        "ai_provider": AI_PROVIDER,
        "ai_model": OLLAMA_MODEL if AI_PROVIDER == "ollama" else AI_MODEL,
    }


async def search_memory(state: AgentState) -> AgentState:
    state.setdefault("warnings", [])
    event = state["event"]
    query = state.get("memory_query") or f"{event.get('type')} {event.get('source')} {event.get('severity')} {event.get('message')}"
    state["memory_query"] = query

    if not MEMORY_ENABLED:
        state["similar_context"] = []
        return state

    if is_placeholder(MEMORY_SEARCH_URL) or is_placeholder(MEMORY_API_KEY):
        state["similar_context"] = []
        state["warnings"].append("Memory is enabled but memory search config is missing.")
        return state

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                MEMORY_SEARCH_URL,
                headers={"X-API-Key": MEMORY_API_KEY, "Content-Type": "application/json"},
                json={"query": query, "limit": MEMORY_SEARCH_LIMIT},
            )
        if response.status_code >= 400:
            state["warnings"].append(f"Memory search failed: HTTP {response.status_code} {response.text[:300]}")
            state["similar_context"] = []
            return state

        data = response.json()
        state["similar_context"] = data.get("items") or data.get("results") or data.get("points") or data.get("matches") or []
    except Exception as exc:
        state["warnings"].append(f"Memory search error: {exc}")
        state["similar_context"] = []

    return state


async def call_model(event: dict[str, Any], similar_context: list[dict[str, Any]]) -> dict[str, Any]:
    if not AI_ENABLED:
        return fallback_insight(event, "LANGGRAPH_AI_ENABLED=false")

    system = (
        "You are the AI operations workflow brain for reduOS, an AI operating system for startups. "
        "Analyze startup operations events, use similar context when useful, and return valid JSON only. "
        "Prefer safe human approval for high-risk actions. "
        "Do not write markdown, explanations, headings, or step-by-step text. "
        "Your entire response must be one JSON object."
    )
    user = {
        "task": "Analyze this startup operations event and recommend the next step.",
        "event": event,
        "similar_context": similar_context[:5],
        "required_json_schema": {
            "category": "Incident Response | Support Triage | Startup Onboarding | Product Intelligence | General Operations",
            "priority": "low | medium | high | critical",
            "sentiment": "negative | neutral | positive",
            "summary": "short operational summary",
            "recommended_action": "specific next step",
            "risk_level": "low | medium | high",
            "requires_human_approval": True,
            "confidence": 0.0,
        },
        "output_rules": [
            "Return exactly one JSON object.",
            "Do not wrap it in markdown.",
            "Do not include analysis text before or after the JSON.",
        ],
    }

    try:
        if AI_PROVIDER == "ollama":
            if is_placeholder(OLLAMA_URL):
                return fallback_insight(event, "OLLAMA_URL is empty or placeholder")

            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(
                    f"{OLLAMA_URL.rstrip('/')}/api/chat",
                    json={
                        "model": OLLAMA_MODEL,
                        "stream": False,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
                        ],
                    },
                )
            if response.status_code >= 400:
                return fallback_insight(event, f"Ollama HTTP {response.status_code}: {response.text[:200]}")
            data = response.json()
            raw = data.get("message", {}).get("content") or data.get("response") or ""
        else:
            if is_placeholder(AI_BASE_URL):
                return fallback_insight(event, "LANGGRAPH_AI_BASE_URL is empty or placeholder")

            headers = {"Content-Type": "application/json"}
            if AI_API_KEY:
                headers["Authorization"] = f"Bearer {AI_API_KEY}"

            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(
                    f"{normalize_openai_base_url(AI_BASE_URL)}/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": AI_MODEL,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
                        ],
                        "temperature": 0.2,
                    },
                )
            if response.status_code >= 400:
                return fallback_insight(event, f"{AI_PROVIDER} HTTP {response.status_code}: {response.text[:200]}")
            data = response.json()
            choice = (data.get("choices") or [{}])[0]
            raw = choice.get("message", {}).get("content") or choice.get("text") or ""

        parsed = safe_json_from_text(raw)
        if not parsed:
            return repaired_insight_from_text(event, raw, "Model did not return parseable JSON")

        return clean_insight(event, parsed)
    except Exception as exc:
        return fallback_insight(event, f"{AI_PROVIDER} error: {exc}")


async def analyze_event(state: AgentState) -> AgentState:
    state["insight"] = await call_model(state["event"], state.get("similar_context", []))
    return state


async def decide_action(state: AgentState) -> AgentState:
    event = state["event"]
    insight = state["insight"]
    requested_approval = event.get("require_approval")

    requires_approval = bool(insight.get("requires_human_approval"))
    if requested_approval is not None:
        requires_approval = bool(requested_approval)

    status = "pending_approval" if requires_approval else "recommended"
    if event.get("trigger_automation") and not requires_approval:
        status = "ready_for_automation"

    state["action"] = {
        "id": str(uuid.uuid4()),
        "status": status,
        "action_type": "automation" if event.get("trigger_automation") else "recommendation",
        "target": "automation_webhook" if event.get("trigger_automation") else "human_operator",
        "recommended_action": insight.get("recommended_action"),
        "requires_human_approval": requires_approval,
        "created_at": now_iso(),
    }
    return state


async def maybe_trigger_automation(state: AgentState) -> AgentState:
    event = state["event"]
    action = state["action"]

    if not event.get("trigger_automation"):
        state["automation_result"] = {"skipped": True, "reason": "trigger_automation=false"}
        return state

    if action.get("requires_human_approval"):
        state["automation_result"] = {"skipped": True, "reason": "human_approval_required"}
        return state

    if not AUTOMATION_ENABLED or is_placeholder(AUTOMATION_WEBHOOK_URL):
        state["automation_result"] = {"skipped": True, "reason": "automation disabled or webhook missing"}
        return state

    headers = {"Content-Type": "application/json"}
    if AUTOMATION_WEBHOOK_API_KEY:
        headers["X-API-Key"] = AUTOMATION_WEBHOOK_API_KEY

    payload = {
        "run_id": state["run_id"],
        "event": event,
        "insight": state["insight"],
        "action": action,
        "similar_context": state.get("similar_context", []),
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(AUTOMATION_WEBHOOK_URL, headers=headers, json=payload)
        state["automation_result"] = {
            "ok": response.status_code < 400,
            "status": response.status_code,
            "body": response.text[:1000],
        }
    except Exception as exc:
        state["automation_result"] = {"ok": False, "error": str(exc)}

    return state


async def maybe_record_to_collector(state: AgentState) -> AgentState:
    event = state["event"]

    if not event.get("record_to_collector"):
        state["collector_result"] = {"skipped": True, "reason": "record_to_collector=false"}
        return state

    if not COLLECTOR_ENABLED or is_placeholder(COLLECTOR_URL) or is_placeholder(COLLECTOR_API_KEY):
        state["collector_result"] = {"skipped": True, "reason": "collector disabled or config missing"}
        return state

    user = {}
    if event.get("user_email"):
        user["email"] = event.get("user_email")
    if event.get("user_name"):
        user["name"] = event.get("user_name")

    payload = {
        "type": event.get("type", "generic"),
        "source": "langgraph",
        "severity": event.get("severity", "medium"),
        "message": event.get("message", ""),
        "user": user or None,
        "metadata": {
            **(event.get("metadata") or {}),
            "langgraph_run_id": state["run_id"],
            "langgraph_insight": state.get("insight"),
            "langgraph_action": state.get("action"),
        },
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{COLLECTOR_URL.rstrip('/')}/v1/events",
                headers={"X-API-Key": COLLECTOR_API_KEY, "Content-Type": "application/json"},
                json=payload,
            )
        state["collector_result"] = {
            "ok": response.status_code < 400,
            "status": response.status_code,
            "body": response.text[:1000],
        }
    except Exception as exc:
        state["collector_result"] = {"ok": False, "error": str(exc)}

    return state


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("search_memory", search_memory)
    graph.add_node("analyze_event", analyze_event)
    graph.add_node("decide_action", decide_action)
    graph.add_node("maybe_trigger_automation", maybe_trigger_automation)
    graph.add_node("maybe_record_to_collector", maybe_record_to_collector)
    graph.set_entry_point("search_memory")
    graph.add_edge("search_memory", "analyze_event")
    graph.add_edge("analyze_event", "decide_action")
    graph.add_edge("decide_action", "maybe_trigger_automation")
    graph.add_edge("maybe_trigger_automation", "maybe_record_to_collector")
    graph.add_edge("maybe_record_to_collector", END)
    return graph.compile()


compiled_graph = build_graph()


@app.get("/")
async def root():
    return {
        "ok": True,
        "service": APP_NAME,
        "description": "LangGraph agent workflow engine for reduOS.",
        "endpoints": {
            "health": "GET /health",
            "invoke": "POST /v1/graph/invoke",
            "incident": "POST /v1/agents/incident",
            "support": "POST /v1/agents/support",
            "onboarding": "POST /v1/agents/onboarding",
            "product_signal": "POST /v1/agents/product-signal",
        },
        "ai_enabled": AI_ENABLED,
        "ai_provider": AI_PROVIDER,
        "memory_enabled": MEMORY_ENABLED,
        "collector_enabled": COLLECTOR_ENABLED,
        "automation_enabled": AUTOMATION_ENABLED,
    }


@app.get("/health")
async def health():
    return {
        "ok": True,
        "service": "langgraph-agent",
        "time": now_iso(),
        "langgraph": "ready",
        "ai_enabled": AI_ENABLED,
        "ai_provider": AI_PROVIDER,
        "ai_base_url_configured": bool(AI_BASE_URL) and not is_placeholder(AI_BASE_URL),
        "ollama_url_configured": bool(OLLAMA_URL) and not is_placeholder(OLLAMA_URL),
        "memory_enabled": MEMORY_ENABLED,
        "memory_search_configured": bool(MEMORY_SEARCH_URL) and not is_placeholder(MEMORY_SEARCH_URL),
        "collector_enabled": COLLECTOR_ENABLED,
    }


async def run_agent(payload: AgentRequest) -> dict[str, Any]:
    run_id = str(uuid.uuid4())
    event = payload.model_dump()
    event["received_at"] = now_iso()
    state: AgentState = {
        "run_id": run_id,
        "event": event,
        "warnings": [],
    }
    result = await compiled_graph.ainvoke(state)
    return {
        "ok": True,
        "run_id": run_id,
        "event": event,
        "similar_context": result.get("similar_context", []),
        "insight": result.get("insight", {}),
        "action": result.get("action", {}),
        "automation_result": result.get("automation_result", {}),
        "collector_result": result.get("collector_result", {}),
        "warnings": result.get("warnings", []),
    }


@app.post("/v1/graph/invoke")
async def invoke(payload: AgentRequest, x_api_key: Optional[str] = Header(default=None)):
    require_api_key(x_api_key)
    return await run_agent(payload)


@app.post("/v1/agents/incident")
async def incident(payload: AgentRequest, x_api_key: Optional[str] = Header(default=None)):
    require_api_key(x_api_key)
    payload.type = "incident"
    payload.severity = payload.severity or "high"
    return await run_agent(payload)


@app.post("/v1/agents/support")
async def support(payload: AgentRequest, x_api_key: Optional[str] = Header(default=None)):
    require_api_key(x_api_key)
    payload.type = "support"
    return await run_agent(payload)


@app.post("/v1/agents/onboarding")
async def onboarding(payload: AgentRequest, x_api_key: Optional[str] = Header(default=None)):
    require_api_key(x_api_key)
    payload.type = "onboarding"
    return await run_agent(payload)


@app.post("/v1/agents/product-signal")
async def product_signal(payload: AgentRequest, x_api_key: Optional[str] = Header(default=None)):
    require_api_key(x_api_key)
    payload.type = "product_signal"
    return await run_agent(payload)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return {
        "ok": False,
        "error": str(exc),
        "path": str(request.url.path),
    }
