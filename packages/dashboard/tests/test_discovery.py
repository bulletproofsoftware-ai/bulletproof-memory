from discovery import categorize, validate_pg_identifier

CAT = {
    "groups": {
        "tiers": ["memories_hot", "memories_warm", "memories_cold", "claude_memories"],
        "knowledge": ["episodes", "learnings", "procedures", "trajectories", "heuristics"],
        "corpus": ["obsidian_docs", "file_search"],
    },
    "prefixes": {"clue_": "security", "nhi_": "agents"},
    "labels": {"claude_memories": "Long-Term Memories", "tg_sessions": "Telegram Sessions"},
}


def test_categorize_known_exact():
    assert categorize("memories_warm", CAT) == ("tiers", "Memories Warm")


def test_categorize_custom_label():
    assert categorize("claude_memories", CAT) == ("tiers", "Long-Term Memories")


def test_categorize_prefix():
    assert categorize("clue_golden_incidents", CAT) == ("security", "Clue Golden Incidents")


def test_categorize_unknown_falls_to_other():
    assert categorize("brand_new_collection", CAT) == ("other", "Brand New Collection")


def test_validate_pg_identifier_ok():
    assert validate_pg_identifier("session_transcripts") is True
    assert validate_pg_identifier("memory") is True


def test_validate_pg_identifier_rejects_injection():
    assert validate_pg_identifier("foo; DROP TABLE bar") is False
    assert validate_pg_identifier('a"b') is False
    assert validate_pg_identifier("") is False
