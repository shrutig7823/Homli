# Homli: trusted places that feel like home

A PG (paying guest) discovery app for people moving to Bengaluru. Search, compare and shortlist before you pack a single bag.

**Live site:** https://shrutig7823.github.io/homli/ (the website, once this repository is published). It currently runs on built-in sample data in the browser. The backend in `server/` is built and tested but not deployed yet (see "Deploy").

> This is a prototype. The 11 listings were compiled from firsthand information and public or official pages. Details can change, so every page tells you to confirm with the PG. Booking is a demo: nothing is sent to a PG and no payment is taken.

## The problem
Someone moving to a new city has to piece a PG together from word of mouth, Google Maps, listing portals, photos and visits. The information is scattered and incomplete, and photos can mislead. The idea started from a friend's move to Bengaluru. That is a single account, so the problem is **not yet validated** with other people. More in [docs/product-brief.md](docs/product-brief.md).

## What it does
- **Search** by area, by PG name, or in plain language ("AC under 20k in Bellandur"), with typo tolerance and an "Understood: ..." line.
- **Filter** by budget, room type, who the PG is for, and amenities.
- **Distance slider:** pick a place (for example RMZ Ecospace) and see PGs within 1 to 15 km.
- **Honest data:** prices shown as exact, a range, "from" or "Check availability"; amenities as yes, no or "Details being verified"; deposit and lock-in period shown where known. Nothing is guessed.
- **PG page:** photos with credits, rooms, amenities, Google reviews (when connected), source link, location.
- **Shortlist and compare** (up to three), saved in the browser so a refresh keeps them.
- **Demo booking flow:** room, details, review, confirm, with validation, failure handling and duplicate-submission protection.
- Loading, empty and error states on every screen.

## Tech stack
| Part | Technology |
|---|---|
| Client | Plain HTML, CSS and JavaScript (no framework, no build step), hash router, `localStorage` |
| Server | Node.js 22+ and Express |
| Database | Postgres (hosted, for deployment) or SQLite (on a laptop); the same SQL runs on both |
| Photos and reviews | Google Places API (New), called only from the server |
| Tests | Node's built-in test runner; a real Postgres engine (PGlite) inside the tests |
| Hosting plan | GitHub Pages (client), Render and Neon free tiers (server and database) |

## Architecture
```
Browser (client/) ──JSON over HTTPS──► Server (server/) ──► Postgres / SQLite
 pages, state, localStorage             routes → controllers → services → models
                                              └──► Google Places API (key stays on the server)
```
Details and the reasons behind each choice: [docs/architecture.md](docs/architecture.md).

## Project layout
```
homli/
├── client/                 the website
│   ├── index.html
│   ├── photos/             photos used with each PG's permission
│   ├── styles/             tokens.css (design system), global.css, components.css
│   └── src/
│       ├── pages/          pages.js (home, search, PG detail), lists.js (shortlist, compare), booking.js
│       ├── components/     ui.js (cards, states, gallery)
│       ├── services/       api.js (all server calls), search.js (smart search for the fake API)
│       ├── utils/          store.js (localStorage, analytics events)
│       ├── data/           data.js (the PG data)
│       ├── config.js       API address (no secrets)
│       └── app.js          router and event wiring
├── server/
│   ├── server.js           wires everything together
│   ├── routes/             pgRoutes, bookingRoutes, photoRoutes
│   ├── controllers/        read the request, call a service, send the answer
│   ├── services/           searchService, pgService, bookingService, googlePlacesService
│   ├── middleware/         cors, validateRequest, errorHandler, requestLogger
│   ├── models/             pgModel, roomTypeModel, photoModel, bookingModel (the only SQL)
│   ├── db/                 connection.js, schema.sql, seed.js, seed.json
│   └── scripts/            export-seed, reseed, smoke
├── docs/                   product-brief, architecture, user-flow, state-matrix, api-contracts
├── tests/                  filters.test.js, booking.test.js, api.test.js
├── .github/workflows/      pages.yml (publishes client/ to GitHub Pages)
├── render.yaml             server deployment settings
└── .env.example            the settings the server reads
```

## Run it on your laptop
You need Node 22.5 or newer.
```
npm run install:server        # first time only
npm start                     # API on http://localhost:3000  (check /api/health)
```
In a second terminal, serve the website:
```
python -m http.server 8123 --directory client
```
Open http://localhost:8123. On localhost the website expects the server on port 3000 (see `API_BASE` in `client/src/config.js`). To run the website alone on its built-in sample data, set `API_BASE = ""` in that file.
Settings go in a `.env` file at the project root (copy `.env.example`). Never commit it.

## Tests
```
npm test                      # 29 tests: search rules, booking rules, and the HTTP API
npm run smoke                 # a quick check of every route against a running server
```

## Deploy
1. **Database:** create a free project at neon.tech and copy its connection string.
2. **Server:** on render.com create a Web Service from this repository, set the Root Directory to `server`, and add `DATABASE_URL` and `ALLOWED_ORIGINS=https://shrutig7823.github.io` as environment variables.
3. **Website:** in the repository's Settings, open Pages and set the source to GitHub Actions, then push to `main`.
4. In `client/src/config.js`, set `DEPLOYED_API` to your Render address.
A free Render server sleeps when idle, so the first visit can take up to a minute. Check `npm run smoke -- https://your-server.onrender.com` after deploying.

## Screenshots
Add your own to `docs/screenshots/` and link them here: home, search with "Understood" chips, a PG page with photos, the compare table, the booking review.

## How this was built
- The product direction was mine: the problem, the name and look, what to include (filters, deposit and lock-in, the distance slider, search by name), and the rules about honesty and permission for data and photos.
- The code was written with an AI assistant (Claude Code), tested, and reviewed by me. I am working through understanding each part. See "What I learned" below.

## What I learned
_Write this yourself. A good version covers: how a request travels from a click to a database row; why the Google key lives on the server; why "unknown" is different from "no"; what duplicate-submission protection is and how a unique request id gives it; what you would change after talking to real users._

## What is not built yet
Login, a real booking handoff to PGs, meaning-based (AI) search, exact addresses, analytics collection, moderation. See [docs/architecture.md](docs/architecture.md).

## Docs
[Product brief](docs/product-brief.md) · [Architecture](docs/architecture.md) · [User flow](docs/user-flow.md) · [States and edge cases](docs/state-matrix.md) · [API contracts](docs/api-contracts.md)
