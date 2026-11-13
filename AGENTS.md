# Standalone architecture
- Use React/TanStack Router for the browser and Express server functions for private logic; all persisted application data lives in MySQL. Why: independent VPS deployment.
- Enforce tenant ownership and active subscription checks at the server data layer; Super Admin checks precede cross-account reads. Why: account isolation.
- Store extension progress in account-bound chrome.storage.local checkpoints and use at-least-once upload replay with CRM deduplication. Why: MV3 interruption recovery.
- Keep activity logs append-only through the API and generate row activity with MySQL triggers, without row payloads or secrets. Why: protected operational history.
- Keep the built-in local writer in server/local-writer.js and require no external generation credentials. Why: independent email generation.
