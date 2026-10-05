# Withings body composition: parked plan

Status: **parked** (scoped Oct 5, 2026; not started). Build after the gains-data Worker is live.
Mockup: [withings-mockup.png](withings-mockup.png) (strength numbers real, body numbers sample)

## Goal
Show whether strength gains come with lean-mass gains, especially during weight loss, by plotting Withings weight and lean mass beside strength on the Gains page.

## Decisions
- Josh weighs daily and trains 1–3x/week.
- Weight: 7-day rolling average. A 30-day average lags too far behind during weight loss.
- Lean (fat-free) mass: 30-day rolling average. Scale readings swing 1–2 lb/day, while real change is about 0.5 lb/month.
- Daily raw readings appear as faint dots behind the lines.
- Default view: last 90 days, matching the quarterly check-ins.
- Both y-axes use the same lb span, sized to the larger series, so the slopes compare fairly. Self-scaling axes made lean-mass noise look dramatic.
- Rename the Quarterly "Weight gain" column to "Strength", then add "Weight" and "Lean" columns.
- Guide: during weight loss, flat lean mass is a win. A drop larger than about 25% of the weight drop is a warning.
- Out of scope: steps, sleep, heart rate, writing data to Withings, and live Withings calls from the phone.

## Architecture
- Register an app at developer.withings.com/dashboard (public API, no contract). The callback URL points to the Worker.
- The gains-data Worker adds:
  - /withings/connect (one-time approval)
  - /withings/callback (stores the token)
  - a daily cron that pulls measurements and commits body-data.json to the repo
- Cloudflare KV holds the refresh token, because Withings issues a new one on every refresh and the old one dies after 8 hours. Secrets can't be updated at runtime.
- body-data.json: [{date, weight, fatFreeMass, fatMass, fatRatio}] in lb, keeping the last reading of each day.

## Withings API facts (developer.withings.com/llms.md)
- OAuth authorize: https://account.withings.com/oauth2_user/authorize2, scope user.metrics. The code expires in 30 seconds.
- Token: POST https://wbsapi.withings.net/v2/oauth2, action=requesttoken. Access token lasts 3 hours. Refresh token lasts 1 year and rotates on every refresh.
- Measurements: https://wbsapi.withings.net/measure?action=getmeas with meastypes 1 (weight), 5 (fat-free mass), 6 (fat %) and 8 (fat mass). Use lastupdate for incremental pulls.
- Decode the value as value × 10^unit (in kg).
- Rate limit: no more than one poll per 10 minutes per user. Data calls need no signature.

## Risks
- Lean mass from the scale is an estimate (bioimpedance), so trust trends, not single readings. A DEXA scan would be a useful check.
- Requires a body-composition scale.
- If the cron fails for a year, the refresh token expires and Withings must be reconnected.

## Claude Code prompt
```
Pull first. Read docs/withings-plan.md, worker/, workoutData.js and gains.html. Build the plan:

1. Worker: KV binding WITHINGS_KV (create via wrangler); secrets WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET (I'll enter them).
   - GET /withings/connect?key=<APP_KEY>: redirect to authorize2 with a state saved in KV for 10 minutes.
   - GET /withings/callback: verify state, exchange the code immediately, store refresh_token in KV, run sync, show "Connected".
   - sync(): refresh the token and ALWAYS save the new refresh_token. Call getmeas with meastypes 1,5,6,8 and lastupdate. Decode and convert to lb (1 decimal). Merge into body-data.json by date and commit via the existing GitHub helper only if changed.
   - Daily cron at 14:00 UTC. Add POST /withings/sync (X-App-Key) for manual runs. Never poll Withings more than once per 10 minutes.
2. gains.html: load body-data.json. Add a Body section (see docs/withings-mockup.png):
   - two cards (current weight, current lean mass, each with its change this quarter) and a "Last weigh-in" time
   - chart: weight as a 7-day rolling average, fat-free mass as a 30-day rolling average, daily readings as faint dots, default last 90 days, both y-axes with the same lb span sized to the larger series
   - Quarterly table: rename "Weight gain" to "Strength", add Weight Δ and Lean Δ columns
   - Hide the Body section if there's no data.
3. Deploy. Give me the Withings callback URL to register and the /withings/connect link. After I connect, run a manual sync and confirm body-data.json was committed.
4. Test locally with no console errors, then commit and push. Never log or commit secrets.
```
