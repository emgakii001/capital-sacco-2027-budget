# Capital SACCO — 2027 Budget Management System

First-delivery frontend: Login, application shell (sidebar + header), and a fully
polished Dashboard. Every other menu item (Budget sub-pages, Actuals, Performance,
Reports, Setup) is a real page showing the intended fields, Excel columns,
calculations and filters, clearly marked **Not yet connected** rather than faked.

## Stack

Plain HTML/CSS/JavaScript with ES modules — no build step. Libraries load from a
CDN, pinned to exact versions:

- `@supabase/supabase-js@2.116.0`
- `chart.js@4.5.1`

This is deliberate so the project can be served directly from GitHub Pages with
no build pipeline.

## Connecting to Supabase

1. Open `config.js`.
2. Replace `YOUR_SUPABASE_PROJECT_URL` with your Supabase project URL.
3. Replace `YOUR_SUPABASE_PUBLISHABLE_KEY` with your **publishable/anon** key
   (Project Settings → API in Supabase).
4. **Never** put your service-role/secret key here — this file is sent to every
   visitor's browser. Database security is enforced by Supabase Auth + Row
   Level Security, not by hiding this key.

Until `config.js` is filled in, the app runs in **walkthrough mode**: login
accepts any email/password locally (nothing is read or written anywhere), and
every screen shows its real empty/not-connected state. Turn on **Show demo
data** on the Dashboard to preview the layout with clearly labelled illustrative
figures — these are never written to Supabase.

## Deploying to GitHub Pages

Push this folder to a repository and enable GitHub Pages (Settings → Pages →
Deploy from branch → `/ (root)`, or a `docs/` folder if you prefer — adjust the
branch/path setting to match wherever you place these files). No build step is
required.

## Project structure

```
index.html            Entry point
config.js             Supabase URL + publishable key (fill this in)
assets/               Capital SACCO logo (full banner + cropped emblem)
css/                  base.css (tokens), components.css, layout.css, pages.css
js/core/               config/auth/supabase-client/nav/icons/format helpers
js/components/        sidebar.js, header.js
js/pages/             login, dashboard, budget-overview, placeholder page engine
js/pages/route-configs.js   Field/column/formula definitions for every
                            not-yet-connected page — edit here first when a
                            section gets wired to Supabase
js/data/               branches.js (16 branches, months), demo.js (demo
                        figures), live.js (real Supabase queries for the
                        dashboard — the pattern to extend to other pages)
```

## What's next (see build-priority phases in the original brief)

Phase 3 onward: wire each Budget/Actuals/Performance/Reports/Setup page to
Supabase, following the same pattern used in `js/data/live.js` for the
Dashboard — read only the confirmed tables/columns, never invent a mapping,
and fall back to "Not yet connected" wherever the schema doesn't support a
figure yet (CAPEX funding being the current example).
