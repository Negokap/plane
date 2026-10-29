# Setjoo whitelabel notes

This fork (`github.com/Negokap/plane`, branch `setjoo-oidc`) is deployed as
**Setjoo Projects**. This file tracks every branding change made on top of
upstream `makeplane/plane`, so a future `git pull`/rebase against upstream
(or against the `setjoo-oidc` branch) doesn't silently clobber them, and so
anyone picking this up knows what's deliberate vs. what's just unmerged
upstream drift.

Brand source: `~/Developer/Negokap/setjoo/brand/wordmarks/setjoo.png`
(the Setjoo wordmark, red `#ED1C24` / charcoal `#231F20` split) and
`~/Developer/Negokap/setjoo/tailwind.config.ts` (color tokens, `Outfit`
font — font swap not done in this pass, see "Deferred" below).

## What was changed

**Central metadata** (`packages/constants/src/metadata.ts`,
`packages/constants/src/endpoints.ts`) — site name/title/description/
keywords/URL, `WEBSITE_URL` → `https://setjoo.com`, `SUPPORT_EMAIL` →
`support@setjoo.com`. These feed `apps/web/app/root.tsx`'s meta tags
directly; **`apps/admin` and `apps/space` do NOT consume this file** —
each has its own local `APP_TITLE`/`APP_DESCRIPTION` consts in their
`app/root.tsx`, edited separately.

**Brand color** (`packages/tailwind-config/variables.css`) — the entire
`--brand-100` … `--brand-1200` / `--brand-default` OKLCH ramp (both light
and dark `@media` blocks) replaced with a ramp generated from `#ED1C24`
(hue ≈27°), keeping the *lightness* steps and *relative chroma shape* of
the original ramp, scaled to the new hue/chroma. Generation script:
`/private/tmp/.../scratchpad/oklch_ramp.py` (local machine, not in this
repo) — rerun it if the base red ever changes. This feeds every primary
button, link, active-nav-item, etc. across all three apps automatically.
**Not changed**: several hardcoded `#3f76ff`/`#3579f6` occurrences outside
`variables.css` (PDF export styling, profile sidebar chart color, a
custom-theme-picker placeholder/default) — low-visibility, deferred.

**Logo** — `packages/propel/src/icons/brand/plane-logo.tsx` and
`plane-lockup.tsx` (the two shared components actually rendered in the UI
— sidebar, login/auth/onboarding screens) now render
`<img src="/setjoo-logo.png">` instead of inline Plane SVG paths. The
image is copied into each app's own `public/setjoo-logo.png` (`web`,
`admin`, `space`) rather than imported through the shared package, to
avoid cross-package Vite asset-bundling complexity — matches the existing
`client/public/setjoo-logo.png` convention in the main `setjoo` repo.
`plane-wordmark.tsx` (a third brand component) was left untouched — no
in-app consumers were found for it.

