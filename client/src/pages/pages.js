// pages.js: one function per page.
// Each page keeps its own STATE (the variables it remembers), and a render function that turns that
// state into HTML. When state changes, we call render again. React works on the same idea.

// ---------- helpers shared by pages ----------
const $app = function () { return document.getElementById("app"); };

// Remember the last search so "Back to results" works on other pages.
function rememberSearch(areaName, hashPath) {
  try { sessionStorage.setItem("homli_last_search", JSON.stringify({ areaName: areaName, hashPath: hashPath })); } catch (e) { /* ignore */ }
}
function lastSearch() {
  try { return JSON.parse(sessionStorage.getItem("homli_last_search")) || null; } catch (e) { return null; }
}
function backToResultsHref() {
  const s = lastSearch();
  return s ? "#" + s.hashPath : "#/";
}

// Turn a filters object into the text after the ? in a search address.
function toQuery(f) {
  const q = new URLSearchParams();
  if (f.q) q.set("q", f.q);
  if (f.minRent) q.set("minRent", f.minRent);
  if (f.maxRent) q.set("maxRent", f.maxRent);
  if (f.roomType && f.roomType !== "any") q.set("roomType", f.roomType);
  if (f.gender && f.gender !== "any") q.set("gender", f.gender);
  if (f.amenities && f.amenities.length) q.set("amenities", f.amenities.join(","));
  if (f.sort && f.sort !== "relevance") q.set("sort", f.sort);
  if (f.fail) q.set("fail", "1");
  return q.toString();
}

function optionsHtml(options, selected) {
  return options.map(function (o) {
    return `<option value="${esc(o[0])}" ${String(o[0]) === String(selected) ? "selected" : ""}>${esc(o[1])}</option>`;
  }).join("");
}

// ======================================================================
// HOME  (#/)
// State: location, maxRent, amenities, errors, plus the "Stays for you" list (loading, error, items)
// The form lives outside the function so it is still filled in when you press Back.
// ======================================================================
const home = { near: "", radius: 3, q: "", maxRent: "", amenities: [], errors: {}, items: [], loading: true, error: null };

async function HomePage(ctx) {
  track("homepage_viewed");
  setRerender(renderHome);
  home.loading = true; home.error = null;
  renderHome();
  try {
    home.items = await apiListPgs(ctx.query);
    if (ctx.isStale()) return;
  } catch (err) {
    if (ctx.isStale()) return;
    home.error = "We couldn't load places right now.";
  }
  home.loading = false;
  renderHome();
  if (focusSearchNext) { focusSearchNext = false; focusSearchBox(); }
}

