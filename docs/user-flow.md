# Homli: user flow

## The main journey
Home → Search (filters in the address) → PG detail (photos, rooms, amenities, reviews, deposit and lock-in, source) → pick a room → Cart → Details → Review → Confirm → Success.
Side journeys from Home, Search and PG detail: Shortlist (the heart) and Compare (up to three).

## Routes
| Route | Page | Needs |
|---|---|---|
| `#/` | Home: search bar, amenity chips, popular areas, distance slider, "Stays for you" | nothing |
| `#/search?q=...` | Results, with filters and an "Understood: ..." line | nothing |
| `#/pg/:id` | PG detail | a valid PG id |
| `#/shortlist` | Saved PGs | nothing |
| `#/compare` | Compare up to three | nothing |
| `#/booking/cart` | Booking cart | a selected room |
| `#/booking/details` | Your details | a cart |
| `#/booking/review` | Review and confirm | a cart and valid details |
| `#/booking/success/:id` | Confirmation | an existing booking |

Route guards: opening a later booking step directly sends the user back to the step they skipped. An unknown PG id shows a "couldn't find this place" state.

## What the user can type in the search bar
An area (`Bellandur`, `hsr`, `green glen`), a PG name (`stanza`, with typos allowed), or a request (`AC under 20k in Bellandur`, `co-ed with food`, `single room below 25000`, `cheap sharing sarjapur`). The results page shows how the words were understood, so the user can correct it.

## The distance slider
Choose a place (for example RMZ Ecospace), move the slider from 1 to 15 km, and the list shows only PGs within that distance, nearest first. Distances are rough estimates from the centre of each PG's area.

## The happy path
1. Open Homli, type `AC under 20k in Bellandur`, press Search.
2. Read the results, open a PG, look at the photos, rooms, amenities and terms.
3. Heart two or three PGs and compare them. Differences are highlighted.
4. Choose a room, press "Request a visit (demo)", fill in the details, review, confirm.
5. See the confirmation (a demo: nothing is sent to the PG).

## Calls to action
| Button | Where | What happens | Server call |
|---|---|---|---|
| Search / Find PGs | Home, Search | Check the text, put it in the address | `GET /api/search` (from the Search page) |
| Filters (room, budget, who, sort, amenities) | Search | Update the address, run the search again | `GET /api/search` |
| Distance slider | Home | Redraw only the list | none (uses data already loaded) |
| Card (anywhere) / View details | Home, Search, Shortlist | Open the PG page | `GET /api/pgs/:id` |
| Heart | Cards, PG page | Save or remove from the shortlist | none (localStorage) |
| Compare | Cards, PG page | Add to compare, refuse a fourth | none (localStorage) |
| Select a room | PG page | Mark the room | none |
| Request a visit (demo) | PG page | Save the cart, go to the cart | none |
| Review booking | Details | Validate, save the draft | none |
| Confirm booking | Review | Send the booking | `POST /api/bookings` |
| Try again | Any error state | Run the page again | the same call |
| Open in Google Maps / View source page | PG page | Open in a new tab | none |
