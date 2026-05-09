from __future__ import annotations
from functools import cache
from langchain_ollama import ChatOllama
from shared.config import LLM_MODEL, OLLAMA_BASE_URL

@cache
def get_llm(temperature: float = 0.1) -> ChatOllama:
    return ChatOllama(
        model = LLM_MODEL,
        base_url = OLLAMA_BASE_URL,
        temperature = temperature,
        keep_alive = "30m",
    )