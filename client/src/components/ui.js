// ui.js: small reusable pieces. Each function returns a piece of HTML as text.
// Pages combine these pieces, so every button, card and state looks the same everywhere.
// Backtick strings like `Hello ${name}` let us put values inside text with ${ }.

// Registries: pages plug their click, typing and change handlers in here, and app.js calls them.
// An element with data-action="toggleShortlist" runs Actions.toggleShortlist when clicked.
const Actions = {};   // clicks
const Inputs = {};    // typing (does NOT redraw the page, so the cursor never jumps)
const Changes = {};   // select boxes and other "finished changing" events
let currentQuery = {};  // the ?key=value part of the current address
let rerenderFn = null;  // how to redraw the current page from its state, without fetching again
function setRerender(fn) { rerenderFn = fn; }

// Make user-typed text safe to put inside HTML.
function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function formatINR(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
function perDay(rent) { return Math.round(rent / 30); }

// How to show a room's price. Follows the data rules: exact, range (never averaged), "From", or unknown.
function priceText(r) {
  if (!r || r.monthlyRent == null) return "Check availability";
  if (r.priceKind === "range") return formatINR(r.monthlyRent) + "–" + formatINR(r.rentMax);
  if (r.priceKind === "from") return "From " + formatINR(r.monthlyRent);
  return formatINR(r.monthlyRent);
}

// ---------- Icons (one family: simple outline icons) ----------
const ICONS = {
  heart: '<path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6.6 5.4 5.4 0 0 1 21.3 12C19 16.4 12 21 12 21z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  compare: '<rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="14" rx="1.5"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  check: '<path d="M5 12l4 4 10-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'
};
function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

// ---------- Header ----------
// Reads the shortlist and compare counts from the store, so it must be redrawn when they change.
function headerHtml(path) {
  const shortlistCount = Store.getShortlist().length;
  const compareCount = Store.getCompare().length;
  const link = function (href, label, ico, active, badge, action) {
    return `<a href="${href}" class="${active ? "active" : ""}" ${action ? `data-action="${action}"` : ""}>${icon(ico)}<span class="nav-label">${label}</span>${badge ? `<span class="badge-count">${badge}</span>` : ""}</a>`;
  };
  return `<div class="container">
    <a class="logo" href="#/">Homli</a>
    <nav class="nav" aria-label="Main">
      ${link("#/", "Search", "search", path === "/" || path === "/search", "", "goSearch")}
      ${link("#/shortlist", "Shortlist", "heart", path === "/shortlist", shortlistCount || "")}
      ${link("#/compare", "Compare", "compare", path === "/compare", compareCount ? compareCount + "/" + MAX_COMPARE : "")}
    </nav>
  </div>`;
}

// ---------- Small pieces ----------
function sourceBadge(type) {
  return `<span class="badge ${type}">${SOURCE_LABELS[type] || ""}</span>`;
}

function priceBlock(room, roomLabel) {
  if (!room || room.monthlyRent == null) {
    return `<div class="price-block"><div class="price price-unknown">Check availability</div><div class="caption">Price being verified</div></div>`;
  }
  const perDayLine = room.priceKind === "exact" ? `≈ ${formatINR(perDay(room.monthlyRent))}/day` : "";
  const bits = [perDayLine, roomLabel ? esc(roomLabel) : ""].filter(Boolean).join(" · ");
  return `<div class="price-block">
    <div class="price">${priceText(room)}<small>/month</small></div>
    <div class="caption">${bits}</div>
  </div>`;
}

// Tags for the amenities we have confirmed ("y"). Unknown ones are not shown as tags.
function amenityTags(amenities, max) {
  const list = AMENITIES.filter(function (a) { return amenities[a] === "y"; });
  if (list.length === 0) return `<span class="caption">Amenities being verified</span>`;
  const shown = list.slice(0, max || list.length);
  const more = list.length - shown.length;
  return shown.map(function (a) { return `<span class="tag">${esc(a)}</span>`; }).join(" ") +
    (more > 0 ? ` <span class="tag">+${more}</span>` : "");
}

// ---------- Google rating (only shown when the backend has returned it) ----------
function googleRatingHtml(data) {
  if (!data || data.rating == null) return "";
  return `<span class="rating">${icon("star")}${Number(data.rating).toFixed(1)}<span class="caption">(${data.reviewCount} on Google)</span></span>`;
}

// Card picture: the first Google photo if we already have it, otherwise a calm placeholder.
// Cards never trigger photo fetches by themselves (no bulk fetching): photos load on the detail page.
function localPhotos(id) {
  return (LOCAL_PHOTOS[id] || []).map(function (p) { return { url: p.file, largeUrl: p.file, author: p.credit, local: true, fit: p.fit || "" }; });
}
// The photos to show for a PG: our permitted local photos first, otherwise what Google returned.
function photosFor(id, googleData) {
  const own = localPhotos(id);
  if (own.length) return { status: "found", photos: own, local: true };
  return googleData;
}

function cardMediaInner(item) {
  const own = localPhotos(item.id);
  if (own.length) return `<img class="${own[0].fit}" src="${esc(own[0].url)}" alt="${esc(item.name)}" loading="lazy">`;
  const cached = photoCache[item.id];
  if (cached && cached.status === "found" && cached.photos.length) {
    return `<img src="${esc(cached.photos[0].url)}" alt="${esc(item.name)}" loading="lazy">`;
  }
  return icon("home");
}

// ---------- PG card (used on Home, Search and Shortlist) ----------
function pgCard(item) {
  const saved = Store.isShortlisted(item.id);
  const inCompare = Store.isInCompare(item.id);
  return `<article class="card pg-card" data-action="openPg" data-id="${item.id}">
    <div class="card-media tone${item.id % 4}">
      ${cardMediaInner(item)}
      <button class="icon-btn ${saved ? "on" : ""}" data-action="toggleShortlist" data-id="${item.id}" aria-pressed="${saved}" aria-label="${saved ? "Remove " : "Add "}${esc(item.name)} ${saved ? "from" : "to"} shortlist">${icon("heart")}</button>
      <span class="source">${sourceBadge(item.sourceType)}</span>
    </div>
    <div class="card-body">
      <div class="row between" style="align-items:flex-start;flex-wrap:nowrap">
        <div>
          <h3>${esc(item.name)}</h3>
          <p class="caption">${esc(item.area)}${item.gender ? " · " + esc(item.gender) : ""}${item.distanceKm != null ? " · about " + item.distanceKm + " km away" : ""}</p>
        </div>
        ${priceBlock(item.startingRoom, item.startingRoom ? item.startingRoom.label : "")}
      </div>
      <div>${amenityTags(item.amenities, 3)}</div>
      <div>${googleRatingHtml(photoCache[item.id]) || `<span class="caption">Reviews from ${REVIEW_SOURCE}</span>`}</div>
      <div class="card-actions">
        <a class="btn btn-primary" href="#/pg/${item.id}">View details</a>
        <button class="chip" aria-pressed="${inCompare}" data-action="toggleCompare" data-id="${item.id}">${inCompare ? "In compare" : "Compare"}</button>
      </div>
    </div>
  </article>`;
}

// ---------- Loading, empty, error, success states ----------
function skeletonCards(n) {
  let html = "";
  for (let i = 0; i < n; i++) {
    html += `<div class="card sk-card" aria-hidden="true"><div class="skeleton sk-media"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line short"></div><div class="skeleton sk-line"></div></div>`;
  }
  return `<div class="grid" role="status" aria-label="Loading">${html}</div>`;
}

function pageSkeleton() {
  return `<div role="status" aria-label="Loading"><div class="skeleton" style="height:180px;border-radius:20px"></div>
    <div class="skeleton" style="height:28px;width:50%;margin-top:16px"></div>
    <div class="skeleton" style="height:16px;margin-top:12px"></div>
    <div class="skeleton" style="height:16px;width:80%;margin-top:8px"></div></div>`;
}

// kind is "empty", "error" or "success". buttons is ready-made HTML.
function stateBox(kind, iconName, title, body, buttons) {
  return `<div class="state ${kind}" role="${kind === "error" ? "alert" : "status"}">
    <div class="state-icon">${icon(iconName)}</div>
    <h2>${esc(title)}</h2>
    <p>${esc(body)}</p>
    <div class="row">${buttons || ""}</div>
  </div>`;
}
function emptyState(title, body, buttons) { return stateBox("empty", "search", title, body, buttons); }
function errorState(title, body, buttons) { return stateBox("error", "alert", title, body, buttons); }
function successState(title, body, buttons) { return stateBox("success", "check", title, body, buttons); }

// ---------- Sticky compare bar and toast ----------
function compareBarHtml() {
  const n = Store.getCompare().length;
  if (n === 0) return "";
  return `<div class="sticky-bar"><div class="container">
    <span><strong>Compare (${n}/${MAX_COMPARE})</strong> <span class="caption">${n < 2 ? "Add one more place to compare." : "Ready to compare."}</span></span>
    <span class="row">
      <button class="btn btn-text" data-action="clearCompare">Clear</button>
      <a class="btn btn-primary" href="#/compare">Compare now</a>
    </span>
  </div></div>`;
}

function showToast(message) {
  const old = document.getElementById("toast");
  if (old) old.remove();
  const el = document.createElement("div");
  el.id = "toast";
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 2800);
}

