# Homli: API contracts

Base address: `http://localhost:3000` on your laptop, or your deployed server's address.
All answers are JSON. Errors always look like `{ "error": "message", "code": "VALIDATION" }` (`code` is optional).
The website's `client/src/services/api.js` calls these. The same functions also exist in a fake version that runs in the browser, so the website works with or without the server.

| Status | Meaning |
|---|---|
| 200 / 201 | Worked (201 = created) |
| 400 | The request was invalid (`code: VALIDATION`) |
| 404 | No such PG or booking |
| 409 | The room can't be booked (`code: ROOM_GONE`) |
| 500 | Something broke on the server (`code: SERVER`); details are only in the server log |

## GET /api/health
Is the server alive, and can it reach its database?
```json
{ "ok": true, "database": "postgres", "pgs": 11 }
```

## GET /api/pgs
All PGs. Add `?ids=201,204` for only those (used by Shortlist and Compare; at most 50).
Each PG: `id, name, area, areaKey, gender, genderKey, deposit, lockIn, sourceType, sourceUrl, notes, amenities, googlePlaceId, loc, photos, rooms, startingRoom, rent`.
`amenities` maps each amenity to `"y"` (yes), `"n"` (no) or `"?"` (unknown). `startingRoom` and `rent` are the cheapest room whose price is known, or `null`.

## GET /api/pgs/:id
One PG with its rooms. `404` if the id does not exist.
```json
{
  "pg": {
    "id": 206,
    "name": "Stanza Living Shanghai House",
    "area": "Green Glen Layout / Bellandur",
    "areaKey": "Bellandur",
    "gender": "Unisex",
    "genderKey": "coed",
    "deposit": "Details being verified",
    "lockIn": "Details being verified",
    "sourceType": "official",
    "sourceUrl": "https://www.stanzaliving.com/...",
    "amenities": { "Food": "y", "Wi-Fi": "y", "Indoor games": "?", "AC": "y" },
    "loc": { "lat": 12.9262, "lng": 77.6775 },
    "photos": [{ "file": "photos/206-1.jpg", "credit": "Stanza Living" }],
    "startingRoom": { "id": 10, "label": "Double sharing", "monthlyRent": 13499, "priceKind": "exact" },
    "rent": 13499
  },
  "rooms": [
    { "id": 9, "pgId": 206, "occupancyType": "Private", "label": "Single room",
      "monthlyRent": 22599, "rentMax": null, "priceKind": "exact", "inclusions": ["Attached balcony and washroom"] }
  ]
}
```
`priceKind` is `exact`, `range` (`monthlyRent` to `rentMax`), `from` (a starting price only) or `unknown` (`monthlyRent` is `null`).
(Both lists are shortened here.)

## GET /api/search
Query parameters, all optional: `q` (free text), `minRent`, `maxRent`, `roomType` (`private` or `sharing`), `gender` (`coed`, `women`, `men`), `amenities` (comma list, for example `Food,AC`), `sort` (`rent`).
`q` can be an area, a PG name, or a request such as `AC under 20k in Bellandur`. The text is parsed into rules and combined with the other parameters. A PG must pass every rule; an unknown value never counts as a match.
```json
{
  "query": { "area": { "name": "Bellandur" }, "maxRent": 20000, "amenities": ["AC"], "words": [], "notes": ["Bellandur", "up to ₹20,000", "AC"] },
  "understood": true,
  "results": [ { "id": 206, "name": "Stanza Living Shanghai House", "rent": 13499, "score": 0 } ]
}
```
`understood` is `false` when nothing usable was typed (the website then asks the user what they are looking for). `results` items have the same shape as in `/api/pgs` (shortened here). `query.notes` is what the website shows as "Understood: ...".

## POST /api/bookings
Creates a demo booking. Nothing is sent to any PG.
Body:
```json
{ "requestId": "req-17...", "pgId": 206, "roomTypeId": 9, "fullName": "Asha Rao", "phone": "9876543210",
  "email": "asha@example.com", "moveInDate": "2027-01-10", "expectedDuration": "6 months", "note": "" }
```
Rules, checked on the server:
- `fullName` at least 2 characters; `phone` a 10-digit Indian mobile number (starts with 6 to 9); `email` valid; `moveInDate` present; `requestId` present. Otherwise `400` with `code: VALIDATION` and the list of wrong fields.
- The room must exist, belong to that PG, and have a known price. Otherwise `409` with `code: ROOM_GONE`.
- **Duplicate protection:** sending the same `requestId` again returns the original booking (`200`) and creates nothing new.
- The saved price and deposit are worked out by the server and frozen as a snapshot. Any price sent by the browser is ignored.

Answer (`201`):
```json
{ "id": "HML-100001", "requestId": "req-17...", "pgId": 206, "roomTypeId": 9, "pgName": "Stanza Living Shanghai House",
  "roomLabel": "Single room", "fullName": "Asha Rao", "phone": "9876543210", "email": "asha@example.com",
  "moveInDate": "2027-01-10", "expectedDuration": "6 months", "note": "",
  "priceSnapshot": "₹22,599", "depositSnapshot": "Details being verified", "status": "confirmed", "createdAt": "2026-10-25T19:51:55.574Z" }
```
Invalid details (`400`):
```json
{ "error": "Invalid details: name, phone, email, moveInDate, requestId", "code": "VALIDATION" }
```

## GET /api/bookings/:id
Returns the booking above, or `404`.

## GET /api/pgs/:id/photos
Google photos, rating and reviews for one PG, fetched live with the server's key. `404` if the PG does not exist.
```json
{ "status": "found",
  "photos": [{ "url": "...", "largeUrl": "...", "author": "Photographer name", "authorUri": "https://..." }],
  "rating": 4.2, "reviewCount": 128,
  "reviews": [{ "author": "Name", "rating": 4, "when": "2 months ago", "text": "..." }] }
```
`status` is one of:
| Status | Meaning |
|---|---|
| `found` | Photos returned (up to 3). Each must be shown with its author credit |
| `no_photos` | Google has no place or no photos for this PG |
| `place_id_needs_review` | Google's top match did not match the PG's name, so nothing is shown |
| `api_error` | Google failed; the website offers Try again |
| `not_configured` | No Google key on the server. `photos` is empty |

The server finds the place with a text search ("PG name + area + Bengaluru"), requests only the fields it needs, and stores only the Google place id. Photo links are temporary, never stored, and cached in memory for 10 minutes. The key comes from `GOOGLE_MAPS_API_KEY` and is never sent to the browser.
