// booking.js: Cart -> Details -> Review -> Success.
// A learning flow with a fake server. No real payment happens.
// Each step needs the one before it. If you open a later step directly, the page sends you back (a "route guard").

function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function stepsHtml(current) {
  const names = ["Room", "Details", "Review", "Done"];
  return `<div class="steps" aria-label="Booking steps">${names.map(function (n, i) {
    const cls = i < current ? "done" : i === current ? "current" : "";
    return `<span class="step ${cls}">${i + 1}. ${n}</span>`;
  }).join("")}</div>`;
}

// The price box shown on the cart and review pages.
function summaryHtml(cart, button) {
  return `<aside class="card summary" aria-label="Price summary">
    <h3 style="margin-bottom:12px">Price summary</h3>
    <div class="summary-line"><span>Monthly rent</span><span>${esc(cart.priceLabel)}</span></div>
    <div class="summary-line"><span>Deposit</span><span style="text-align:right">${esc(cart.deposit)}</span></div>
    <div class="summary-line total"><span>Due now <span class="caption">(demo)</span></span><span>${formatINR(0)}</span></div>
    <p class="demo-note">This is a demo. Nothing is sent to the PG and no payment is taken. Prices come from public sources and must be confirmed with the PG.</p>
    ${button || ""}
  </aside>`;
}

// ======================================================================
// CART  (#/booking/cart)
// State: cart (saved in localStorage so it survives a refresh)
// ======================================================================
async function CartPage(ctx) {
  setRerender(null);
  const cart = Store.getCart();
  if (!cart) {
    $app().innerHTML = `<div class="container">${stepsHtml(0)}${emptyState("Your booking is empty.", "Choose a room on a place's page to start.", `<a class="btn btn-primary" href="#/">Explore PGs</a>`)}</div>`;
    return;
  }
  $app().innerHTML = `<div class="container">${stepsHtml(0)}${pageSkeleton()}</div>`;
  try {
    const d = await apiGetPg(cart.pgId, ctx.query);
    if (ctx.isStale()) return;
    const room = d ? d.rooms.find(function (r) { return r.id === cart.roomTypeId; }) : null;
    if (!d || !room || room.monthlyRent == null) {
      $app().innerHTML = `<div class="container">${stepsHtml(0)}${emptyState("This room option is no longer available.", "Please choose another room.", `<a class="btn btn-primary" href="#/pg/${cart.pgId}">Choose another room</a>`)}</div>`;
      return;
    }
    $app().innerHTML = `<div class="container">${stepsHtml(0)}
      <h1 style="margin-bottom:16px">Your visit request (demo)</h1>
      <div class="booking-layout">
        <div class="card">
          <div class="card-media tone${cart.pgId % 4}" style="height:120px">${icon("home")}</div>
          <div class="card-body">
            <h2>${esc(cart.pgName)}</h2>
            <p class="caption">${esc(cart.area)}</p>
            <p><strong>${esc(cart.roomLabel)}</strong> · ${esc(cart.priceLabel)} per month · Deposit ${esc(cart.deposit)}</p>
            <div>${amenityTags(d.pg.amenities, 6)}</div>
            <div class="card-actions">
              <button class="btn" data-action="editRoom">Edit room</button>
              <button class="btn btn-text" data-action="removeCart">Remove</button>
            </div>
          </div>
        </div>
        ${summaryHtml(cart, `<a class="btn btn-primary btn-block" style="margin-top:16px" href="#/booking/details">Continue</a>`)}
      </div></div>`;
  } catch (err) {
    if (ctx.isStale()) return;
    $app().innerHTML = `<div class="container">${stepsHtml(0)}${errorState("Something went wrong", "We couldn't load your booking right now.", `<button class="btn btn-primary" data-action="retryRoute">Try again</button>`)}</div>`;
  }
}
Actions.editRoom = function () { const c = Store.getCart(); if (c) navigate("/pg/" + c.pgId); };
Actions.removeCart = function () { Store.clearCart(); track("cart_removed"); renderRoute({ keepScroll: true }); };

// ======================================================================
// DETAILS  (#/booking/details)
// State: values, touched. The form values are saved as you type, so a refresh keeps them.
// ======================================================================
const details = {
  values: { fullName: "", phone: "", email: "", moveInDate: "", expectedDuration: "6 months", note: "" },
  touched: {}
};
const DETAIL_FIELDS = ["fullName", "phone", "email", "moveInDate", "expectedDuration"];

// Check the form. Returns an object like { phone: "Enter a 10-digit mobile number." }
function validateDetails(v) {
  const e = {};
  if (!v.fullName || v.fullName.trim().length < 2) e.fullName = "Enter your full name.";
  if (!/^[6-9]\d{9}$/.test(v.phone || "")) e.phone = "Enter a 10-digit Indian mobile number.";
  if (!/^\S+@\S+\.\S+$/.test(v.email || "")) e.email = "Enter a valid email address.";
  if (!v.moveInDate) e.moveInDate = "Choose your move-in date.";
  else if (v.moveInDate < todayISO()) e.moveInDate = "Move-in date can't be in the past.";
  if (!v.expectedDuration) e.expectedDuration = "Choose how long you plan to stay.";
  return e;
}