function renderHome() {
  const e = home.errors;
  const amenityChips = MUST_HAVE_FILTERS.map(function (a) {
    return `<button type="button" class="chip" aria-pressed="${home.amenities.includes(a)}" data-action="homeAmenity" data-value="${esc(a)}">${esc(a)}</button>`;
  }).join("");
  const popular = AREAS.map(function (a) {
    return `<a class="chip" href="#/search?q=${encodeURIComponent(a.name)}">${esc(a.name)}</a>`;
  }).join("");

  const nearOptions = [["", "Choose a place"]].concat(NEAR_PLACES.map(function (n) { return [n[0], n[0]]; }));

  $app().innerHTML = `<div class="container">
    <section class="hero">
      <h1>Trusted places that feel like <span class="hl">home</span>.</h1>
      <p class="muted">Search, compare and shortlist before you pack a single bag.</p>
      <p style="margin-top:12px"><span class="badge good">Prototype · details being verified</span></p>
    </section>

    <form class="searchbar" data-submit="homeSearch" aria-label="Search for a PG" novalidate>
      <div class="sb-field">
        <label for="homeLocation">Search</label>
        <input id="homeLocation" list="areaList" data-input="homeLocation" value="${esc(home.q)}" placeholder="Area, PG name, or what you need: AC under 20k" autocomplete="off">
        <datalist id="areaList">${AREAS.map(function (a) { return `<option value="${a.name}">`; }).join("")}${PGS.map(function (g) { return `<option value="${esc(g.name)}">`; }).join("")}</datalist>
      </div>
      <div class="sb-field">
        <label for="homeMax">Max rent per month (₹)</label>
        <input id="homeMax" type="number" inputmode="numeric" data-input="homeMax" value="${esc(home.maxRent)}" placeholder="Any">
      </div>
      <div class="sb-actions"><button type="submit" class="btn btn-primary">${icon("search")} Find PGs</button></div>
    </form>
    <div class="field-error sb-error">${esc(e.q || e.budget || "")}</div>

    <div class="quick">
      <span class="label">Amenities</span>
      <div class="chips scroll">${amenityChips}</div>
    </div>

    <h2 class="section-title">Popular areas</h2>
    <div class="chips">${popular}</div>

    <section class="card radius-panel" aria-label="Find PGs near a place">
      <div class="field"><label for="homeNear">Show PGs near</label>
        <select class="input" id="homeNear" data-change="homeNear">${optionsHtml(nearOptions, home.near)}</select></div>
      <div class="field">
        <label for="homeRadius">Within <strong id="radiusValue">${home.radius} km</strong></label>
        <input type="range" id="homeRadius" min="1" max="15" step="0.5" value="${home.radius}" data-input="homeRadius" ${home.near ? "" : "disabled"}>
        <div class="radius-scale"><span>1 km</span><span>15 km</span></div>
      </div>
      <p class="caption radius-note">Distances are rough, straight-line estimates from the centre of each PG's area, not exact addresses.</p>
    </section>

    <div id="home-list">${homeListHtml()}</div>
  </div>`;
}

// The "Search" tab in the header: go to the home page, then put the cursor in the Area box.
let focusSearchNext = false;
function focusSearchBox() {
  const el = document.getElementById("homeLocation");
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.focus({ preventScroll: true });
}
Actions.goSearch = function (el, e) {
  if (e) e.preventDefault();
  if (currentPath === "/") { focusSearchBox(); return; }
  focusSearchNext = true;
  navigate("/");
};

// The list under the slider. It is built separately so moving the slider can redraw ONLY this part.
function homeListHtml() {
  if (home.loading) return `<div class="results-head"><h2>Stays for you</h2></div>${skeletonCards(3)}`;
  if (home.error) return errorState("Something went wrong", home.error, `<button class="btn btn-primary" data-action="retryRoute">Try again</button>`);
  let items = home.items;
  let title = "Stays for you";
  if (home.near) {
    const place = NEAR_PLACES.find(function (n) { return n[0] === home.near; });
    items = home.items.map(function (it) {
      return Object.assign({}, it, { distanceKm: Math.round(distanceBetween(place[1], place[2], it.loc.lat, it.loc.lng) * 10) / 10 });
    }).filter(function (it) { return it.distanceKm <= home.radius; })
      .sort(function (a, b) { return a.distanceKm - b.distanceKm; });
    title = items.length + " PG" + (items.length === 1 ? "" : "s") + " within " + home.radius + " km of " + home.near;
  }
  if (home.near && items.length === 0) {
    return `<div class="results-head"><h2>${esc(title)}</h2></div>` +
      emptyState("No PGs this close.", "Slide the distance up to see PGs further away.", `<button class="btn btn-primary" data-action="homeWiden">Increase to ${Math.min(15, home.radius + 3)} km</button>`);
  }
  return `<div class="results-head"><h2>${esc(title)}</h2><p class="caption">${home.near ? "" : items.length + " PGs"}</p></div>
    <div class="grid">${items.map(pgCard).join("")}</div>`;
}
Changes.homeNear = function (el) { home.near = el.value; track("near_place_chosen", { place: home.near }); renderHome(); };
// Moving the slider: update the number and redraw only the list (the slider keeps focus).
Inputs.homeRadius = function (el) {
  home.radius = Number(el.value);
  const label = document.getElementById("radiusValue");
  if (label) label.textContent = home.radius + " km";
  const list = document.getElementById("home-list");
  if (list) list.innerHTML = homeListHtml();
};
Actions.homeWiden = function () { home.radius = Math.min(15, home.radius + 3); renderHome(); };

