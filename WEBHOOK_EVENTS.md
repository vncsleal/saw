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
  "confidence_band": "none|low|medium|high",
  "classification": "none|single|multiple",
  "rationale": "<string summary>"
}
```

### diff.response (log event now; webhook future)
Emitted after serving a diff subset.
Payload (log):
```
{ "since": "<ISO>", "changed": <int>, "removed": <int> }
```
Webhook (future) MAY add:
```
{ "since": "<ISO>", "changed": <int>, "removed": <int>, "signature_present": <boolean> }
```

### ingest.upsert (log event now; webhook future)
Emitted after a block upsert via /api/saw/ingest.
Payload:
```
{ "id": "block:...", "version": "vX" }
```

## Future (Not Yet Implemented)
- diff.response webhook (signature_present TBD)
- ingest.upsert webhook
- canary.detected confidence_band already present (Phase 4)

## Notes
These webhook schemas are stable for Phase 4 internal validation; external consumers should treat them as experimental until formally versioned.
