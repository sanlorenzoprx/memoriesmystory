# Memories: My Story — Agent Examples

## Legacy Story Starter

Request:

```json
{
  "relationship": "grandmother",
  "occasion": "family reunion",
  "themes": ["childhood", "family traditions"],
  "language": "en",
  "time_available_minutes": 20,
  "prompt_count": 8
}
```

The response contains an opening question, deterministic questions, photo prompts, gentle follow-ups, a capture tip, and a human start URL.

The service does not infer the grandmother's name, birthplace, dates, relationships, or events.

## Spanish Story Starter

```json
{
  "relationship": "madre",
  "themes": ["old photographs", "recipes"],
  "language": "es",
  "prompt_count": 6
}
```

The returned prompts remain open-ended and permit uncertainty.

## Photo Story Prompts

```json
{
  "photo_context": "old family wedding photograph",
  "relationship": "mother",
  "language": "en",
  "prompt_count": 4
}
```

The public service treats `photo_context` as general caller context only. It never receives or inspects a private photograph.

## MCP

Use MCP revision `2026-07-28` with matching `MCP-Protocol-Version`, `Mcp-Method`, and, for `tools/call`, `Mcp-Name` headers.
