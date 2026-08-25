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

Player profiles, balances, owned paints and office progress are stored in `localStorage` by `casual-profile.js`. CasualMoney is intentionally enabled only for Wood Turning in this version.

## Authentication note

GitHub Pages serves static files and cannot safely issue or verify one-time passwords by itself. This version therefore uses a clearly labelled, device-local username profile instead of pretending to provide secure OTP authentication.

Production OTP and cross-device sync require an external authentication/data service such as Supabase Auth, Firebase Authentication or a small serverless API. `casual-profile.js` keeps profile/economy logic separate so that its storage adapter can be replaced later.

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
