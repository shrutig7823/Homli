// lists.js: the Shortlist page, the Compare page, and the heart / compare buttons used on many pages.

// ---------- Buttons that appear on several pages ----------
// Heart: save or unsave a PG. We update the store, redraw the header badges, then redraw the current page.
Actions.toggleShortlist = function (el) {
  const id = Number(el.dataset.id);
  const nowSaved = Store.toggleShortlist(id);
  track(nowSaved ? "shortlist_added" : "shortlist_removed", { pgId: id });
  renderChrome();
  if (rerenderFn) rerenderFn();
};

// Compare: pick up to 3. A 4th is refused with a message.
Actions.toggleCompare = function (el) {
  const id = Number(el.dataset.id);
  const result = Store.toggleCompare(id);
  if (!result.ok) { showToast(result.reason); return; }
  track(result.added ? "compare_added" : "compare_removed", { pgId: id });
  renderChrome();
  if (rerenderFn) rerenderFn();
};

// Clicking anywhere on a PG card (or a compare column heading) opens its detail page.
Actions.openPg = function (el) { navigate("/pg/" + el.dataset.id); };

Actions.clearCompare = function () {
  writeStore(KEYS.compare, []);
  renderChrome();
  if (rerenderFn) rerenderFn();
};

// "Try again" on any error state: run the current route again.
Actions.retryRoute = function () { renderRoute({ keepScroll: true }); };

// ======================================================================
// SHORTLIST  (#/shortlist)
// State: items, loading, error. The list of saved ids itself lives in localStorage.
// ======================================================================
const shortlist = { items: [], loading: true, error: null };

async function ShortlistPage(ctx) {
  setRerender(renderShortlist);
  shortlist.error = null;
  const ids = Store.getShortlist();
  if (ids.length === 0) { shortlist.items = []; shortlist.loading = false; renderShortlist(); return; }
  shortlist.loading = true;
  renderShortlist();
  try {
    const items = await apiGetPgsByIds(ids, ctx.query);
    if (ctx.isStale()) return;
    shortlist.items = items;
    shortlist.loading = false;
  } catch (err) {
    if (ctx.isStale()) return;
    shortlist.loading = false;
    shortlist.error = "We couldn't load your saved places right now.";
  }
  renderShortlist();
}

function renderShortlist() {
  // Only show items that are STILL saved, so removing one updates the page immediately.
  const visible = shortlist.items.filter(function (i) { return Store.isShortlisted(i.id); });
  let body;
  if (shortlist.loading) body = skeletonCards(3);
  else if (shortlist.error) body = errorState("Something went wrong", shortlist.error, `<button class="btn btn-primary" data-action="retryRoute">Try again</button>`);
  else if (Store.getShortlist().length === 0 || visible.length === 0) body = emptyState("No places saved yet.", "Tap the heart on any place to keep it here.", `<a class="btn btn-primary" href="#/">Explore PGs</a>`);
  else body = `<div class="grid">${visible.map(pgCard).join("")}</div>`;

  $app().innerHTML = `<div class="container with-sticky">
    <div class="search-head"><div><h1>Your shortlist</h1><p class="muted">${Store.getShortlist().length} saved</p></div></div>
    ${body}
  </div>`;
}

// ======================================================================
// COMPARE  (#/compare)
// State: items, loading, error, priorities
// ======================================================================
const compare = { items: [], loading: true, error: null, priorities: [] };

// What the user can say matters to them, and which table rows each one lights up.
const PRIORITIES = [
  ["price", "Price", ["rent", "perday"]],
  ["food", "Food", ["food"]],
  ["ac", "AC", ["ac"]],
  ["wifi", "Wi-Fi", ["wifi"]],
  ["laundry", "Laundry", ["laundry"]]
];

async function ComparePage(ctx) {
  setRerender(renderCompare);
  compare.error = null;
  const ids = Store.getCompare();
  if (ids.length === 0) { compare.items = []; compare.loading = false; renderCompare(); return; }
  compare.loading = true;
  renderCompare();
  try {
    const items = await apiGetPgsByIds(ids, ctx.query);
    if (ctx.isStale()) return;
    compare.items = items;
    compare.loading = false;
    if (items.length >= 2) track("compare_opened", { count: items.length });
  } catch (err) {
    if (ctx.isStale()) return;
    compare.loading = false;
    compare.error = "We couldn't load the comparison right now.";
  }
  renderCompare();
}