// ---- Home: typing updates state silently (no redraw, so the cursor never jumps) ----
Inputs.homeLocation = function (el) { home.q = el.value; };
Inputs.homeMax = function (el) { home.maxRent = el.value; };

// ---- Home: chips change state, then redraw ----
Actions.homeAmenity = function (el) {
  const a = el.dataset.value;
  const i = home.amenities.indexOf(a);
  if (i >= 0) home.amenities.splice(i, 1); else home.amenities.push(a);
  renderHome();
};

// ---- Home: Find PGs. Validate first. Only if everything is fine, change the address. ----
Actions.homeSearch = function () {
  const errors = {};
  if (!home.q.trim() && home.amenities.length === 0 && home.maxRent === "") {
    errors.q = "Type an area, a PG name, or what you need. For example: Bellandur, Stanza, or AC under 20k.";
  }
  if (home.maxRent !== "" && Number(home.maxRent) <= 0) errors.budget = "Enter a rent above 0, or leave it empty.";

  home.errors = errors;
  if (Object.keys(errors).length) {
    track("search_validation_failed", { fields: Object.keys(errors) });
    renderHome();
    return;
  }
  track("search_submitted", { q: home.q, amenities: home.amenities.length });
  navigate("/search?" + toQuery({
    q: home.q.trim(), maxRent: home.maxRent, amenities: home.amenities, fail: currentQuery.fail
  }));
};

// ======================================================================
// SEARCH  (#/search?...)
// State: filters (read from the URL), loading, error, results, area
// ======================================================================
const search = { filters: {}, loading: true, error: null, results: [], parsed: null, understood: true };

async function SearchPage(ctx) {
  const q = ctx.query;
  search.filters = {
    q: q.q || q.location || "",
    minRent: q.minRent || "",
    maxRent: q.maxRent || "",
    roomType: q.roomType || "any",
    gender: q.gender || "any",
    amenities: q.amenities ? q.amenities.split(",").filter(Boolean) : [],
    sort: q.sort || "relevance",
    fail: !!q.fail
  };
  search.loading = true;
  search.error = null;
  setRerender(renderSearch);
  renderSearch();

  try {
    const data = await apiSearchPgs(search.filters);
    if (ctx.isStale()) return;
    search.results = data.results;
    search.parsed = data.query;
    search.understood = data.understood;
    search.loading = false;
    rememberSearch(search.filters.q, "/search?" + toQuery(search.filters));
    track("results_loaded", { count: data.results.length });
    if (data.understood && data.results.length === 0) track("no_results_shown", { filters: toQuery(search.filters) });
  } catch (err) {
    if (ctx.isStale()) return;
    search.loading = false;
    search.error = "We couldn't load PGs right now.";
  }
  renderSearch();
}

