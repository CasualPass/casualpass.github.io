# CasualPass 🎮

CasualPass is an ad-free collection of lightweight browser games. The interface is built with vanilla HTML, CSS and JavaScript, so it can be deployed directly to GitHub Pages without a build step.

## Games

- **Wood Turning:** Carve a customer's target profile, sand the surface, paint the finished piece and receive a 0–100 job score.
- **Chess:** Play against the CasualFish engine at multiple difficulty levels.
- **Snake:** Configure the board and speed, then chase a new high score.
- **Tic Tac Toe (XOX):** Play locally or against the Minimax-based CasualXOX engine.
- **2048:** Merge tiles and reach 2048.

## Wood Turning and CasualMoney

Wood Turning uses a canvas-based radial profile model. The live similarity score compares the player's current radius samples with the requested target; over-cutting receives an additional penalty. The final job score combines:

- shape similarity: 82%
- sanding coverage: 10%
- paint coverage: 8%

CasualMoney rewards grow non-linearly as the final score approaches 100. Players can use the currency to unlock paint colours and upgrade their office. Each office level increases the reward multiplier for later Wood Turning jobs.

Player profiles, balances, owned paints and office progress are mirrored in `localStorage` by `casual-profile.js`. CasualMoney is intentionally enabled only for Wood Turning in this version.

## Cross-device sync and email OTP

GitHub Pages serves static files and cannot safely issue or verify one-time passwords by itself. CasualPass therefore supports two explicit modes:

- **Local mode:** username profile stored only in the current browser.
- **Cloud mode:** username + Supabase email OTP, with the profile synced between devices.

Cloud mode keeps a local mirror for fast/offline play. Changes are pushed after every economy update and pulled on sign-in, reconnect and tab focus. If two offline devices change the same profile before reconnecting, the newest profile timestamp wins.

### Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql). It creates the profile table and Row Level Security policies that restrict every row to its authenticated user.
3. In **Authentication → Email Templates**, make the sign-in template display `{{ .Token }}` so players receive a numeric OTP rather than only a magic link.
4. Copy the project URL and **publishable** (or legacy `anon`) key into `cloud-config.js` and set `enabled: true`:

   ```js
   window.CASUALPASS_CLOUD = Object.freeze({
       enabled: true,
       supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
       supabasePublishableKey: 'YOUR_PUBLISHABLE_KEY',
       table: 'casual_profiles',
       sdkUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm'
   });
   ```

5. Add the final GitHub Pages URL to the allowed site/redirect URLs in Supabase Auth settings.

The publishable key is intended for browser apps; RLS protects access to database rows. Never add a Supabase `service_role` key to this repository.

This setup securely isolates each player's row, but the game score is still calculated by client-side JavaScript. If CasualMoney becomes competitive or redeemable, move reward calculation to a validated Supabase Edge Function or database RPC.

## Run locally

No dependencies or build command are required:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Deploy to GitHub Pages

In the repository settings, choose **Pages → Deploy from a branch**, select the `main` branch and the root folder. All links are relative and work under the repository subpath.

## License

MIT
