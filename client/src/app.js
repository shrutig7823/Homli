// app.js: the router and the event wiring. It runs last.
//
// ROUTING: the address after the # decides which page to show, for example #/search?location=HSR.
// Whenever the address changes, renderRoute() reads it, finds the matching page and calls it.

let routeToken = 0;       // goes up on every navigation, so a slow old request can't overwrite a newer page
let currentPath = "/";
let showCompareBar = false;

// Each route: a pattern for the path, the names of the :parameters in it, the page function,
// and whether the sticky compare bar should show.
const ROUTES = [
  { re: /^\/$/, keys: [], page: HomePage, bar: false },
  { re: /^\/search$/, keys: [], page: SearchPage, bar: true },
  { re: /^\/pg\/([^/]+)$/, keys: ["id"], page: PdpPage, bar: false },
  { re: /^\/shortlist$/, keys: [], page: ShortlistPage, bar: true },
  { re: /^\/compare$/, keys: [], page: ComparePage, bar: false },
  { re: /^\/booking\/cart$/, keys: [], page: CartPage, bar: false },
  { re: /^\/booking\/details$/, keys: [], page: DetailsPage, bar: false },
  { re: /^\/booking\/review$/, keys: [], page: ReviewPage, bar: false },
  { re: /^\/booking\/success\/([^/]+)$/, keys: ["bookingId"], page: SuccessPage, bar: false }
];

// Read the address: "#/search?location=HSR&radius=3" becomes path "/search" and query { location: "HSR", radius: "3" }.
function parseHash() {
  const raw = location.hash.slice(1) || "/";
  const q = raw.indexOf("?");
  const path = q >= 0 ? raw.slice(0, q) : raw;
  const query = {};
  new URLSearchParams(q >= 0 ? raw.slice(q + 1) : "").forEach(function (value, key) { query[key] = value; });
  return { path: path, query: query };
}

function navigate(path) { location.hash = "#" + path; }                                   // adds a history step (Back works)
function replaceRoute(path) { history.replaceState(null, "", "#" + path); renderRoute({ keepScroll: true }); }  // no new history step
function redirect(path) { history.replaceState(null, "", "#" + path); renderRoute(); }    // used by the booking guards

// Redraw the header (with its count badges) and the sticky compare bar.
function renderChrome() {
  document.getElementById("header").innerHTML = headerHtml(currentPath);
  document.getElementById("sticky-host").innerHTML = showCompareBar ? compareBarHtml() : "";
}

function renderRoute(opts) {
  opts = opts || {};
  const parsed = parseHash();
  currentPath = parsed.path;
  currentQuery = parsed.query;
  const token = ++routeToken;
  const ctx = { query: parsed.query, params: {}, isStale: function () { return token !== routeToken; } };
  setRerender(null);

  const route = ROUTES.find(function (r) { return r.re.test(parsed.path); });
  if (!route) {
    showCompareBar = false;
    renderChrome();
    $app().innerHTML = `<div class="container">${emptyState("We couldn't find that page.", "The address may be wrong.", `<a class="btn btn-primary" href="#/">Back to Homli</a>`)}</div>`;
    return;
  }
  const match = parsed.path.match(route.re);
  route.keys.forEach(function (key, i) { ctx.params[key] = decodeURIComponent(match[i + 1]); });
  showCompareBar = route.bar;
  renderChrome();
  if (!opts.keepScroll) window.scrollTo(0, 0);
  Promise.resolve(route.page(ctx)).catch(function (err) { console.error(err); });
}

// ---------- Event wiring ----------
// Pages are redrawn often, so instead of attaching a listener to every button, we listen once on the
// whole document and look at which element was used (this is called event delegation).
document.addEventListener("click", function (e) {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const fn = Actions[el.dataset.action];
  if (fn) fn(el, e);
});
document.addEventListener("input", function (e) {
  const el = e.target.closest("[data-input]");
  if (el && Inputs[el.dataset.input]) Inputs[el.dataset.input](el, e);
});
document.addEventListener("change", function (e) {
  const el = e.target.closest("[data-change]");
  if (el && Changes[el.dataset.change]) Changes[el.dataset.change](el, e);
});
document.addEventListener("focusout", function (e) {
  const el = e.target.closest('[data-input="detail"]');
  if (el && Changes.detail) Changes.detail(el, e);
});
document.addEventListener("submit", function (e) {
  const form = e.target.closest("[data-submit]");
  if (!form) return;
  e.preventDefault();
  Actions[form.dataset.submit](form, e);
});

window.addEventListener("hashchange", function () { renderRoute(); });
renderRoute();
