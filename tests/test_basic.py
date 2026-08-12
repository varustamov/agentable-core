"""Basic smoke tests for agentable-core."""
from agentable import audit_url, AuditResult


def test_audit_result_fields():
    result = AuditResult(url="https://example.com", level=2, score=8, max_score=24, checks=[])
    assert result.url == "https://example.com"
    assert result.level == 2
    assert 0 <= result.score <= result.max_score


def test_audit_url_returns_result():
    result = audit_url("https://example.com")
    assert isinstance(result, AuditResult)
    assert result.url == "https://example.com"
    assert result.level >= 0
    assert result.score >= 0
