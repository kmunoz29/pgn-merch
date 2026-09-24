(function () {
  const CONFIG = window.__PGN_CONFIG__ || {};
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  let order = [];

  /* ---- local storage: cart survives a refresh, orders are kept for lookup ---- */
  const CART_KEY = "pgn_cart_v1";
  const HIST_KEY = "pgn_orders_v1";

  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }
  function recall(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  // restore an in-progress cart
  const saved = recall(CART_KEY, []);
  if (Array.isArray(saved)) order = saved;

  /* ---- wire the email button ---- */
  const ideaBtn = $("#ideaBtn");
  if (ideaBtn && CONFIG.ideaUrl) ideaBtn.href = CONFIG.ideaUrl;

  const emailBtn = $("#emailBtn");
  if (emailBtn) emailBtn.href =
    "mailto:" + CONFIG.merchEmail + "?subject=" + encodeURIComponent("PGN Merch Question");

  /* ---- category filters ---- */
  $$(".chip").forEach(chip => {
    chip.onclick = () => {
      const cat = chip.dataset.cat;
      $$(".chip").forEach(c => c.classList.toggle("active", c === chip));
      $$(".card").forEach(card => {
        card.style.display = (cat === "All" || card.dataset.category === cat) ? "" : "none";
      });
    };
  });

  /* ---- image sliders (front / back) ---- */
  $$(".carousel").forEach(car => {
    const track = $(".slides", car);
    const total = track.children.length;
    if (total < 2) return;
    const dots   = $$(".dot", car);
    const label  = $(".car-label", car);
    const labels = Array.from(track.children).map(s => s.dataset.label || "");
    let idx = 0;
    const go = i => {
      idx = (i + total) % total;
      track.style.transform = `translateX(${-idx * 100}%)`;
      dots.forEach((d, di) => d.classList.toggle("active", di === idx));
      if (label) label.textContent = labels[idx] || "";
    };
    $$(".car-nav", car).forEach(b =>
      b.onclick = e => { e.stopPropagation(); go(idx + Number(b.dataset.nav)); });
    dots.forEach((d, di) => d.onclick = e => { e.stopPropagation(); go(di); });
  });

  /* ---- size selection ---- */
  $$(".card").forEach(card => {
    $$(".size", card).forEach(sz => {
      sz.onclick = () => $$(".size", card).forEach(s => s.classList.toggle("selected", s === sz));
    });
  });

  /* ---- add to order ---- */
  function flash(btn, msg) {
    const o = btn.textContent;
    btn.textContent = msg; btn.style.borderColor = "var(--gold)"; btn.style.color = "var(--gold)";
    setTimeout(() => { btn.textContent = o; btn.style.borderColor = ""; btn.style.color = ""; }, 1100);
  }
  $$("[data-add]").forEach(btn => {
    btn.onclick = () => {
      const card = btn.closest(".card");
      const sizes = $$(".size", card);
      let size = "\u2014";
      if (sizes.length) {
        const sel = $(".size.selected", card);
        if (!sel) { flash(btn, "Pick a size"); return; }
        size = sel.dataset.size;
      }
      // live (per-session) stock countdown
      if (sizes.length) {
        const sel2 = $(".size.selected", card);
        if (sel2 && sel2.dataset.stock !== undefined) {
          let left = Number(sel2.dataset.stock);
          if (left <= 0) { flash(btn, "Out of stock"); return; }
          left -= 1; sel2.dataset.stock = left;
          const line = $(".stock-line", card);
          if (line) {
            const chip = line.querySelector('[data-stk-size="' + size + '"]');
            if (chip) chip.textContent = size + ": " + left;
          }
          if (left === 0) { sel2.classList.add("depleted"); }
        }
      }
      // capture selected color (flag swatches), if any
      let itemName = card.dataset.name;
      const activeSwatch = $(".swatch.active", card);
      if (activeSwatch) {
        const colorName = activeSwatch.getAttribute("title") || "";
        if (colorName) itemName = itemName + " (" + colorName + ")";
      }
      const tba = card.dataset.priceLabel === "TBA";
      order.push({
        name: itemName,
        price: Number(card.dataset.price) || 0,
        label: card.dataset.priceLabel || ("$" + card.dataset.price),
        tba: tba,
        size: size
      });
      renderOrder();
      flash(btn, "Added \u2713");
    };
  });

  /* ---- order list ---- */
  function orderTotal() {
    const sum = order.reduce((s, o) => s + (o.tba ? 0 : o.price), 0);
    const anyTba = order.some(o => o.tba);
    return { sum: sum, label: "$" + sum + (anyTba ? " + TBA" : "") };
  }

  function renderOrder() {
    $("#cartCount").textContent = order.length;
    const wrap = $("#drawerItems");
    if (!order.length) {
      wrap.innerHTML = `<p class="drawer-empty">Your order is empty.<br>Add items from the store below.</p>`;
    } else {
      wrap.innerHTML = order.map((o, i) => `
        <div class="line-item">
          <div>
            <div class="li-name">${o.name}</div>
            <div class="li-meta">Size ${o.size}</div>
            <button class="li-remove" data-rm="${i}">Remove</button>
          </div>
          <div class="li-right"><div class="li-price">${o.label}</div></div>
        </div>`).join("");
      $$("[data-rm]", wrap).forEach(b =>
        b.onclick = () => { order.splice(Number(b.dataset.rm), 1); renderOrder(); });
    }
    $("#drawerTotal").textContent = orderTotal().label;
    store(CART_KEY, order);
    const place = $("#placeBtn");
    if (place) place.disabled = order.length === 0;
  }

  /* ---- drawer open / close ---- */
  function openDrawer(open) {
    $("#drawer").classList.toggle("open", open);
    $("#scrim").classList.toggle("open", open);
  }
  $("#cartToggle").onclick = () => openDrawer(true);
  $("#drawerClose").onclick = () => closeDrawer();
  $("#scrim").onclick = () => closeDrawer();

  function closeDrawer() {
    openDrawer(false);
    // if we're on the thank-you screen, reset to a fresh order for next time
    if (!$("#confirmView").hidden) resetDrawer();
  }

  /* ---- checkout ---- */
  function submitOrder(payload) {
    // Send the order reliably even though we navigate to the confirmation right away.
    // sendBeacon guarantees the request is delivered in the background; if it's
    // unavailable, fall back to fetch with keepalive so the request isn't cancelled.
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "text/plain;charset=utf-8" });
        var ok = navigator.sendBeacon(CONFIG.orderEndpoint, blob);
        if (ok) return;
      }
    } catch (e) { /* fall through to fetch */ }
    fetch(CONFIG.orderEndpoint, {
      method: "POST", mode: "no-cors", keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body
    });
  }

  $("#checkoutForm").addEventListener("submit", async e => {
    e.preventDefault();
    if ($("#fWebsite") && $("#fWebsite").value) { return; }  // honeypot: bots fill this, humans can't see it
    const note = $("#drawerNote"); note.className = "drawer-note";
    if (!order.length) { note.classList.add("error"); note.textContent = "Add at least one item before placing your order."; return; }

    const name  = $("#fName").value.trim();
    const phone = $("#fPhone").value.trim();
    const email = $("#fEmail").value.trim();
    const address = $("#fAddress").value.trim();
    const classYear = $("#fClass") ? $("#fClass").value.trim() : "";
    const pledge = $("#fPledge") ? $("#fPledge").value.trim() : "";
    const notes = $("#fNotes").value.trim();
    if (!name || !phone) { note.classList.add("error"); note.textContent = "Please add your name and phone number."; return; }
    if (!classYear) { note.classList.add("error"); note.textContent = "Please select your class year."; return; }

    const totals = orderTotal();
    const total = totals.sum;
    const orderId = "PGN-" + Date.now().toString(36).toUpperCase().slice(-6);
    const payload = {
      orderId, token: CONFIG.token, name, phone, email, address, classYear, pledgeClass: pledge, notes,
      total, totalLabel: totals.label,
      chapter: CONFIG.chapter, university: CONFIG.university,
      items: order.map(o => ({ name: o.name, size: o.size, price: o.price, priceLabel: o.label }))
    };

    const btn = $("#placeBtn"); const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Placing order\u2026";
    // Fire the order but DON'T wait for Google's slow response (we can't read it
    // anyway with no-cors). The order still reaches the sheet; the user sees the
    // confirmation instantly instead of waiting several seconds.
    if (CONFIG.orderEndpoint) { try { submitOrder(payload); } catch (err) { /* still confirm */ } }

    // Google Analytics: record the order as a conversion (no-op if GA isn't loaded)
    if (typeof gtag === "function") {
      gtag("event", "purchase", {
        transaction_id: orderId,
        value: total,
        currency: "USD",
        items: payload.items.map(function (o) {
          return { item_name: o.name, item_variant: o.size, price: o.price, quantity: 1 };
        })
      });
    }

    showConfirmation(orderId, payload);
    btn.disabled = false; btn.textContent = label;
  });

  function showConfirmation(orderId, payload) {
    // keep a copy on this device so the buyer can look it up later
    const hist = recall(HIST_KEY, []);
    hist.unshift({
      orderId: orderId,
      when: new Date().toISOString(),
      name: payload.name,
      phone: payload.phone,
      items: payload.items,
      totalLabel: payload.totalLabel
    });
    store(HIST_KEY, hist.slice(0, 25));   // keep the last 25

    $("#orderView").hidden = true;
    $("#drawerTitle").textContent = "Order confirmed";
    $("#confirmId").textContent = orderId;
    $("#confirmSummary").innerHTML =
      payload.items.map(o => `
        <div class="line-item">
          <div><div class="li-name">${o.name}</div><div class="li-meta">Size ${o.size}</div></div>
          <div class="li-right"><div class="li-price">${o.priceLabel}</div></div>
        </div>`).join("")
      + `<div class="c-total"><span>Total</span><span class="t-val">${payload.totalLabel}</span></div>`;
    $("#confirmContact").innerHTML =
      `<p class="pay-followup">We'll text <strong>${payload.phone}</strong> to confirm your order and payment.</p>`;

    // payment step: Cheddar Up link (from PAYMENT in products.py)
    const payWrap = $("#confirmPay");
    if (payWrap) {
      if (CONFIG.payUrl) {
        payWrap.innerHTML =
          `<a class="btn btn-gold pay-btn" href="${CONFIG.payUrl}" target="_blank" rel="noopener">Click here to make your payment</a>`
          + (CONFIG.payMsg ? `<p class="pay-note">${CONFIG.payMsg}</p>` : "");
        payWrap.hidden = false;
      } else {
        payWrap.innerHTML = "";
        payWrap.hidden = true;
      }
    }

    $("#confirmView").hidden = false;
    order = []; renderOrder();
  }

  function resetDrawer() {
    $("#confirmView").hidden = true;
    $("#orderView").hidden = false;
    $("#drawerTitle").textContent = "Your order";
    $("#checkoutForm").reset();
    const btn = $("#placeBtn"); btn.disabled = true; btn.textContent = "Place order";
    const note = $("#drawerNote"); note.className = "drawer-note";
    note.textContent = "Once you place your order, we'll send you a confirmation text shortly.";
    renderOrder();
  }
  $("#againBtn").onclick = resetDrawer;






  /* ---- color swatches (flag) ---- */
  Array.prototype.forEach.call(document.querySelectorAll(".card"), function (card) {
    var swatches = card.querySelectorAll(".swatch");
    var slides = card.querySelectorAll(".color-slide");
    var nameLabel = card.querySelector(".swatch-name");
    if (!swatches.length || !slides.length) return;
    Array.prototype.forEach.call(swatches, function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.dataset.i);
        Array.prototype.forEach.call(swatches, function (x) { x.classList.toggle("active", x === b); });
        Array.prototype.forEach.call(slides, function (s, si) { s.classList.toggle("active", si === i); });
        if (nameLabel) nameLabel.textContent = b.getAttribute("title") || "";
      });
    });
  });

  /* ---- search box (works alongside category chips) ---- */
  (function () {
    var box = document.getElementById("searchBox");
    var noRes = document.getElementById("noResults");
    if (!box) return;
    function currentCat() {
      var active = document.querySelector(".chip.active");
      return active ? active.dataset.cat : "All";
    }
    function apply() {
      var q = box.value.trim().toLowerCase();
      var cat = currentCat();
      var shown = 0;
      Array.prototype.forEach.call(document.querySelectorAll(".card"), function (card) {
        var name = (card.dataset.name || "").toLowerCase();
        var desc = (card.querySelector(".desc") ? card.querySelector(".desc").textContent : "").toLowerCase();
        var catOk = (cat === "All" || card.dataset.category === cat);
        var qOk = (!q || name.indexOf(q) !== -1 || desc.indexOf(q) !== -1);
        var vis = catOk && qOk;
        card.style.display = vis ? "" : "none";
        if (vis) shown++;
      });
      if (noRes) noRes.hidden = shown !== 0;
    }
    box.addEventListener("input", apply);
    // re-run search when a category chip is clicked
    Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (chip) {
      chip.addEventListener("click", function () { setTimeout(apply, 0); });
    });
  })();

  /* ---- synced inventory (reads live stock from the sheet) ---- */
  (function () {
    if (!CONFIG.orderEndpoint) return;
    // fetch current stock: { "Item Name": { "S": 20, "M": 15, ... }, ... }
    fetch(CONFIG.orderEndpoint + "?action=stock", { method: "GET" })
      .then(function (r) { return r.json(); })
      .then(function (stock) {
        if (!stock || typeof stock !== "object") return;
        Array.prototype.forEach.call(document.querySelectorAll(".card"), function (card) {
          var name = card.dataset.name;
          var s = stock[name];
          if (!s) return;
          var line = card.querySelector(".stock-line");
          var sizeBtns = card.querySelectorAll(".size");
          Array.prototype.forEach.call(sizeBtns, function (btn) {
            var sz = btn.dataset.size;
            if (s[sz] === undefined) return;
            var left = Number(s[sz]);
            btn.dataset.stock = left;
            if (left <= 0) { btn.classList.add("depleted"); btn.disabled = true; }
            else { btn.classList.remove("depleted"); btn.disabled = false; }
            if (line) {
              var chip = line.querySelector('[data-stk-size="' + sz + '"]');
              if (chip) chip.textContent = sz + ": " + left;
            }
          });
          // total remaining across all sizes (or the single no-size qty)
          var totalLeft = 0;
          for (var k in s) { totalLeft += Number(s[k]) || 0; }
          if (totalLeft <= 0) {
            var addBtn = card.querySelector(".add");
            if (addBtn) {
              addBtn.textContent = "Sold out";
              addBtn.classList.add("soldout");
              addBtn.disabled = true;
              addBtn.removeAttribute("data-add");
            }
            if (line) line.textContent = "Sold out";
          }
        });
      })
      .catch(function () { /* offline / endpoint down -> keep the built-in numbers */ });
  })();

  /* ---- external-link products (whole card opens the link) ---- */
  Array.prototype.forEach.call(document.querySelectorAll(".card"), function (card) {
    var linkEl = card.querySelector(".add-link");
    if (!linkEl) return;
    var url = linkEl.getAttribute("href");
    card.style.cursor = "pointer";
    card.addEventListener("click", function (e) {
      // let clicks on the swatches or the link button itself behave normally
      if (e.target.closest(".swatch") || e.target.closest(".add-link") || e.target.closest(".car-nav")) return;
      window.open(url, "_blank", "noopener");
    });
  });

  /* ---- lightbox: click a photo to open it full screen ---- */
  (function () {
    // one overlay, reused by every card
    const ov = document.createElement("div");
    ov.className = "lbox";
    ov.setAttribute("hidden", "");
    ov.innerHTML =
      '<button class="lb-close" aria-label="Close">&times;</button>' +
      '<button class="lb-nav lb-prev" aria-label="Previous">&#8249;</button>' +
      '<figure class="lb-stage"><img class="lb-img" alt=""></figure>' +
      '<button class="lb-nav lb-next" aria-label="Next">&#8250;</button>' +
      '<div class="lb-bar"><span class="lb-name"></span>' +
      '<span class="lb-price"></span><span class="lb-count"></span></div>';
    document.body.appendChild(ov);

    const lbImg   = $(".lb-img", ov);
    const lbName  = $(".lb-name", ov);
    const lbPrice = $(".lb-price", ov);
    const lbCount = $(".lb-count", ov);
    const prevBtn = $(".lb-prev", ov);
    const nextBtn = $(".lb-next", ov);

    let shots = [];   // [{src, label}]
    let at = 0;

    function paint() {
      const s = shots[at];
      if (!s) return;
      lbImg.src = s.src;
      lbImg.alt = lbName.textContent + (s.label ? " \u2014 " + s.label : "");
      lbCount.textContent = shots.length > 1
        ? (s.label ? s.label + " \u00b7 " : "") + (at + 1) + " / " + shots.length
        : (s.label || "");
      const many = shots.length > 1;
      prevBtn.hidden = !many;
      nextBtn.hidden = !many;
    }

    function go(n) { at = (n + shots.length) % shots.length; paint(); }

    function open(card, startAt) {
      const imgs = card.querySelectorAll(".card-media img");
      if (!imgs.length) return;
      shots = Array.prototype.map.call(imgs, function (im) {
        const slide = im.closest("[data-label]");
        return { src: im.src, label: slide ? slide.dataset.label : (im.dataset.label || "") };
      });
      at = Math.min(startAt || 0, shots.length - 1);
      lbName.textContent = card.dataset.name || "";
      lbPrice.textContent = card.dataset.priceLabel || "";
      paint();
      ov.removeAttribute("hidden");
      document.body.classList.add("lb-open");
      $(".lb-close", ov).focus();
    }

    function close() {
      ov.setAttribute("hidden", "");
      document.body.classList.remove("lb-open");
      lbImg.removeAttribute("src");
    }

    $$(".card").forEach(function (card) {
      if (card.querySelector(".add-link")) return;   // link-out cards open their link instead
      const media = $(".card-media", card);
      if (!media || !media.querySelector("img")) return;   // placeholders have no photo
      media.classList.add("is-openable");
      media.addEventListener("click", function (e) {
        // let the carousel arrows and dots do their own job
        if (e.target.closest(".car-nav") || e.target.closest(".dot")) return;
        const slides = Array.prototype.slice.call(card.querySelectorAll(".card-media img"));
        const clicked = e.target.tagName === "IMG" ? slides.indexOf(e.target) : 0;
        open(card, clicked < 0 ? 0 : clicked);
      });
    });

    $(".lb-close", ov).onclick = close;
    prevBtn.onclick = function (e) { e.stopPropagation(); go(at - 1); };
    nextBtn.onclick = function (e) { e.stopPropagation(); go(at + 1); };
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", function (e) {
      if (ov.hasAttribute("hidden")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft" && shots.length > 1) go(at - 1);
      else if (e.key === "ArrowRight" && shots.length > 1) go(at + 1);
    });
  })();

  /* ---- "email me my order" + local device history ---- */
  (function () {
    const out = $("#lookupResult");
    if (!out) return;

    function msg(text) { out.innerHTML = '<p class="lk-msg">' + text + '</p>'; }

    // --- ask the server to email the order to the address on file ---
    const rForm = $("#resendForm");
    if (rForm) {
      const rInput = $("#resendEmail");
      const rBtn = $("#resendBtn");
      rForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const email = rInput.value.trim();
        if (!email || email.indexOf("@") < 1) { msg("Enter the email address you ordered with."); return; }
        if (!CONFIG.orderEndpoint) { msg("Email lookup isn't set up yet \u2014 please text us instead."); return; }

        submitOrder({ action: "resend", token: CONFIG.token, email: email });

        // Deliberately the same message either way, so this can't be used to
        // check whether someone has ordered.
        msg("If there's an order under that address, we've just emailed it over. " +
            "Give it a minute, and check your spam folder.");
        rBtn.disabled = true;
        rBtn.textContent = "Sent";
        setTimeout(function () { rBtn.disabled = false; rBtn.textContent = "Email it to me"; }, 30000);
      });
    }

    // --- instant, no email needed, if they're on the device they ordered from ---
    const allBtn = $("#lookupAll");
    if (allBtn) {
      allBtn.addEventListener("click", function () {
        const hist = recall(HIST_KEY, []);
        if (!hist.length) { msg("No orders were placed on this device."); return; }
        out.innerHTML = (hist.length > 1
          ? '<p class="lk-msg">' + hist.length + ' orders found on this device:</p>' : "")
          + hist.map(function (o) {
            const when = new Date(o.when).toLocaleDateString(undefined,
              { month: "short", day: "numeric", year: "numeric" });
            return '<div class="lk-card">' +
              '<div class="lk-head"><strong>' + o.orderId + '</strong><span>' + when + '</span></div>' +
              (o.items || []).map(function (i) {
                return '<div class="lk-row"><span>' + i.name +
                       (i.size && i.size !== "\u2014" ? " \u00b7 " + i.size : "") +
                       '</span><span>' + i.priceLabel + '</span></div>';
              }).join("") +
              '<div class="lk-row lk-total"><span>Total</span><span>' + o.totalLabel + '</span></div>' +
              '</div>';
          }).join("");
      });
    }
  })();

  renderOrder();
})();
