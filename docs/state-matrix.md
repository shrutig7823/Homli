# Homli: states and edge cases

Every screen has a defined look for loading, empty, error and success.

## What each page remembers
| Page | State | Starts as | Changed by |
|---|---|---|---|
| Home | `home.q`, `home.maxRent`, `home.amenities`, `home.near`, `home.radius`, `home.errors`, the PG list and its loading and error flags | empty | typing, chips, the slider |
| Search | `search.filters` (read from the address), `loading`, `error`, `results`, `parsed`, `understood` | loading | filters (they change the address) |
| PG detail | `pdp.data`, `loading`, `error`, `notFound`, `selectedRoomId`, `photos`, `modalIndex` | loading | fetch, room click, photo click |
| Shortlist | saved ids (localStorage), `items`, `loading`, `error` | from storage | heart |
| Compare | compare ids (localStorage), `items`, `priorities` | from storage | Compare button, priority chips |
| Cart | `cart` (localStorage) | from storage | room selection |
| Details | form values (localStorage), `touched` | from storage | typing |
| Review | `status` (`idle`, `confirming`, `failed`), `error` | `idle` | Confirm |

## Persisted in the browser (localStorage)
`homli_shortlist`, `homli_compare`, `homli_cart`, `homli_details`, `homli_bookings` (only with the fake API), `homli_events`. They survive a refresh and stay on that device.

## Edge cases and what the user sees
| Area | Case | What the user sees |
|---|---|---|
| Home | Nothing typed and nothing chosen | A message asking for an area, a name or a request |
| Home | Slider with nothing in range | "No PGs this close" and a button to widen the distance |
| Search | Slow | Skeleton cards |
| Search | Nothing understood (empty search) | "What are you looking for?" with examples |
| Search | No matches | A friendly message and buttons to clear filters |
| Search | Server error | "Something went wrong" and Try again (test with `&fail=1` in the address) |
| Search | A PG whose price or amenity is unknown | It does not match a filter on that field (unknown is never treated as yes) |
| PG detail | Unknown id | "We couldn't find this place" |
| PG detail | No photos | "Photos coming soon", or a clear message for each Google status |
| PG detail | No Google connection | "Reviews will appear here once Homli is connected to Google". No reviews are shown |
| PG detail | Room with unknown price | Cannot be selected, shown as "Price being verified" |
| PG detail | Unknown deposit or lock-in | "Details being verified" |
| Shortlist | Empty, or after removing all | An empty state; the list survives a refresh |
| Compare | 0, 1, 3 selected, a fourth | Prompts, the table, and an "up to 3" message |
| Cart | Empty, room gone | An empty state, or a message with a link back |
| Details | Invalid phone, email or date | Inline error messages; the button stays off |
| Review | Opened directly | Sent back to the earlier step |
| Confirm | Slow | A "Confirming" state; extra clicks ignored |
| Confirm | Fails | An error with Try again; nothing the user typed is lost |
| Confirm | Double click or repeat | One booking only (the same request id returns the same booking) |
| Success | Unknown booking id | "We couldn't find this booking" |
| Server | Offline or asleep too long | The error state; a free host can take up to a minute to wake |
| Server | A crash inside a route | A safe 500 message; details are logged, never shown |