function renderSearch() {
  const f = search.filters;
  const budgetValue = (function () {
    const i = BUDGET_PRESETS.findIndex(function (b) { return String(b[1]) === String(f.minRent) && String(b[2]) === String(f.maxRent); });
    return i >= 0 ? String(i + 1) : "0";
  })();
  const budgetOptions = [["0", "Any budget"]].concat(BUDGET_PRESETS.map(function (b, i) { return [String(i + 1), b[0]]; }));
  const amenityChips = MUST_HAVE_FILTERS.map(function (a) {
    return `<button type="button" class="chip" aria-pressed="${f.amenities.includes(a)}" data-action="searchAmenity" data-value="${esc(a)}">${esc(a)}</button>`;
  }).join("");

  let body;
  if (search.loading) {
    body = skeletonCards(6);
  } else if (search.error) {
    body = errorState("Something went wrong", search.error, `<button class="btn btn-primary" data-action="retryRoute">Try again</button>`);
  } else if (!search.understood) {
    body = emptyState("What are you looking for?", "Type an area (Bellandur, HSR Layout, Sarjapur), a PG name, or what you need, like \"AC under 20k\" or \"co-ed with food\".", "");
  } else if (search.results.length === 0) {
    const buttons =
      (f.amenities.length ? `<button class="btn" data-action="searchClearAmenities">Clear amenities</button>` : "") +
      `<button class="btn btn-primary" data-action="searchReset">Reset filters</button>`;
    body = emptyState("No places match all your filters.", "Try removing a filter. Places whose price, amenity or gender policy is still being verified don't match a filter on it.", buttons);
  } else {
    body = `<div class="results-head"><h2>${search.results.length} place${search.results.length === 1 ? "" : "s"} found</h2></div>
      <div class="grid">${search.results.map(pgCard).join("")}</div>`;
  }

  const summaryBits = [
    f.gender !== "any" ? esc((GENDER_FILTERS.find(function (g) { return g[0] === f.gender; }) || [])[1] || "") : "Anyone",
    f.roomType !== "any" ? esc((ROOM_FILTERS.find(function (r) { return r[0] === f.roomType; }) || [])[1] || "") : "Any room",
    (f.minRent || f.maxRent) ? "Budget " + (f.minRent ? formatINR(f.minRent) : "any") + " to " + (f.maxRent ? formatINR(f.maxRent) : "any") : "Any budget"
  ];

  $app().innerHTML = `<div class="container with-sticky">
    <div class="search-head">
      <div><h1>Your search</h1><p class="muted">${summaryBits.join(" · ")}</p></div>
    </div>
    <form class="searchbar searchbar-inline" data-submit="searchText" novalidate>
      <div class="sb-field">
        <label for="searchText">Search</label>
        <input id="searchText" list="areaList2" data-input="searchText" value="${esc(f.q)}" placeholder="Area, PG name, or what you need: AC under 20k" autocomplete="off">
        <datalist id="areaList2">${AREAS.map(function (a) { return `<option value="${a.name}">`; }).join("")}${PGS.map(function (g) { return `<option value="${esc(g.name)}">`; }).join("")}</datalist>
      </div>
      <div class="sb-actions"><button type="submit" class="btn btn-primary">${icon("search")} Search</button></div>
    </form>
    ${search.parsed && search.parsed.notes.length ? `<p class="caption understood">Understood: ${search.parsed.notes.map(function (n) { return `<span class="tag">${esc(n)}</span>`; }).join(" ")}${search.parsed.words.length ? ` <span class="tag">${esc(search.parsed.words.join(" "))}</span>` : ""}</p>` : ""}
    <div class="filter-bar" aria-label="Filters">
      <div class="field"><label for="sRoom">Room type</label>
        <select class="input" id="sRoom" data-change="searchRoom">${optionsHtml(ROOM_FILTERS.map(function (r) { return [r[0], r[1]]; }), f.roomType)}</select></div>
      <div class="field"><label for="sGender">Who is it for</label>
        <select class="input" id="sGender" data-change="searchGender">${optionsHtml(GENDER_FILTERS, f.gender)}</select></div>
      <div class="field"><label for="sBudget">Budget</label>
        <select class="input" id="sBudget" data-change="searchBudget">${optionsHtml(budgetOptions, budgetValue)}</select></div>
      <div class="field"><label for="sSort">Sort by</label>
        <select class="input" id="sSort" data-change="searchSort">${optionsHtml([["relevance", "Recommended"], ["rent", "Rent: low to high"]], f.sort)}</select></div>
      <div class="field wide"><span class="label">Must-have amenities</span><div class="chips scroll">${amenityChips}</div></div>
      <div class="wide"><button class="btn btn-text" data-action="searchReset">Reset filters</button></div>
    </div>
    ${body}
  </div>`;
}

// Typing in the search box on the results page. Pressing Search puts the text in the address.
let searchTextDraft = null;
Inputs.searchText = function (el) { searchTextDraft = el.value; };
Actions.searchText = function () {
  const text = (searchTextDraft != null ? searchTextDraft : search.filters.q).trim();
  searchTextDraft = null;
  track("search_text_submitted", { q: text });
  updateSearch({ q: text }, "text");
};

