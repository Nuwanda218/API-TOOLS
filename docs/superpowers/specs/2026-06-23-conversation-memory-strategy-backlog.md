# Conversation Memory Strategy Backlog

## Status

Deferred from API Tools v0.2 runtime implementation. This document records the design work required before memory behavior is added.

## Reason

Conversation memory affects session storage, adapter inputs, provider metadata, workflow traces, privacy, and UI behavior. Implementing one memory model before the project has a clear strategy would make future provider support harder.

## Candidate Strategies

### Local message replay

The system stores all messages locally and sends selected prior messages to `llm.chat` on each request.

### Remote conversation identifier

The system stores a provider-specific `remoteConversationId` or equivalent metadata when a provider exposes one.

### Summary memory

The system periodically summarizes old messages and sends the summary plus recent turns.

### Long-term structured memory

The system stores durable user/project facts outside individual sessions.

### Vector memory

The system embeds and retrieves relevant conversation fragments.

## Design Questions

- Which memory mode is the default for providers that expose only Chat Completions?
- How does the UI show what memory was used for a request?
- How are remote conversation identifiers stored without leaking provider-specific concepts into the core protocol?
- Which data is safe to store long term?
- How can a user clear local and remote memory?

## Phase Boundary

API Tools v0.2 may store ordinary messages and run traces, but it must not implement long-term memory, vector retrieval, summary memory, or provider-specific remote thread behavior.
