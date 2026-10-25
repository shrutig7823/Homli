// searchService.js: the smart search, running on the SERVER.
// This is the same logic as client/src/services/search.js (which the website uses while no backend is connected),
// wrapped in a function so it can receive the data it needs from the database.
// Keyword + synonym + typo-tolerant search. It is not an AI/embedding model.
module.exports = function createSearch(ctx) {
  const AREAS = ctx.AREAS, AMENITIES = ctx.AMENITIES, SOURCE_LABELS = ctx.SOURCE_LABELS, roomsOf = ctx.roomsOf;
  const formatINR = function (n) { return "\u20B9" + Number(n).toLocaleString("en-IN"); };

  // search.js: the smart search. It turns what the user typed into (1) hard rules and (2) words to match.
  // It is NOT an AI model. It is "smart keyword search": synonyms, typo tolerance, and a parser that understands
  // budgets ("under 20k"), gender ("co-ed"), room type ("single"), amenities ("AC", "meals") and area names.
  // Real semantic search (meaning-based, using embeddings) needs a server and a model, so it belongs in V2.

  // Words people use for each amenity -> the amenity name in the data.
  const AMENITY_WORDS = {
    "Food": ["food", "meal", "meals", "mess", "breakfast", "lunch", "dinner", "veg", "cooking", "tiffin"],
    "AC": ["ac", "a/c", "air conditioner", "air conditioning", "air-conditioned", "aircon"],
    "Wi-Fi": ["wifi", "wi-fi", "internet", "broadband"],
    "Housekeeping": ["housekeeping", "cleaning", "cleaned"],
    "Laundry": ["laundry", "washing machine", "washing", "washer"],
    "Indoor games": ["indoor games", "games", "table tennis", "pool table", "snooker", "gaming"],
    "Electricity": ["electricity", "power bill"],
    "Water": ["hot water", "water", "ro water"]
  };
  const GENDER_WORDS = {
    women: ["women", "woman", "ladies", "lady", "girls", "girl", "female"],
    men: ["men", "gents", "boys", "boy", "male"],
    coed: ["co-ed", "coed", "co ed", "unisex", "mixed", "couples"]
  };
  const ROOM_WORDS = {
    private: ["single", "private", "own room", "alone"],
    sharing: ["sharing", "shared", "double", "triple", "twin", "dorm"]
  };
  const CHEAP_WORDS = ["cheap", "cheapest", "affordable", "budget", "low cost", "lowest"];
  const STOP_WORDS = ["in", "near", "at", "for", "a", "an", "the", "pg", "pgs", "with", "and", "or", "me", "show", "find",
    "want", "need", "looking", "look", "place", "places", "stay", "stays", "to", "of", "around", "good", "best", "rs", "rupees",
    "month", "monthly", "per", "i", "my", "have", "has", "should", "be", "is", "room", "rooms", "that", "which", "some", "only"];

  // Extra names for areas (so "ecospace" finds Bellandur). Only well-known, true associations.
  const AREA_EXTRA = { "Bellandur": ["ecospace", "ecospace business park"], "Sarjapur": ["sarjapura"], "HSR Layout": ["hsr layout"] };

  // ---------- small helpers ----------
  function editDistance(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 3;
    const dp = [];
    for (let i = 0; i <= m; i++) { dp[i] = [i]; }
    for (let j = 0; j <= n; j++) { dp[0][j] = j; }
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return dp[m][n];
  }

  // Find a phrase as a whole word(s) in the text. If found, remove it from the text and return true.
  function takePhrase(state, phrase) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
    const re = new RegExp("(^|[^a-z0-9])" + escaped + "(?=$|[^a-z0-9])", "i");
    if (re.test(state.text)) { state.text = state.text.replace(re, "$1 "); return true; }
    return false;
  }

  function moneyValue(numText, kText) {
    const n = parseFloat(String(numText).replace(/,/g, ""));
    if (isNaN(n)) return null;
    return kText ? n * 1000 : n;
  }

  // ---------- the parser ----------
  // Returns { raw, area, minRent, maxRent, gender, roomType, amenities[], cheap, words[], notes[] }.
  function parseQuery(raw) {
    const out = { raw: String(raw || "").trim(), area: null, minRent: null, maxRent: null, gender: null, roomType: null,
      amenities: [], cheap: false, words: [], notes: [] };
    const state = { text: " " + out.raw.toLowerCase().replace(/₹/g, " ") + " " };

    // 1. Budget. "under 20k", "below 18,000", "above 15k", "15k-20k", or a bare "20k".
    const maxRe = /(?:under|below|less than|upto|up to|max(?:imum)?|within|not more than)\s*(?:rs\.?|inr)?\s*([\d,.]+)\s*(k|thousand)?/i;
    const minRe = /(?:above|over|more than|min(?:imum)?|at least)\s*(?:rs\.?|inr)?\s*([\d,.]+)\s*(k|thousand)?/i;
    const rangeRe = /([\d,.]+)\s*(k)?\s*(?:-|to)\s*([\d,.]+)\s*(k)?(?!\s*-?\s*shar)/i;
    let m;
    if ((m = state.text.match(maxRe))) { out.maxRent = moneyValue(m[1], m[2]); state.text = state.text.replace(maxRe, " "); }
    if ((m = state.text.match(minRe))) { out.minRent = moneyValue(m[1], m[2]); state.text = state.text.replace(minRe, " "); }
    if (out.maxRent == null && out.minRent == null && (m = state.text.match(rangeRe))) {
      const lo = moneyValue(m[1], m[2] || m[4]), hi = moneyValue(m[3], m[4]);
      // A real money range needs "k" or 4+ digit numbers, so "2-sharing" or "3 to 4" is not treated as money.
      if (lo != null && hi != null && (lo >= 1000 || m[2] || m[4]) && hi >= 1000) { out.minRent = Math.min(lo, hi); out.maxRent = Math.max(lo, hi); state.text = state.text.replace(rangeRe, " "); }
    }
    if (out.maxRent == null && out.minRent == null && (m = state.text.match(/(?:^|\s)([\d,]{4,}|\d+(?:\.\d+)?\s*k)(?=\s|$)/i))) {
      const t = m[1].replace(/\s/g, "").toLowerCase();
      out.maxRent = t.endsWith("k") ? parseFloat(t) * 1000 : parseFloat(t.replace(/,/g, ""));
      state.text = state.text.replace(m[1], " ");
    }
    if (out.maxRent != null) out.notes.push("up to " + formatINR(out.maxRent));
    if (out.minRent != null) out.notes.push("from " + formatINR(out.minRent));

    // 2. Gender, room type, amenities, "cheap".
    Object.keys(GENDER_WORDS).forEach(function (g) {
      if (!out.gender && GENDER_WORDS[g].some(function (w) { return takePhrase(state, w); })) {
        out.gender = g;
        out.notes.push({ women: "women only", men: "men only", coed: "co-ed" }[g]);
      }
    });
    Object.keys(ROOM_WORDS).forEach(function (r) {
      if (!out.roomType && ROOM_WORDS[r].some(function (w) { return takePhrase(state, w); })) {
        out.roomType = r;
        out.notes.push(r === "private" ? "single room" : "sharing");
      }
    });
    Object.keys(AMENITY_WORDS).forEach(function (a) {
      if (AMENITY_WORDS[a].some(function (w) { return takePhrase(state, w); })) { out.amenities.push(a); out.notes.push(a); }
    });
    if (CHEAP_WORDS.some(function (w) { return takePhrase(state, w); })) { out.cheap = true; out.notes.push("cheapest first"); }

    // 3. Area (full names, aliases, extra names).
    AREAS.forEach(function (a) {
      if (out.area) return;
      const names = [a.name.toLowerCase()].concat(a.aliases, AREA_EXTRA[a.name] || []);
      if (names.some(function (n) { return takePhrase(state, n); })) { out.area = a; out.notes.unshift(a.name); }
    });

    // 4. Whatever is left are words to match against names and descriptions.
    out.words = state.text.split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1 && STOP_WORDS.indexOf(w) < 0 && !/^\d+$/.test(w); });
    return out;
  }

  // ---------- scoring a PG against the leftover words ----------
  function wordScore(word, candidates) {
    let best = 0;
    candidates.forEach(function (c) {
      if (c === word) best = Math.max(best, 3);
      else if (word.length >= 3 && (c.startsWith(word) || (c.length >= 4 && word.startsWith(c)))) best = Math.max(best, 2.2);
      else if (word.length >= 4 && editDistance(word, c) <= 1) best = Math.max(best, 2);
      else if (word.length >= 7 && editDistance(word, c) <= 2) best = Math.max(best, 1.5);
    });
    return best;
  }
  function wordsOf(text) { return String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }

  // How well does this PG match the words? 0 means "not at all".
  function scorePg(pg, words) {
    if (words.length === 0) return 0;
    const nameWords = wordsOf(pg.name);
    const areaWords = wordsOf(pg.area + " " + pg.areaKey);
    const otherWords = wordsOf(pg.notes + " " + pg.gender + " " + (SOURCE_LABELS[pg.sourceType] || "") + " " +
      roomsOf(pg.id).map(function (r) { return r.label + " " + (r.inclusions || []).join(" "); }).join(" ") + " " +
      AMENITIES.filter(function (a) { return pg.amenities[a] === "y"; }).join(" "));
    let total = 0, matched = 0;
    words.forEach(function (w) {
      const s = Math.max(wordScore(w, nameWords) * 3, wordScore(w, areaWords) * 2, wordScore(w, otherWords));
      if (s > 0) matched++;
      total += s;
    });
    // Every typed word should match something, otherwise it is not a good match.
    return matched === words.length ? total : 0;
  }

  // Straight-line distance in km between two latitude/longitude points (the haversine formula).
  function distanceBetween(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const toRad = function (deg) { return deg * Math.PI / 180; };
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return { parseQuery: parseQuery, scorePg: scorePg, distanceBetween: distanceBetween };
};
