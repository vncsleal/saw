# Webhook Event Payloads (Phase 4)

This file standardizes webhook event names & payload schemas for the example server (reference only).

## Common Envelope (server implementation)
```
POST <SAW_DETECT_WEBHOOK>
{
  "ts": "<ISO timestamp>",
  "event": "<event name>",
  "payload": { ...event specific fields }
}
```

## Events

### feed.response
Emitted after a feed request is served.
Payload:
```
{ "items": <number>, "ephemeral": "c-..." }
```

### page.response
Emitted after the HTML page is served.
Payload:
```
{ "ephemeral": "c-..." }
```

### detect.request
Emitted after a detector API call.
Payload:
```
{ "tokens": <unique token count>, "matched": <mapped count>, "confidence": <0..1> }
```

### canary.detected
Emitted when at least one canary-like token is detected (after mapping) from /api/saw/detect.
Payload:
```
{
  "tokens": ["c-AAAA..."],
  "totalOccurrences": <int>,
  "matched": [ { "token": "c-...", "requestId": "feed-..." } ],
  "unknown": [ "c-..." ],
  "confidence": <0..1>,
  "classification": "none|single|multiple",
  "rationale": "<string summary>"
}
```

## Future (Not Yet Implemented)
- diff.response webhook
- ingest.upsert webhook

## Notes
These webhook schemas are stable for Phase 4 internal validation; external consumers should treat them as experimental until formally versioned.