// Changing a filter changes the ADDRESS. The router sees the new address, reads the filters and fetches again.
function updateSearch(patch, eventName) {
  const next = Object.assign({}, search.filters, patch);
  track("filter_changed", { filter: eventName });
  replaceRoute("/search?" + toQuery(next));
}
Changes.searchRoom = function (el) { updateSearch({ roomType: el.value }, "roomType"); };
Changes.searchGender = function (el) { updateSearch({ gender: el.value }, "gender"); };
Changes.searchSort = function (el) { updateSearch({ sort: el.value }, "sort"); };
Changes.searchBudget = function (el) {
  const i = Number(el.value);
  if (i === 0) updateSearch({ minRent: "", maxRent: "" }, "budget");
  else updateSearch({ minRent: BUDGET_PRESETS[i - 1][1], maxRent: BUDGET_PRESETS[i - 1][2] }, "budget");
};
Actions.searchAmenity = function (el) {
  const a = el.dataset.value;
  const list = search.filters.amenities.slice();
  const i = list.indexOf(a);
  if (i >= 0) list.splice(i, 1); else list.push(a);
  updateSearch({ amenities: list }, "amenities");
};
Actions.searchClearAmenities = function () { updateSearch({ amenities: [] }, "amenities"); };
Actions.searchReset = function () {
  updateSearch({ minRent: "", maxRent: "", roomType: "any", gender: "any", amenities: [], sort: "relevance" }, "reset");
};

// ======================================================================
// PG DETAIL  (#/pg/:id)
// State: data, loading, error, notFound, selectedRoomId, photos (from Google), modalIndex
// ======================================================================
const pdp = { id: null, data: null, loading: true, error: null, notFound: false, selectedRoomId: null, photos: null, modalIndex: null };

async function PdpPage(ctx) {
  const id = ctx.params.id;
  if (String(pdp.id) !== String(id)) { pdp.selectedRoomId = null; }
  pdp.id = id;
  pdp.data = null; pdp.loading = true; pdp.error = null; pdp.notFound = false; pdp.photos = null; pdp.modalIndex = null;
  setRerender(renderPdp);
  renderPdp();

  try {
    const data = await apiGetPg(id, ctx.query);
    if (ctx.isStale()) return;
    if (!data) { pdp.notFound = true; } else {
      pdp.data = data;
      track("pg_opened", { pgId: data.pg.id });
    }
    pdp.loading = false;
  } catch (err) {
    if (ctx.isStale()) return;
    pdp.loading = false;
    pdp.error = "We couldn't load this place right now.";
  }
  renderPdp();
  if (pdp.data) loadPhotos(ctx);
}

// Photos and reviews load separately, AFTER the page is shown, so a slow Google call never blocks the page.
async function loadPhotos(ctx) {
  pdp.photos = null;
  renderPdp();
  const data = await apiGetPgPhotos(pdp.data.pg.id);
  if (ctx.isStale()) return;
  pdp.photos = data;
  track("photos_loaded", { pgId: pdp.data.pg.id, status: data.status });
  renderPdp();
}

function amenityRow(name, status) {
  if (status === "y") return `<span class="amenity">${icon("check")}${esc(name)}</span>`;
  if (status === "n") return `<span class="amenity not">${icon("x")}${esc(name)} <span class="caption">Not included</span></span>`;
  return `<span class="amenity unknown">${icon("alert")}${esc(name)} <span class="caption">Details being verified</span></span>`;
}

