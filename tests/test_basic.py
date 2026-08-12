"""Basic smoke tests for agentable-core."""
from agentable import AgentableClient


def test_client_instantiates_without_token():
    client = AgentableClient()
    assert client.base_url == "https://seo4agent.com"
    assert isinstance(client._headers, dict)


def test_client_instantiates_with_token():
    client = AgentableClient(token="test-token-123")
    assert "Authorization" in client._headers
    assert client._headers["Authorization"] == "Bearer test-token-123"


def test_client_base_url_strips_trailing_slash():
    client = AgentableClient(base_url="https://example.com/")
    assert client.base_url == "https://example.com"