function DetailsPage(ctx) {
  setRerender(null);
  const cart = Store.getCart();
  if (!cart) { redirect("/booking/cart"); return; }
  const saved = Store.getDetails();
  if (saved) details.values = Object.assign({}, details.values, saved);
  details.touched = {};

  const v = details.values;
  const field = function (name, label, inputHtml) {
    return `<div class="field"><label for="d-${name}">${label}</label>${inputHtml}<div class="field-error" id="err-${name}"></div></div>`;
  };
  $app().innerHTML = `<div class="container">${stepsHtml(1)}
    <h1 style="margin-bottom:16px">Your details</h1>
    <div class="booking-layout">
      <form class="card" style="padding:24px" data-submit="detailsNext" novalidate>
        <div class="stack">
          ${field("fullName", "Full name", `<input class="input" id="d-fullName" name="fullName" data-input="detail" autocomplete="name" value="${esc(v.fullName)}">`)}
          ${field("phone", "Phone number", `<input class="input" id="d-phone" name="phone" data-input="detail" inputmode="numeric" maxlength="10" autocomplete="tel" placeholder="10-digit mobile number" value="${esc(v.phone)}">`)}
          ${field("email", "Email", `<input class="input" id="d-email" name="email" data-input="detail" type="email" autocomplete="email" value="${esc(v.email)}">`)}
          ${field("moveInDate", "Move-in date", `<input class="input" id="d-moveInDate" name="moveInDate" data-input="detail" type="date" min="${todayISO()}" value="${esc(v.moveInDate)}">`)}
          ${field("expectedDuration", "Expected stay", `<select class="input" id="d-expectedDuration" name="expectedDuration" data-input="detail">${optionsHtml([["3 months", "3 months"], ["6 months", "6 months"], ["11 months", "11 months"], ["12+ months", "12+ months"]], v.expectedDuration)}</select>`)}
          <div class="field"><label for="d-note">Note for the owner (optional)</label><textarea class="input" id="d-note" name="note" data-input="detail">${esc(v.note)}</textarea></div>
          <div><button type="submit" class="btn btn-primary" id="detailsBtn">Review booking</button>
          <p class="caption" id="detailsHint" style="margin-top:8px"></p></div>
        </div>
      </form>
      ${summaryHtml(cart, "")}
    </div></div>`;
  updateDetailsUI();
}

// Update the error messages and the button WITHOUT redrawing the form, so the cursor stays where it is.
function updateDetailsUI() {
  const errors = validateDetails(details.values);
  DETAIL_FIELDS.forEach(function (name) {
    const show = details.touched[name] && errors[name];
    const errEl = document.getElementById("err-" + name);
    const input = document.getElementById("d-" + name);
    if (errEl) errEl.textContent = show ? errors[name] : "";
    if (input) input.classList.toggle("invalid", !!show);
  });
  const valid = Object.keys(errors).length === 0;
  const btn = document.getElementById("detailsBtn");
  const hint = document.getElementById("detailsHint");
  if (btn) btn.disabled = !valid;
  if (hint) hint.textContent = valid ? "" : "Fill in the required details to continue.";
}

Inputs.detail = function (el) {
  details.values[el.name] = el.value;
  Store.setDetails(details.values);
  updateDetailsUI();
};
Changes.detail = function (el) { details.touched[el.name] = true; updateDetailsUI(); };
Actions.detailsNext = function () {
  DETAIL_FIELDS.forEach(function (n) { details.touched[n] = true; });
  updateDetailsUI();
  if (Object.keys(validateDetails(details.values)).length) return;
  Store.setDetails(details.values);
  navigate("/booking/review");
};

// ======================================================================
// REVIEW  (#/booking/review)
// State: status ("idle", "confirming", "failed"), error
// ======================================================================
const bookingReview = { status: "idle", error: null, errorCode: null };

function ReviewPage(ctx) {
  setRerender(null);
  const cart = Store.getCart();
  if (!cart) { redirect("/booking/cart"); return; }
  const d = Store.getDetails();
  if (!d || Object.keys(validateDetails(d)).length) { redirect("/booking/details"); return; }
  bookingReview.status = "idle"; bookingReview.error = null; bookingReview.errorCode = null;
  renderReview();
}