// ---------- Photos (from Google Places, through the backend) ----------
// Shows 1 big photo + 2 small ones. Every photo carries its author credit, as Google requires.
function galleryHtml(data) {
  const status = data ? data.status : "loading";
  if (!data) return `<div class="skeleton" style="height:260px;border-radius:20px"></div>`;
  if (status === "found" && data.photos.length) {
    const ph = data.photos.slice(0, 3);
    const tile = function (p, i, cls) {
      return `<button class="gallery-tile ${cls}" data-action="openPhoto" data-index="${i}" aria-label="Open photo ${i + 1}">
        <img class="${p.fit || ""}" src="${esc(p.url)}" alt="Photo ${i + 1} of this PG" loading="lazy"></button>`;
    };
    return `<div class="gallery g${ph.length}">${ph.map(function (p, i) { return tile(p, i, i === 0 ? "hero-tile" : "small-tile"); }).join("")}</div>
      <p class="caption" style="margin-top:8px">${data.local ? "Photos used with the PG's permission. Tap a photo to see it larger." : "Photos from Google Maps. Tap a photo to see it larger with the photographer's credit."}</p>`;
  }
  const messages = {
    not_configured: ["Photos coming soon.", "Homli will show photos from Google Maps here."],
    no_photos: ["No photos found on Google Maps yet.", "Check the source link below, or ask the PG for photos."],
    place_id_needs_review: ["We couldn't confirm this place on Google Maps.", "We won't show photos until the match is checked."],
    api_error: ["Photos couldn't be loaded right now.", "Please try again in a moment."]
  };
  const m = messages[status] || messages.api_error;
  return `<div class="state photo-state"><div class="state-icon">${icon("camera")}</div><h3>${m[0]}</h3><p>${m[1]}</p>
    ${status === "api_error" ? `<button class="btn" data-action="retryPhotos">Try again</button>` : ""}</div>`;
}

// The big photo viewer (modal). index is which photo is open.
function photoModalHtml(data, index) {
  const p = data.photos[index];
  const credit = data.local ? `Photo: ${esc(p.author)}, used with permission` : null;
  const author = p.authorUri
    ? `<a href="${esc(p.authorUri)}" target="_blank" rel="noopener">${esc(p.author)}</a>`
    : esc(p.author || "a Google Maps contributor");
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="Photo viewer" data-action="closePhoto">
    <div class="modal-box">
      <img src="${esc(p.largeUrl || p.url)}" alt="Photo ${index + 1} of this PG">
      <div class="modal-bar">
        <span class="caption" style="color:#fff">${credit || `Photo by ${author} on Google Maps`}</span>
        <span class="row">
          ${data.photos.length > 1 ? `<button class="btn" data-action="photoStep" data-step="-1" aria-label="Previous photo">‹</button><button class="btn" data-action="photoStep" data-step="1" aria-label="Next photo">›</button>` : ""}
          <button class="btn" data-action="closePhoto">Close</button>
        </span>
      </div>
    </div>
  </div>`;
}
