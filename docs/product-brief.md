# Homli: product brief

## The problem
When someone moves to a new city for work or study, finding a PG (paying guest accommodation) means piecing it together from scattered places: word of mouth, Google Maps and reviews, listing portals, photos and visits. The information is fragmented and often incomplete (price, deposit, what is included), and photos can mislead, for example rooms that look bigger than they are. The result is a long, tiring search and visits to places that were never a fit.

## Who it is for
People relocating to Bengaluru who need a PG near their workplace. The idea started from a friend's move to Bengaluru. Right now that is **one person's account (n = 1)**. It has not been validated with other users.

## The goal
Help someone shortlist confidently from their phone or laptop, so they only visit the final few places.

## What Homli does
- Search by area, by PG name, or in plain language ("AC under 20k in Bellandur").
- Filter by budget, room type, who the PG is for, and amenities.
- Show PGs near a chosen place with a distance slider.
- Show honest details: price shown as exact, a range, "from", or "Check availability"; amenities as yes, no or "Details being verified".
- Shortlist, compare up to three, and send a demo visit request.
- Photos used with each PG's permission, and credited. Google photos and reviews are supported through the API, with attribution.

## Product principles (decisions made along the way)
- **Never invent a value.** If a source does not say, the page says "Details being verified". Unknown is not the same as no.
- **Do not publish what you do not have rights to.** Photos are only used with permission. No scraping of Google Maps or Instagram.
- **No fake reviews.** Reviews are meant to come from Google, with attribution. Until that is connected, none are shown.
- **Compare without picking a winner.** The compare table highlights differences and lets the user say what matters to them.
- **Be clear about what is a prototype.** Booking is a demo: nothing is sent to a PG and no payment is taken.

## Scope
**In version 1:** the features above, a real API and database, and a free deployment path.
**Out of scope for now:** payments, owner dashboard, real-time availability, chat, login, AI recommendations, and any scraping.

## Data
The 11 PGs come from a launch seed dataset: some are firsthand information, some come from official or public pages (the source link is kept on each PG). Prices and amenities can change, so every page tells the user to confirm with the PG. Deposit and lock-in period are shown where known; the lock-in period is not yet known for any PG.
Distances are rough: each PG is placed at the centre of its area, not at an exact address.

## How success could be measured (not yet measured)
There are no users or numbers yet. A sensible first set to track: the share of visitors who open a PG page after searching, the number of shortlists and comparisons per visit, and how often a search returns no results. The app already records these events (see `client/src/utils/store.js`, the `track()` function), but nothing collects them yet.

## What is not validated
- Whether other newcomers have the same problem in the same way (only one account so far).
- Whether people would use Homli instead of what they use today.
- Whether the data stays accurate without owners keeping it up to date.

## Next steps worth taking
1. Talk to five to ten people who recently moved, and ask how they found their PG.
2. Collect missing facts (lock-in, deposit) directly from the PGs.
3. Deploy the backend so shortlists and bookings are shared, not per device.
4. Connect Google photos and reviews, then review accuracy.
