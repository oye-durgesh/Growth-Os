# Growth OS

A GTM / growth command center prototype. Pure static site: no build step, no backend.
All data is simulated (Wispr Flow India GTM demo + generated SaaS / B2B / E-commerce demos).
Connectors are simulated; CSV imports and workspaces are stored in your browser's localStorage.

## Run locally
    npx serve .        # then open http://localhost:3000

## Deploy on Vercel
Import the repo in Vercel. Framework preset: **Other**. Build command: none. Output directory: `.` (root).
Or with the CLI: `npx vercel --prod`.

## Layout
- `index.html` entry; `js/dash-shim.js` loads datasets from `data/data.js`
- `js/data.js` workspaces, CSV import, validation; `js/derive.js` metrics; `js/engine.js` GTM Radar signals + Ask answers
- `js/pages*.js` screens; `js/shell.js` navigation, top bar, router

## Analytics & decision layer
Scorecard, growth funnel and leaks, contribution, Next ₹1, waterfall, creator and sales intelligence, attribution models, experiments and the Decision Log live in `js/pages7–10.js`. All figures are deterministic simulated data.

`js/pages11.js` adds the Growth Status strip, explainable Growth Score, Growth Trend, funnel conversion and diagnostics, ranked Opportunities and Risks, the revenue outlook, lead alerts, the creator leaderboard, "View data" and extra Ask answers.
`js/pages12.js` adds the 8-KPI strip with sparklines and targets, the five-card Growth Brief, the largest-leak callout and stage drill-down, channel contribution leaders, the channel performance matrix, campaign charts, unit economics, cohort retention (simulated in demo only), the Growth Opportunity Matrix, decision logging with owner and follow-up date, and more Ask answers.