function renderReview() {
  const cart = Store.getCart();
  const d = Store.getDetails();
  if (!cart || !d) return;
  const confirming = bookingReview.status === "confirming";
  let errorBox = "";
  if (bookingReview.status === "failed") {
    const gone = bookingReview.errorCode === "ROOM_GONE" || bookingReview.errorCode === "ROOM_FULL";
    errorBox = `<div class="form-error-banner" role="alert"><strong>We couldn't complete your booking.</strong> ${esc(bookingReview.error)}
      ${gone ? `<div style="margin-top:8px"><a class="btn" href="#/pg/${cart.pgId}">Back to the place</a></div>` : ""}</div>`;
  }
  $app().innerHTML = `<div class="container">${stepsHtml(2)}
    <h1 style="margin-bottom:16px">Review your booking</h1>
    ${errorBox}
    <div class="booking-layout">
      <div>
        <section class="card review-block"><h3>Place</h3><p><strong>${esc(cart.pgName)}</strong></p><p class="caption">${esc(cart.area)} · ${esc(cart.roomLabel)}</p></section>
        <section class="card review-block"><h3>Your details</h3><p>${esc(d.fullName)}</p><p class="caption">${esc(d.phone)} · ${esc(d.email)}</p></section>
        <section class="card review-block"><h3>Move-in</h3><p>${esc(d.moveInDate)}</p><p class="caption">Staying ${esc(d.expectedDuration)}</p>${d.note ? `<p class="caption">Note: ${esc(d.note)}</p>` : ""}</section>
        <div class="row" style="margin-top:16px"><a class="btn" href="#/booking/details">Edit details</a></div>
      </div>
      ${summaryHtml(cart, `<button class="btn btn-primary btn-block" style="margin-top:16px" data-action="confirmBooking" ${confirming ? "disabled" : ""}>${confirming ? "Confirming your booking…" : bookingReview.status === "failed" ? "Try again" : "Confirm booking"}</button>`)}
    </div></div>`;
}

// Confirm: send the booking to the (fake) server. Ignore extra clicks while it is working.
Actions.confirmBooking = async function () {
  if (bookingReview.status === "confirming") return;
  const cart = Store.getCart();
  const d = Store.getDetails();
  bookingReview.status = "confirming"; bookingReview.error = null;
  renderReview();
  try {
    const booking = await apiCreateBooking({
      requestId: cart.requestId, pgId: cart.pgId, roomTypeId: cart.roomTypeId, pgName: cart.pgName, roomLabel: cart.roomLabel,
      priceLabel: cart.priceLabel, deposit: cart.deposit,
      fullName: d.fullName, phone: d.phone, email: d.email, moveInDate: d.moveInDate,
      expectedDuration: d.expectedDuration, note: d.note
    }, currentQuery);
    track("booking_confirmed", { bookingId: booking.id });
    Store.clearCart();
    Store.clearDetails();
    navigate("/booking/success/" + booking.id);
  } catch (err) {
    // Do NOT clear the cart or the form: the user must not lose anything on a failure.
    bookingReview.status = "failed";
    bookingReview.errorCode = err.code || "";
    bookingReview.error = err.code === "VALIDATION" ? "Some of your details look invalid. Please edit them."
      : err.code ? err.message : "Something went wrong on our side. Your details are saved, so you can try again.";
    track("booking_failed", { code: err.code || "unknown" });
    renderReview();
  }
};

// ======================================================================
// SUCCESS  (#/booking/success/:bookingId)
// ======================================================================
async function SuccessPage(ctx) {
  setRerender(null);
  $app().innerHTML = `<div class="container">${pageSkeleton()}</div>`;
  try {
    const b = await apiGetBooking(ctx.params.bookingId);
    if (ctx.isStale()) return;
    if (!b) {
      $app().innerHTML = `<div class="container">${emptyState("We couldn't find this booking.", "Check the link, or start a new search.", `<a class="btn btn-primary" href="#/">Back to Homli</a>`)}</div>`;
      return;
    }
    $app().innerHTML = `<div class="container">${stepsHtml(4)}
      ${successState("Demo request saved.", "It is saved on this device only. Nothing was sent to the PG.", "")}
      <section class="card review-block" style="margin-top:16px">
        <h3>Booking ${esc(b.id)}</h3>
        <p><strong>${esc(b.pgName)}</strong> · ${esc(b.roomLabel)}</p>
        <p class="caption">Move-in ${esc(b.moveInDate)} · ${esc(b.expectedDuration)}</p>
        <p class="caption">Rent ${esc(b.priceSnapshot)} · Deposit ${esc(b.depositSnapshot)}</p>
        <p class="caption" style="margin-top:8px">This is a prototype: the PG has not received anything, so no one will contact you. To visit, contact the PG using its source page.</p>
      </section>
      <div class="row" style="margin-top:16px"><a class="btn btn-primary" href="#/">Back to Homli</a></div>
    </div>`;
  } catch (err) {
    if (ctx.isStale()) return;
    $app().innerHTML = `<div class="container">${errorState("Something went wrong", "We couldn't load this booking right now.", `<button class="btn btn-primary" data-action="retryRoute">Try again</button>`)}</div>`;
  }
}
