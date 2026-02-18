"""
LangChain integration for memstamp — automatic stamping of chain events
"""

from typing import Any, Optional

from memstamp.client import MemstampClient


class MemstampCallbackHandler:
    """
    LangChain callback handler that stamps events to memstamp.
    
    Example:
        >>> from memstamp.integrations.langchain import MemstampCallbackHandler
        >>> handler = MemstampCallbackHandler(
        ...     api_key="ms_live_xxx",
        ...     agent_id="my-langchain-agent"
        ... )
        >>> chain.invoke(input, callbacks=[handler])
    """

    def __init__(
        self,
        api_key: str,
        agent_id: str,
        base_url: str = "https://api.memstamp.io",
        stamp_on: Optional[list[str]] = None,
    ):
        self.client = MemstampClient(api_key=api_key, base_url=base_url)
        self.agent_id = agent_id
        self.stamp_on = stamp_on or [
            "on_llm_start",
            "on_llm_end",
            "on_tool_start",
            "on_tool_end",
            "on_chain_start",
            "on_chain_end",
        ]

    def on_llm_start(self, serialized: dict, prompts: list[str], **kwargs):
        """Stamp LLM invocation start."""
        if "on_llm_start" in self.stamp_on:
            self.client.stamp(
                agent_id=self.agent_id,
                event_type="tool_call",
                content={"type": "llm_start", "prompts": prompts},
                framework="langchain",
            )

    def on_llm_end(self, response: Any, **kwargs):
        """Stamp LLM invocation end."""
        if "on_llm_end" in self.stamp_on:
            self.client.stamp(
                agent_id=self.agent_id,
                event_type="tool_result",
                content={"type": "llm_end", "response": str(response)},
                framework="langchain",
            )

    def on_tool_start(self, serialized: dict, input_str: str, **kwargs):
        """Stamp tool invocation start."""
        if "on_tool_start" in self.stamp_on:
            self.client.stamp(
                agent_id=self.agent_id,
                event_type="tool_call",
                content={
                    "type": "tool_start",
                    "tool": serialized.get("name"),
                    "input": input_str,
                },
                framework="langchain",
            )

    def on_tool_end(self, output: str, **kwargs):
        """Stamp tool invocation end."""
        if "on_tool_end" in self.stamp_on:
            self.client.stamp(
                agent_id=self.agent_id,
                event_type="tool_result",
                content={"type": "tool_end", "output": output},
                framework="langchain",
            )

    def on_chain_start(self, serialized: dict, inputs: dict, **kwargs):
        """Stamp chain start."""
        if "on_chain_start" in self.stamp_on:
            self.client.stamp(
                agent_id=self.agent_id,
                event_type="state_change",
                content={
                    "type": "chain_start",
                    "chain": serialized.get("name"),
                    "inputs": inputs,
                },
                framework="langchain",
            )

    def on_chain_end(self, outputs: dict, **kwargs):
        """Stamp chain end."""
        if "on_chain_end" in self.stamp_on:
            self.client.stamp(
                agent_id=self.agent_id,
                event_type="state_change",
                content={"type": "chain_end", "outputs": outputs},
                framework="langchain",
            )