function googleReviewsHtml(photos) {
  if (!photos) return `<div class="skeleton" style="height:80px"></div>`;
  if (photos.status === "not_configured") {
    return `<div class="state"><p style="margin:0">Reviews from ${REVIEW_SOURCE} will appear here once Homli is connected to Google. No reviews are shown until then.</p></div>`;
  }
  if (photos.status === "api_error") {
    return `<div class="state"><p style="margin:0">Reviews couldn't be loaded right now.</p></div>`;
  }
  if (!photos.reviews || photos.reviews.length === 0) {
    return `<div class="state"><p style="margin:0">No reviews found on ${REVIEW_SOURCE} yet.</p></div>`;
  }
  return `<p class="row" style="margin-bottom:12px">${googleRatingHtml(photos)}</p>` + photos.reviews.map(function (r) {
    return `<article class="card review-card"><div class="row between"><strong>${esc(r.author)}</strong><span class="caption">${esc(r.when || "")}</span></div>
      <p class="caption">${r.rating} out of 5 · Review from ${REVIEW_SOURCE}</p><p>${esc(r.text || "")}</p></article>`;
  }).join("");
}

function renderPdp() {
  const back = `<a class="back-link" href="${backToResultsHref()}">${icon("back")} Back to results</a>`;
  if (pdp.loading) { $app().innerHTML = `<div class="container">${back}${pageSkeleton()}</div>`; return; }
  if (pdp.error) {
    $app().innerHTML = `<div class="container">${back}${errorState("Something went wrong", pdp.error, `<button class="btn btn-primary" data-action="retryRoute">Try again</button>`)}</div>`;
    return;
  }
  if (pdp.notFound) {
    $app().innerHTML = `<div class="container">${back}${emptyState("We couldn't find this place.", "The link may be wrong, or the place may have been removed.", `<a class="btn btn-primary" href="#/">Back to search</a>`)}</div>`;
    return;
  }

  const d = pdp.data, pg = d.pg;

  // Room options. A room with an unknown price can't be selected.
  const rooms = d.rooms.map(function (r) {
    const known = r.monthlyRent != null;
    const selected = pdp.selectedRoomId === r.id;
    return `<button class="room-card" data-action="selectRoom" data-id="${r.id}" aria-pressed="${selected}" ${known ? "" : "disabled"}>
      <strong>${esc(r.label)}</strong>
      <span class="room-price">${priceText(r)}<small class="caption">${known ? " /month" : ""}</small></span>
      ${r.priceKind === "exact" ? `<span class="caption">≈ ${formatINR(perDay(r.monthlyRent))}/day</span>` : ""}
      ${r.inclusions.length ? `<span class="caption">${esc(r.inclusions.join(" · "))}</span>` : ""}
      <span class="badge neutral" style="align-self:flex-start;margin-top:4px">${known ? "Check availability with the PG" : "Price being verified"}</span>
      ${selected ? `<span class="badge good" style="align-self:flex-start">${icon("check")}Selected</span>` : ""}
    </button>`;
  }).join("");

  const amenities = AMENITIES.map(function (a) { return amenityRow(a, pg.amenities[a]); }).join("");

  const saved = Store.isShortlisted(pg.id);
  const inCompare = Store.isInCompare(pg.id);
  const compareFull = !inCompare && Store.getCompare().length >= MAX_COMPARE;
  const room = d.rooms.find(function (r) { return r.id === pdp.selectedRoomId; });
  const mapsQuery = encodeURIComponent(pg.name + " " + pg.area + " Bengaluru");

  $app().innerHTML = `<div class="container with-sticky">
    ${back}
    <div class="pdp-grid">
      <div>
        <h1>${esc(pg.name)}</h1>
        <p class="muted" style="margin:4px 0 12px">${esc(pg.area)}${pg.gender ? " · " + esc(pg.gender) : ""}</p>
        <div class="row">${sourceBadge(pg.sourceType)} ${googleRatingHtml(pdp.photos)}</div>
        <p style="margin-top:16px">${esc(pg.notes)}</p>
      </div>
      <div class="card pdp-price" style="padding:16px">
        ${priceBlock(pg.startingRoom, pg.startingRoom ? pg.startingRoom.label : "")}
        <p class="caption" style="margin-top:4px">Lowest price we know. Choose a room below.</p>
      </div>
    </div>

    <section class="pdp-section"><h2>Photos</h2>${galleryHtml(photosFor(pg.id, pdp.photos))}</section>
    <section class="pdp-section"><h2>Choose a room</h2><div class="rooms">${rooms}</div>
      <div class="card terms" style="margin-top:var(--s3)">
        <div><span class="label">Deposit</span><p>${esc(pg.deposit)}</p></div>
        <div><span class="label">Lock-in period</span><p>${esc(pg.lockIn)}</p></div>
      </div>
      <p class="caption" style="margin-top:8px">Prices and terms come from the source below and may have changed. Confirm with the PG before paying anything.</p></section>
    <section class="pdp-section"><h2>Amenities</h2><div class="amenity-list">${amenities}</div></section>
    <section class="pdp-section"><h2>Reviews</h2>${googleReviewsHtml(pdp.photos)}</section>
    <section class="pdp-section"><h2>Source and location</h2>
      <div class="card" style="padding:16px"><p>${icon("pin")} ${esc(pg.area)}, Bengaluru</p>
        <p class="caption" style="margin:8px 0">Information source: ${esc(SOURCE_LABELS[pg.sourceType])}.</p>
        <div class="row">
          ${pg.sourceUrl ? `<a class="btn" target="_blank" rel="noopener" href="${esc(pg.sourceUrl)}">View source page</a>` : ""}
          <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${mapsQuery}">Open in Google Maps</a>
        </div></div>
    </section>
  </div>

  <div class="sticky-bar"><div class="container">
    <span class="row">
      <button class="icon-btn ${saved ? "on" : ""}" style="border:1px solid var(--sand)" data-action="toggleShortlist" data-id="${pg.id}" aria-pressed="${saved}" aria-label="${saved ? "Remove from" : "Add to"} shortlist">${icon("heart")}</button>
      <button class="chip" aria-pressed="${inCompare}" data-action="toggleCompare" data-id="${pg.id}" ${compareFull ? "disabled" : ""}>${inCompare ? "In compare" : "Compare"}</button>
      ${compareFull ? `<span class="caption">You can compare up to 3 places.</span>` : ""}
    </span>
    <span class="row">
      ${room ? `<span class="caption">${esc(room.label)} · ${priceText(room)}/month</span>` : `<span class="caption">Select a room to continue.</span>`}
      <button class="btn btn-primary" data-action="continueBooking" ${room ? "" : "disabled"}>Request a visit (demo)</button>
    </span>
  </div></div>
  ${(function () { const g = photosFor(pg.id, pdp.photos); return pdp.modalIndex != null && g && g.photos[pdp.modalIndex] ? photoModalHtml(g, pdp.modalIndex) : ""; })()}`;
}