function renderCompare() {
  const ids = Store.getCompare();
  const items = compare.items.filter(function (i) { return ids.includes(i.id); });
  let body;

  if (compare.loading) {
    body = pageSkeleton();
  } else if (compare.error) {
    body = errorState("Something went wrong", compare.error, `<button class="btn btn-primary" data-action="retryRoute">Try again</button>`);
  } else if (ids.length === 0 || items.length === 0) {
    body = emptyState("Add places to compare.", "Tap Compare on any place. You can compare up to 3.", `<a class="btn btn-primary" href="${backToResultsHref()}">Find places</a>`);
  } else if (items.length === 1) {
    body = emptyState("Add at least one more place.", items[0].name + " is selected. Pick another to see them side by side.", `<a class="btn btn-primary" href="${backToResultsHref()}">Find more places</a>`);
  } else {
    body = compareTableHtml(items);
  }

  const chips = PRIORITIES.map(function (p) {
    return `<button class="chip" aria-pressed="${compare.priorities.includes(p[0])}" data-action="comparePriority" data-key="${p[0]}">${p[1]}</button>`;
  }).join("");

  $app().innerHTML = `<div class="container">
    <div class="search-head"><div><h1>Compare</h1><p class="muted">Differences are highlighted. "Details being verified" means the source did not say. Homli does not pick a winner for you.</p></div></div>
    ${items.length >= 2 ? `<div class="stack"><div><span class="label">What matters most to you?</span><div class="chips" style="margin-top:8px">${chips}</div></div></div><div style="height:16px"></div>` : ""}
    ${body}
  </div>`;
}

function compareTableHtml(items) {
  const statusRow = function (key, label, amenity) {
    return { key: key, label: label, values: items.map(function (i) { return i.amenities[amenity]; }), status: true };
  };
  const rows = [
    { key: "rent", label: "Starting price / month", values: items.map(function (i) { return i.rent; }),
      show: function (v, item) { return priceText(item.startingRoom); }, best: "min" },
    { key: "perday", label: "≈ per day", values: items.map(function (i) { return i.startingRoom && i.startingRoom.priceKind === "exact" ? perDay(i.rent) : null; }),
      show: function (v) { return v == null ? "Not shown" : formatINR(v); }, best: "min" },
    { key: "rooms", label: "Room types", values: items.map(function (i) { return i.rooms.map(function (r) { return r.label; }).join(", "); }), show: esc },
    { key: "deposit", label: "Deposit", values: items.map(function (i) { return i.deposit; }), show: esc },
    { key: "lockin", label: "Lock-in period", values: items.map(function (i) { return i.lockIn; }), show: esc },
    statusRow("food", "Food", "Food"),
    statusRow("ac", "AC", "AC"),
    statusRow("wifi", "Wi-Fi", "Wi-Fi"),
    statusRow("laundry", "Laundry", "Laundry"),
    statusRow("housekeeping", "Housekeeping", "Housekeeping"),
    { key: "source", label: "Source", values: items.map(function (i) { return i.sourceType; }), show: function (v) { return SOURCE_LABELS[v]; } }
  ];

  const prioKeys = [];
  PRIORITIES.forEach(function (p) { if (compare.priorities.includes(p[0])) p[2].forEach(function (k) { prioKeys.push(k); }); });

  const head = `<thead><tr class="head-row"><th></th>${items.map(function (i) {
    return `<th class="clickable" data-action="openPg" data-id="${i.id}"><a href="#/pg/${i.id}"><strong>${esc(i.name)}</strong></a><div class="caption">${esc(i.area)}</div>
      <button class="btn btn-text" style="padding-left:0" data-action="toggleCompare" data-id="${i.id}">Remove</button></th>`;
  }).join("")}</tr></thead>`;

  const bodyRows = rows.map(function (r) {
    const differs = new Set(r.values.map(String)).size > 1;
    let bestValue = null;
    if (differs && r.best) {
      const nums = r.values.filter(function (v) { return v != null; });
      if (nums.length) bestValue = r.best === "min" ? Math.min.apply(null, nums) : Math.max.apply(null, nums);
    }
    const cells = r.values.map(function (v, idx) {
      if (r.status) return `<td class="${v === "y" ? "yes" : "no"}">${v === "y" ? "Yes" : v === "n" ? "No" : "Details being verified"}</td>`;
      return `<td class="${bestValue !== null && v === bestValue ? "best" : ""}">${r.show(v, items[idx])}</td>`;
    }).join("");
    const cls = (differs ? "differs " : "") + (prioKeys.includes(r.key) ? "priority" : "");
    return `<tr class="${cls}"><th>${esc(r.label)}</th>${cells}</tr>`;
  }).join("");

  return `<div class="table-wrap"><table class="compare-table ${prioKeys.length ? "has-priority" : ""}">${head}<tbody>${bodyRows}</tbody></table></div>`;
}

Actions.comparePriority = function (el) {
  const key = el.dataset.key;
  const i = compare.priorities.indexOf(key);
  if (i >= 0) compare.priorities.splice(i, 1); else compare.priorities.push(key);
  renderCompare();
};
