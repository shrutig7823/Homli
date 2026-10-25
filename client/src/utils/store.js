// store.js: the app's memory.
// Everything that must survive a page refresh is saved in the browser's localStorage here.
// localStorage only stores TEXT, so we turn data into text (JSON.stringify) to save it
// and back into data (JSON.parse) to read it.

const KEYS = {
  shortlist: "homli_shortlist",   // a list of PG ids, like [101, 104]
  compare: "homli_compare",       // a list of up to 3 PG ids
  cart: "homli_cart",             // the single room being booked
  details: "homli_details",       // the booking form values
  bookings: "homli_bookings",     // confirmed bookings (our fake database table)
  events: "homli_events"          // the analytics log
};
const MAX_COMPARE = 3;

// Read a saved value. If nothing is saved (or the browser blocks storage), return the fallback.
function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

// Save a value.
function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // If storage is blocked we simply cannot remember. The app still works.
  }
}

// The data changed from sample PGs to the real list. Clear old saved ids and bookings once, so nothing points at a PG that no longer exists.
(function () {
  try {
    if (localStorage.getItem("homli_data_version") !== "2") {
      [KEYS.shortlist, KEYS.compare, KEYS.cart, KEYS.details, KEYS.bookings].forEach(function (k) { localStorage.removeItem(k); });
      localStorage.setItem("homli_data_version", "2");
    }
  } catch (e) { /* storage blocked: nothing to clear */ }
})();

const Store = {
  // ----- Shortlist -----
  getShortlist() { return readStore(KEYS.shortlist, []); },
  isShortlisted(id) { return this.getShortlist().includes(id); },
  // Add the id if it is not saved, remove it if it is. Returns true if it is now saved.
  toggleShortlist(id) {
    const ids = this.getShortlist();
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids.push(id);
    writeStore(KEYS.shortlist, ids);
    return i < 0;
  },

  // ----- Compare (maximum 3) -----
  getCompare() { return readStore(KEYS.compare, []); },
  isInCompare(id) { return this.getCompare().includes(id); },
  // Returns { ok: true, added: true/false } or { ok: false, reason } when the limit is hit.
  toggleCompare(id) {
    const ids = this.getCompare();
    const i = ids.indexOf(id);
    if (i >= 0) {
      ids.splice(i, 1);
      writeStore(KEYS.compare, ids);
      return { ok: true, added: false };
    }
    if (ids.length >= MAX_COMPARE) {
      return { ok: false, reason: "You can compare up to 3 places." };
    }
    ids.push(id);
    writeStore(KEYS.compare, ids);
    return { ok: true, added: true };
  },

  // ----- Booking cart (one item) -----
  getCart() { return readStore(KEYS.cart, null); },
  setCart(cart) { writeStore(KEYS.cart, cart); },
  clearCart() { localStorage.removeItem(KEYS.cart); },

  // ----- Booking details form -----
  getDetails() { return readStore(KEYS.details, null); },
  setDetails(details) { writeStore(KEYS.details, details); },
  clearDetails() { localStorage.removeItem(KEYS.details); },

  // ----- Bookings (stands in for a database table until V2) -----
  getBookings() { return readStore(KEYS.bookings, []); },
  saveBookings(list) { writeStore(KEYS.bookings, list); }
};

// ----- Analytics -----
// Records what the user did. In V1 it only prints to the browser Console and keeps the last 200 events.
function track(name, props) {
  const event = { name, props: props || {}, at: new Date().toISOString() };
  console.log("[analytics]", name, event.props);
  const log = readStore(KEYS.events, []);
  log.push(event);
  writeStore(KEYS.events, log.slice(-200));
}
