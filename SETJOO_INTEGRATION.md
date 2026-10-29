# Setjoo Identity OIDC integration

This document covers the technical integration between this fork and
Setjoo's own identity provider — why it's built this way, how it works,
and the real bugs found and fixed while standing it up. For branding
changes, see [WHITELABEL.md](./WHITELABEL.md).

No infrastructure details (server addresses, credentials, internal
network topology) are included here on purpose — this is a public
repository. See Setjoo's private internal documentation for that.

## Why a first-party provider, not a community patch

Plane's self-hosted OIDC support is paywalled (moved behind a paid tier
in Plane v2; was free in v1). The community patches that exist to work
around this (`torbenraab/plane` and forks of it, referenced by
[PR #3341](https://github.com/makeplane/plane/pull/3341)) are ~2 years
stale, built against Plane's pre-rearchitecture codebase, and were
explicitly declined by Plane's own maintainers — partly over the security
surface of a fully admin-configurable "any OIDC provider" panel.

Instead, this fork adds **one new, narrowly-scoped first-party provider**
modeled directly on Plane's own existing `provider/oauth/{google,github,
gitlab,gitea}.py` pattern — hardcoded to Setjoo Identity's one issuer,
not a generic configurable integration. That's a smaller, more auditable
security surface than either the declined upstream PR or a generic OIDC
admin panel would be.

## How it works

Setjoo Identity is a custom-built OIDC provider: authorization_code +
PKCE (S256-only, mandatory), RS256-signed JWTs via real JWKS, standard
`sub`/`email`/`name`/`preferred_username`/`picture` claims. Critically,
it is **public-client-only** — `token_endpoint_auth_methods_supported:
["none"]`, no `client_secret` concept exists anywhere in its OAuth flow.

New files, all under `apps/api/plane/authentication/`:
- `provider/oauth/setjoo.py` — `SetjooOAuthProvider`, builds the
  authorize URL (with PKCE challenge), exchanges the code for tokens
  (with the PKCE verifier, no secret), calls userinfo.
- `utils/pkce.py` — RFC 7636 S256 verifier/challenge generation
  (`secrets.token_urlsafe(64)`, no existing PKCE support in this
  codebase to reuse).
- `views/app/setjoo.py` — initiate (generates state + PKCE pair, stores
  in session) and callback (validates state, exchanges code, clears the
  one-time PKCE verifier from session after use).

One deliberate architectural difference from every other provider in
this codebase: Setjoo Identity's `redirect_uri` contract is fixed
server-side to `{origin}/oauth/callback` (no trailing slash, no per-app
override), not the `/auth/<provider>/callback/` convention Google/
GitHub/GitLab/Gitea all use here. That required a **top-level** route in
`plane/urls.py` (not nested under `/auth/`) and a matching Caddy proxy
rule (see bugs below).

Bot/deactivated-account checks, avatar-download SSRF protection, and
open-redirect protection are all inherited for free from the existing
shared `Adapter.complete_login_or_signup()` / `path_validator.py` — none
of that was reimplemented, only reused.

**Known, accepted gap**: Setjoo Identity's userinfo response has no
`email_verified` claim to gate on (unlike this codebase's existing
Google provider, which does check one). Accepted because Setjoo Identity
is the same authoritative identity source every other Setjoo application
already trusts directly — not a third-party IdP where a spoofed claim is
a meaningful risk.

## Real bugs found and fixed

Each of these was caught only by actually driving a real login through
the real deployment — not by a shallower "does the page return 200"
check. Worth reading if you're debugging a similar self-hosted OIDC setup
behind a reverse-proxy chain.

### 1. Proxy never routed `/oauth/callback` to the API at all

Caddy's proxy config (`apps/proxy/Caddyfile.ce`) only forwarded specific
path prefixes (`/api/*`, `/auth/*`, `/static/*`, etc.) to the Django
`api` service. `/oauth/callback` matched none of them and silently fell
through to the `web:3000` catch-all — returning the SPA shell with
**`200 OK`**, not an error, so this looked like success from the outside.
Fixed with one `reverse_proxy /oauth/callback api:8000` line.

### 2. Docker build cache silently kept a stale value baked in

After changing a build-time environment value and running a normal
`docker compose build admin`, the `web` and `space` images picked up the
new value correctly but `admin` didn't — same batch, same Dockerfile
pattern, different result. Root cause not fully diagnosed (a Docker
layer-cache quirk, most likely turbo's pruned build context not
invalidating consistently). Fixed with `docker compose build --no-cache
admin`. **Lesson**: verify a rebuild actually worked by extracting and
grepping the built JS output for the expected value — don't trust image
timestamps alone.

### 3. OIDC issuer pointed at an address only reachable server-to-server

During integration testing, `SETJOO_IDENTITY_ISSUER` was set to an
internal-only address for speed and test isolation. That value gets used
for **two** different things in `provider/oauth/setjoo.py`: the
backend's server-to-server token/userinfo calls (fine, internal-only is
actually preferable there), *and* the browser-facing authorize-URL
redirect (not fine — no real user's browser can reach an internal-only
address). A login that worked perfectly in every test broke for the
first real user. Fixed by pointing the issuer at Setjoo Identity's real
public HTTPS origin, which resolves both correctly since it's genuinely
public.

### 4. Reverse-proxy chain silently downgraded every redirect_uri to `http://`

The deployment sits behind two proxy hops: an edge proxy terminates TLS
and forwards to Caddy over plain HTTP; Caddy then forwards to the Django
`api` container. Caddy's `reverse_proxy` directive **sets its own
`X-Forwarded-Proto` header from its own connection scheme by default**
(always `http`, since it only ever receives plain HTTP from the edge
proxy) — silently overwriting whatever the edge proxy originally set,
even with Caddy's `trusted_proxies` option configured (that setting
affects Caddy's own client-IP resolution, not what it forwards
downstream). Result: Django's `request.is_secure()` always came back
`False`, so every OAuth `redirect_uri` this fork generated was
`http://...` instead of `https://...` — which Setjoo Identity's
exact-string `redirect_uri` match then correctly rejected. Fixed with
explicit `header_up X-Forwarded-Proto https` on every `reverse_proxy`
route in the Caddyfile. Safe to hardcode here specifically because this
proxy genuinely never receives anything but plain HTTP from the edge
proxy in front of it, which itself force-redirects `http`→`https` before
anything reaches here — this is not a blind "trust the client" shortcut.

## Known gaps

- **Not a visible app-launcher tile yet.** Setjoo's main identity/business
  application has its own app-launcher grid; wiring this app in as a
  clickable tile there (rather than requiring the direct URL) is tracked
  separately, outside this repository.
- **Telemetry.** Plane's self-hosted instance telemetry push
  (`telemetry.plane.so`) is disabled via the `is_telemetry_enabled`
  instance flag (the actual gate the code checks), not a code change —
  see `apps/api/plane/license/bgtasks/telemetry_metrics.py`.
