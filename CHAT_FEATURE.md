# Workspace chat (added feature, not a whitelabel change)

Stock Plane (`makeplane/plane`) has no team-messaging feature anywhere —
issue comments are per-work-item, not a shared channel, and the `apps/live`
Hocuspocus server is CRDT document co-editing only, never wired to any
chat/notification transport. This fork adds a minimal workspace-wide chat,
matching the scope of the feature the in-house Setjoo Projects build
already had before it was frozen in favor of this Plane deployment (see
`SETJOO_PROJECTS.md` in the main `setjoo` repo).

This is **new functionality**, not a rebrand — tracked separately from
`WHITELABEL.md` (branding-only) and `SETJOO_INTEGRATION.md` (OIDC-only).

## Scope (deliberately minimal)

One flat, shared message stream per workspace:

- No threads, reactions, edit, or @mentions.
- No per-project chat — workspace-wide only.
- All active workspace members, including guests, can read.
- Only admins/members can post; only a message's author can delete it.

## Why REST polling, not websockets

Plane has no usable realtime transport for this. Django Channels is listed
as a dependency but is completely unwired — no consumers, no channel
routing, the ASGI app only ever serves plain HTTP. `apps/live` is a
separate Node/Hocuspocus process purely for document CRDT sync, not a
general pub/sub layer, and isn't reachable from Django views anyway.
REST polling (same pattern the existing Notifications feature already
uses) is the correct, idiomatic approach here — the client polls
`GET /api/workspaces/<slug>/chat-messages/` every 5 seconds.

## What was added

**Backend** (`apps/api/plane/...`):

- `db/models/chat.py` — `ChatMessage` model (`BaseModel` subclass: UUID pk,
  `created_by`/`updated_by` auto-set via `crum`), `db_table = "chat_messages"`,
  indexed on `(workspace, created_at)`.
- `db/migrations/0123_chatmessage.py`
- `app/serializers/chat.py` — `ChatMessageSerializer`
- `app/views/workspace/chat.py` — `WorkspaceChatMessageViewSet`
  (list/create/destroy, permission-split as above)
- `app/urls/chat.py` — `workspaces/<slug>/chat-messages/[​<uuid:pk>/]`

**Frontend** (`apps/web/...` + `packages/types`):

- `packages/types/src/chat.ts` — `TChatMessage`
- `core/services/chat.service.ts` — `ChatService`
- `core/store/chat/chat.store.ts` — MobX `ChatStore`, registered on
  `CoreRootStore` as `chat`
- `core/hooks/store/use-chat.ts` — `useChat()`
- `core/components/chat/` — `root.tsx` (polling + list), `message-block.tsx`
  (avatar/name/relative-timestamp/hover-delete), `message-create.tsx` (plain
  `<textarea>`, Enter-to-submit — deliberately not Plane's Tiptap
  `LiteTextEditor`, which is overkill for one-line chat messages)
- `app/(all)/[workspaceSlug]/(projects)/chat/` — route (`layout.tsx`,
  `header.tsx`, `page.tsx`), registered in `app/routes/core.ts`
- Sidebar: added as an always-visible static nav item (next to Home) in
  `packages/constants/src/workspace.ts`, `sidebar-item.tsx`'s `staticItems`
  list, `sidebar/helper.tsx`'s icon switch, and the `sidebar.chat` i18n key
  in `packages/i18n/src/locales/en/navigation.json` (EN only — other 16
  locales not translated, same deferral pattern as the rest of this fork's
  i18n work).

## Real issue caught during deploy

The migration (`0123_chatmessage.py`) had been generated and applied
directly to production in the session that built the backend, but was
never actually `git add`ed into that commit — it only existed as an
untracked file on `sj-app-prod-01`. Caught on a second checkout of this
repo (file showed as untracked despite the model/viewset already being
committed). Committed separately; `python manage.py migrate` against it
is a no-op since the schema was already applied, content matches exactly.

## Verified

Full CRUD round-trip tested against the real production deployment
(`https://projects.setjoo.com/<workspace>/chat`) through a real logged-in
user session: `POST` → 201, 5s polling `GET`s firing, `DELETE` → 204,
UI correctly rendering author/avatar/relative time and returning to the
empty state after deletion.

## Known gaps / not done

- No edit, no reactions, no threads, no @mentions, no file attachments.
- Not translated beyond `en`.
- No websocket/push — 5s poll latency is the ceiling.
