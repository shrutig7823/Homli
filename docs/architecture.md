# Homli: architecture

## The whole system on one page
```
  Browser (client/)                         Server (server/)                    Database
  ┌────────────────────────┐   HTTPS/JSON   ┌──────────────────────────┐        ┌────────────────┐
  │ Pages: home, search,   │ ─────────────► │ routes -> controllers -> │ ─────► │ Postgres (live) │
  │ PG detail, shortlist,  │ ◄───────────── │ services -> models       │ ◄───── │ SQLite (laptop) │
  │ compare, booking       │                └───────────┬──────────────┘        └────────────────┘
  │ localStorage:          │                            │ server-side key
  │ shortlist, compare,    │                            ▼
  │ cart, booking draft    │                  Google Places API (photos, rating, reviews)
  └────────────────────────┘
```

## Client (`client/`)
Plain HTML, CSS and JavaScript. No framework and no build step, so it runs on any static host (GitHub Pages).
- **Router:** the part of the address after `#` picks the page (`#/search?q=...`). Filters live in the address, so Back, refresh and sharing work.
- **State and rendering:** each page keeps a small state object and a render function that writes HTML. When state changes, it renders again (the same idea React is built on).
- **Events:** one listener for the whole document reads `data-action` attributes (event delegation).
- **Services:** `api.js` is the only file that talks to the server. It has a real path and a fake path, chosen by `API_BASE` in `config.js`. With no backend address set, the site runs on built-in sample data in the browser.
- **Persistence:** shortlist, compare list, booking cart and booking draft are saved in `localStorage`, so a refresh keeps them (and they stay on that device).
- **Design system:** colours, spacing, corners and type are tokens in `styles/tokens.css`. Buttons, cards, forms and states live in `components.css`.

## Server (`server/`)
Node and Express. A request passes through these layers:
| Layer | Folder | Job |
|---|---|---|
| Middleware | `middleware/` | CORS allow-list, request log, JSON size limit, validation, errors |
| Routes | `routes/` | Which address goes to which function |
| Controllers | `controllers/` | Read the request, call a service, send the answer. Kept thin |
| Services | `services/` | The rules: search, booking, Google Places |
| Models | `models/` | The only place SQL is written |
| Database | `db/` | Connection, schema, seed data |

## Database
Tables: `pgs`, `amenities`, `rooms` (RoomType), `photos`, `bookings` (see `server/db/schema.sql`).
- Amenities store `y`, `n` or `?`, so "unknown" is a real value.
- Rooms store a price kind (exact, range, from, unknown) so the page never invents a number.
- Bookings store a price snapshot and have a unique `request_id`.
- **Reviews are not stored.** Google reviews are fetched live and shown with attribution, which is what Google's terms expect.
- The same SQL runs on SQLite (laptop), hosted Postgres (deployed) and PGlite (tests).

## Key decisions and trade-offs
| Decision | Why | Trade-off |
|---|---|---|
| Plain JavaScript, no React | Fastest path to something live and understandable | No component reuse system; a React version would be a rewrite |
| A fake API that mirrors the real one | The site works with no server, and pages did not change when the real backend arrived | Two code paths to keep in step |
| Google key only on the server | A key in browser code is public and can be stolen | Needs a backend (GitHub Pages alone cannot do it) |
| Google photos fetched live, never stored | Google allows showing them with attribution but not keeping them | A request per page view (cached for 10 minutes) |
| Smart keyword search, not AI | Handles names, typos, budgets and amenities with no model or extra cost | Does not understand meaning the way embeddings would |
| Distance from area centres | There are no exact PG addresses yet | Distances are rough, and the page says so |
| Booking is a demo | Nothing real should be promised to a PG without their agreement | Not a real transaction |

## Safety
Server-side validation on every write, parameterised SQL, request size limit, CORS allow-list, secrets only in `.env` or the host's settings, a safe 500 page that never shows internal details, and a check that a Google place matches the PG's name before photos are shown.

## Deployment
- Website: GitHub Pages, published from `client/` by `.github/workflows/pages.yml`.
- Server: a free Node host (Render) with a free hosted Postgres (Neon). Steps in the README.
- A free host sleeps when idle, so the first visit can take up to a minute.

## What is not built yet
Login, a real booking handoff to PGs, collecting analytics, moderation, exact addresses and geocoding, and meaning-based search.
