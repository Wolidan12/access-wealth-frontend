# Backend Prompts — Access Wealth Brand Revert (Deep Blue & Gold)

Frontend reverted to the **previous-previous color scheme** (deep blue & gold).
Use the prompts below with the backend repo/agent to keep everything in sync.

## Restored brand palette (the source of truth)

| Token | Value | Used for |
|---|---|---|
| Page background (dark) | `#070d14` / `#0a1425` | body, app background |
| Secondary background | `#0f1d33` | sections, footers |
| Card / surface | `#112A46` | cards, panels, modals |
| Primary gold | `#d4af37` | buttons, highlights, icons, active states |
| Deep gold | `#b8860b` | gold gradients, hover states |
| Bright gold | `#ffd700` | crowns, badges, special accents |
| Main text | `#ffffff` | headings, body text on dark |
| Muted text | `#8a99af` | subtitles, placeholders, secondary text |
| Borders | `rgba(212, 175, 55, 0.15)` | gold-tinted card/input borders |
| Accent blues | `#1a4a8a`, `#0f2b5c`, `#15273f` | links, info surfaces, gradients |
| Success green | `#2ecc71` | approve/active statuses |
| Avatar default | `background=d4af37&color=112A46` | gold bg, deep-blue initials |
| Light theme (dashboard toggle) | bg `#edf5ff`, cards `#ffffff`, gold `#b77d0b`, text `#102340` | optional light mode |

Backend: `https://access-wealth-backend-production.up.railway.app/api` — **host and all API contracts are unchanged.**

---

## Prompt 1 — Rebrand backend-rendered templates (main one)

> The Access Wealth frontend has reverted its entire color scheme to the original deep blue & gold brand theme. Audit every backend-rendered or backend-sent visual surface — transactional email templates (welcome, email verification, password reset, deposit approved/declined, withdrawal approved/declined, plan activation, support replies), plus any server-rendered HTML pages, receipt/invoice views, and notification/HTML popups — and restyle them to this exact palette: page background `#070d14` (or white `#f5f9ff` for light email wrappers where dark email is impractical), card/panel background `#112A46`, primary gold `#d4af37` with deep-gold gradient `#b8860b`, heading/body text `#ffffff`, muted text `#8a99af`, borders `rgba(212,175,55,0.15)`. Remove every leftover style from the last two themes — pure-white backgrounds, navy `#061733`/`#0a2854` surfaces, electric blue `#087dcc`/`#078de9` buttons — so nothing from the white/navy palette remains. Keep the gold call-to-action buttons with dark text `#0b1421` for contrast.

## Prompt 2 — Match generated/default avatars

> If the backend generates default user avatars (e.g. via ui-avatars.com or an internal generator), make them match the frontend: gold background `#d4af37` with deep-blue text `#112A46` — i.e. `https://ui-avatars.com/api/?name={username}&background=d4af37&color=112A46&bold=true`. Replace any avatars still generated with white, navy, or electric-blue backgrounds.

## Prompt 3 — Check for theme/branding config served by the API

> Check whether any backend endpoint (e.g. `/api/settings`, `/api/config`, `/api/branding`, app bootstrap responses) returns colors, CSS variables, logo URLs, or theme flags to the frontend. If yes, either update the returned values to the restored palette (gold `#d4af37` on deep blue `#112A46`, dark background `#070d14`) or remove the color fields entirely so the frontend CSS is the single source of truth for theming. Confirm no endpoint response contains inline HTML with hex colors from the old white/navy theme.

## Prompt 4 — Confirm API contracts stay unchanged

> The color revert was frontend CSS only — no API changes were made. Do not rename, remove, or reshape any existing endpoint or response field (`/api/login`, `/api/register`, `/api/refresh-token`, `/api/user/:username`, deposits, withdrawals, plans/packages, tasks, referrals, admin actions, support). Just verify everything still works end-to-end after your template/config updates, and keep CORS configured for the frontend domain exactly as it is now.

## Prompt 5 — Invoice & PDF styling

> If the backend generates invoices, payment receipts, or statements (HTML or PDF), restyle them to the restored brand: deep-blue header band `#112A46` (or `#0f1d33`), gold accent `#d4af37` for headings, totals and dividers, dark text `#0b1421` only on gold/white areas, and the Access Wealth logo. Apply the gold status colors: approved/completed `#2ecc71`, pending `#d4af37`, declined/failed `#e74c3c`.

---

### Quick verification checklist for the backend after changes
- [ ] Welcome + password reset emails render gold-on-deep-blue
- [ ] Approval/decline emails use `#2ecc71` / `#e74c3c` correctly
- [ ] Default avatars use `d4af37` background
- [ ] No API endpoint returns hex colors from the white/navy theme
- [ ] All existing endpoints respond unchanged (contract test / smoke test)