**Favicons** — regenerated from a cropped/centered "S" glyph (not the
full wordmark — a wide wordmark doesn't read at 16×16) for all three
apps' `app/assets/favicon/*` and `public/favicon/*` paths, plus `web`'s
extra `app/assets/icons/*`, `public/icons/*`, `public/plane-logos/
plane-mobile-pwa.png`, and `app/assets/og-image.png` (full wordmark on
white, 1200×630). Generation script used PIL locally — see git history
for the exact crop/pad parameters if regenerating.

**manifest.json / site.webmanifest files** — all 4 *active* ones (see
below) updated: `name`/`short_name` → "Setjoo Projects" (or "Setjoo
Projects Admin"), `theme_color` → `#ED1C24`. Two **dead/unreferenced**
manifest files were found by the branding audit and left untouched on
purpose (not worth editing code nobody loads):
`apps/web/manifest.json` (root, not `public/`) and
`apps/space/public/site.webmanifest.json` (space actually loads
`apps/space/app/assets/favicon/site.webmanifest` instead).

**Telemetry disabled** — not a code change: `instances.is_telemetry_enabled`
flipped to `false` directly in the `plane_app` Postgres database (the
Celery beat task in `apps/api/plane/license/bgtasks/telemetry_metrics.py`
checks this flag and no-ops if false — confirmed this is the only
telemetry.plane.so pusher in the codebase). Defense-in-depth: `OTLP_ENDPOINT`
env var also set to an inert local address in Plane's `apps/api/.env` on
`sj-app-prod-01`, in case the DB flag is ever flipped back on by mistake.

**Self-promotion UI removed** (all three return `null` now rather than
being deleted/rewired at every call site — simplest, lowest-risk way to
kill a component without hunting down every import):
- `apps/space/components/common/powered-by.tsx` — the "Powered by Plane
  Publish" floating badge on every published page.
- `apps/web/app/(all)/[workspaceSlug]/(projects)/star-us-link.tsx` — the
  in-app "Star us on GitHub" button (linked to `makeplane/plane`, not
  relevant to Setjoo users).
- `apps/web/core/components/auth-screens/footer.tsx` — the login page's
  "Join 10,000+ teams" strip with Zerodha/Sony/Dolby/Accenture client
  logos (Plane's own customer social proof, meaningless for a
  single-tenant Setjoo deployment).

## Second pass (2026-10-29, commit `64ac507`)

User specifically flagged the "Welcome back to Plane." login message
(missed by the first pass — that only fixed page titles/meta, never the
actual sign-in screen copy in `apps/web/core/components/account/
auth-forms/auth-header.tsx`) and asked for as thorough a sweep as
reasonable beyond that. This pass added: all 106 "Plane" occurrences in
the **EN i18n locale only** (`packages/i18n/src/locales/en/*.json` — the
other 17 locales were not touched, not reasonable to hand-translate), 55
more hardcoded strings across onboarding copy/admin OAuth-provider setup
forms/error pages/the telemetry consent toggle text found via a broader
non-quoted-string sweep, and the `docs.plane.so`/`forum.plane.so`/
`github.com/makeplane` links previously deferred below — those now
redirect to `support@setjoo.com` (bug reports, contact) or `setjoo.com`
(docs/forum/changelog, as a safe real fallback since no Setjoo-equivalent
page exists — not fabricating fake doc URLs). "Star us on GitHub" removed
entirely rather than redirected.

**New deferral found and NOT touched, on purpose**: Terms of Service /
Privacy Policy links (`apps/web/core/components/account/
terms-and-conditions.tsx`, `apps/space/components/account/
terms-and-conditions.tsx`) still point at Plane Software Inc.'s real legal
documents. Setjoo has no equivalent pages. Redirecting to a Setjoo URL
with no actual terms content, or fabricating placeholder legal text,
would be worse than leaving this alone — needs a real decision + real
content from Setjoo, not a mechanical find-replace.

Also left alone on purpose: `apps/web/core/components/workspace/billing/
comparison/plans.tsx` (Plane's own SaaS pricing-comparison page —
unreachable in a self-hosted deployment with no billing configured,
renaming would imply Setjoo sells tiers it doesn't); the
`intake@plane.so` check in `inbox-list-item.tsx` (a functional sentinel
value, not display text); and the ~20 `// Plane imports`-style code
comments found across the codebase (zero user-visible impact).

## Deliberately deferred (not in this pass)

Found by the branding audit but intentionally left as-is — flagging so
nobody assumes a full rebrand happened:

- **`MARKETING_PRICING_PAGE_LINK`/`MARKETING_CONTACT_US_PAGE_LINK`/
  `MARKETING_PLANE_ONE_PAGE_LINK`** (`packages/constants/src/endpoints.ts`)
  — billing/upgrade-page links, not touched.
- **Hardcoded `#3f76ff` outside `variables.css`** — PDF export styling,
  profile sidebar chart/legend color, custom-theme-picker placeholder —
  cosmetically minor, low visibility.
- **Font** — Setjoo's own apps use `Outfit`; Plane's apps still ship
  `Inter`/`IBM Plex Mono`/Material Symbols. Not swapped.
- **`packages/propel/src/icons/brand/plane-wordmark.tsx`** — third brand
  component, no in-app consumers found, left untouched.
- **package.json `"name"` fields**, copyright headers ("Plane Software,
  Inc."), root `README.md`/`LICENSE.txt`/`COPYRIGHT.txt` — internal/legal
  metadata, zero user-visible impact.
- **`app_projects` registry entry's `status`** is still `"coming"` in
  Setjoo Identity (not a Plane-fork file) — not a visible launcher tile
  yet. That's a Phase F cutover decision, not a whitelabel one.

## Regenerating assets

If the Setjoo brand mark ever changes: re-run the favicon/og-image
generation (PIL-based crop+resize, see this commit's description for the
exact parameters) against the new source, and re-run `oklch_ramp.py`
against the new primary hex if the brand color changes too.
