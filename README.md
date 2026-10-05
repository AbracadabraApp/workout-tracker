# Josh's Simple Gains

A personal HIT / time-under-tension workout timer. It's a static PWA on GitHub Pages:
https://abracadabraapp.github.io/workout-tracker/#key=APP_KEY

## Files
- `index.html`: timer app. The exercise rotation is in `var workouts = {A,B,C}`. Progression rules are in `entryTUT()` and `progressBadge()`.
- `gains.html`: progress charts, the exercise table and quarterly metrics. It reads the same data as the timer.
- `workoutData.js`: local-first load and save. Unsynced saves are marked `pending` in localStorage, merged with the remote copy on launch, and retried. Pending data is never overwritten.
- `tokenStorage.js`: reads the app key from the URL hash (`#key=`). The hash is used because iOS clears localStorage for home-screen apps.
- `workout-data.json`: the data. Every save is a git commit.
- `worker/`: Cloudflare Worker `gains-data`. It holds the GitHub token as a secret and serves `GET/PUT /data` to the app, checking the `X-App-Key` header. Deploy with `cd worker && npx wrangler deploy`.
- `docs/`: parked plans (`withings-plan.md`).

## Progression rules
- Combined TUT = set 1 + set 2. For single-arm/single-leg exercises it's (L + R) / 2 per set.
- More than 140s in two consecutive sessions at the same weight shows **New Weight**. One session shows "Maintain · 1 more".
- 80–140s shows **Maintain**. Under 80s shows **Deload** (one increment lighter).
- Any set under 10s marks the session as null data, and it's ignored.
- Each decision uses the latest sessions of an exercise on any day, since Pullover and RDL appear twice a week.

## Secrets
- Worker secrets: `GITHUB_TOKEN` (classic token, `repo` scope only) and `APP_KEY`. Set them with `npx wrangler secret put`. Never commit them.