Actions.selectRoom = function (el) { pdp.selectedRoomId = Number(el.dataset.id); renderPdp(); };
Actions.openPhoto = function (el) { pdp.modalIndex = Number(el.dataset.index); track("photo_opened", { pgId: pdp.data.pg.id }); renderPdp(); };
Actions.closePhoto = function (el, e) { if (e && e.target !== el) return; pdp.modalIndex = null; renderPdp(); };
Actions.photoStep = function (el) {
  const n = photosFor(pdp.data.pg.id, pdp.photos).photos.slice(0, 3).length;
  pdp.modalIndex = (pdp.modalIndex + Number(el.dataset.step) + n) % n;
  renderPdp();
};
Actions.retryPhotos = function () { delete photoCache[pdp.data.pg.id]; loadPhotos({ isStale: function () { return false; } }); };
Actions.continueBooking = function () {
  const d = pdp.data;
  const room = d.rooms.find(function (r) { return r.id === pdp.selectedRoomId; });
  if (!room) return;
  Store.setCart({
    requestId: "req-" + Date.now() + "-" + Math.floor(Math.random() * 100000),
    pgId: d.pg.id, roomTypeId: room.id, pgName: d.pg.name, area: d.pg.area,
    roomLabel: room.label, priceLabel: priceText(room), deposit: d.pg.deposit
  });
  track("booking_started", { pgId: d.pg.id, roomTypeId: room.id });
  navigate("/booking/cart");
};
