document.getElementById("year").textContent = new Date().getFullYear();

/* scroll-reveal for elements marked .reveal */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in-view");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

/* supported countries — loaded lazily, only when the details element is opened,
   so we don't spend an API call on every page view */
const countriesNote = document.getElementById("countriesNote");
if (countriesNote) {
  let loaded = false;
  countriesNote.addEventListener("toggle", async () => {
    if (!countriesNote.open || loaded) return;
    loaded = true;
    const listEl = document.getElementById("countriesList");
    try {
      const countries = await getSupportedCountries();
      listEl.innerHTML = countries.map((c) => `<span>${c}</span>`).join("");
    } catch {
      listEl.textContent = "Couldn't load the country list right now.";
    }
  });
}

const vinInput = document.getElementById("vinInput");
const decodeBtn = document.getElementById("decodeBtn");
const scannerBox = document.getElementById("scannerBox");
const decodePreview = document.getElementById("decodePreview");

vinInput.addEventListener("input", () => {
  vinInput.value = vinInput.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
});

let lastDecoded = null;

decodeBtn.addEventListener("click", async () => {
  const vin = vinInput.value.trim();
  decodePreview.innerHTML = "";

  if (!isValidVin(vin)) {
    renderPreviewLine("error", "Enter a valid 17-character VIN (no I, O, or Q).");
    return;
  }

  scannerBox.classList.add("scanning");
  decodeBtn.disabled = true;
  decodeBtn.innerHTML = '<span class="loader"></span>';

  try {
    const result = await decodeVin(vin);
    if (!result || !result.Make) {
      renderPreviewLine("error", "Couldn't decode that VIN. Double-check the characters and try again.");
      return;
    }
    lastDecoded = result;

    const fields = [
      ["Year", result.ModelYear],
      ["Make", result.Make],
      ["Model", result.Model],
      ["Trim", result.Trim || "—"],
      ["Engine", result.EngineCylinders ? `${result.EngineCylinders} cyl` : "—"],
      ["Plant country", result.PlantCountry || "—"],
    ];
    fields.forEach(([k, v], i) => renderPreviewLine("ok", k, v, i));

    sessionStorage.setItem("tvr_vin", vin);
    sessionStorage.setItem("tvr_decoded", JSON.stringify(result));

    document.getElementById("pricing").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    renderPreviewLine("error", "Network error reaching the VIN registry. Please try again.");
  } finally {
    scannerBox.classList.remove("scanning");
    decodeBtn.disabled = false;
    decodeBtn.textContent = "Decode free";
  }
});

function renderPreviewLine(type, key, value, delayIndex = 0) {
  const row = document.createElement("div");
  row.className = "field";
  row.style.animationDelay = `${delayIndex * 90}ms`;
  if (type === "error") {
    row.innerHTML = `<span class="v" style="color:#E39B8F;">${key}</span>`;
  } else {
    row.innerHTML = `<span class="k">${key}</span><span class="v">${value}</span>`;
  }
  decodePreview.appendChild(row);
}

/* ------------------------------------------------------------------
 * Payment method tabs (PayPal / Card)
 * ------------------------------------------------------------------ */
const tabPaypal = document.getElementById("tabPaypal");
const tabCard = document.getElementById("tabCard");
const panelPaypal = document.getElementById("panelPaypal");
const panelCard = document.getElementById("panelCard");

function activateTab(which) {
  const isPaypal = which === "paypal";
  tabPaypal.classList.toggle("active", isPaypal);
  tabCard.classList.toggle("active", !isPaypal);
  panelPaypal.classList.toggle("active", isPaypal);
  panelCard.classList.toggle("active", !isPaypal);
}
if (tabPaypal && tabCard) {
  tabPaypal.addEventListener("click", () => activateTab("paypal"));
  tabCard.addEventListener("click", () => activateTab("card"));
}

/* ------------------------------------------------------------------
 * Stripe — card payments
 * ------------------------------------------------------------------
 * Requires both a Stripe publishable key AND a deployed backend
 * (Stripe needs a server-side secret key to create the PaymentIntent —
 * see backend/server.js). If either is missing from config.js, we
 * show a setup notice instead of a form that can't actually charge
 * anyone.
 * ------------------------------------------------------------------ */
const cfg = window.CLEARVIN_CONFIG || {};
const cardReady = window.Stripe && cfg.stripePublishableKey && cfg.stripePublishableKey !== "YOUR_STRIPE_PUBLISHABLE_KEY" && cfg.backendBaseUrl;

let stripe, cardElement;
if (cardReady) {
  stripe = Stripe(cfg.stripePublishableKey);
  const elements = stripe.elements();
  cardElement = elements.create("card", {
    style: { base: { fontSize: "16px", fontFamily: "Inter, sans-serif", color: "#16212E", "::placeholder": { color: "#9AA8B4" } } },
  });
  cardElement.mount("#card-element");
} else {
  const notice = document.getElementById("cardSetupNotice");
  const submitBtn = document.getElementById("cardSubmitBtn");
  if (notice) notice.classList.remove("hidden");
  if (submitBtn) submitBtn.disabled = true;
}

const cardForm = document.getElementById("cardForm");
if (cardForm) {
  cardForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!cardReady) return;

    const vin = sessionStorage.getItem("tvr_vin");
    const errorEl = document.getElementById("cardError");
    const submitBtn = document.getElementById("cardSubmitBtn");
    errorEl.textContent = "";

    if (!vin) {
      errorEl.textContent = "Please decode a VIN first, then complete payment.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span>';

    try {
      const res = await fetch(`${cfg.backendBaseUrl}/api/stripe/create-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin }),
      });
      const { clientSecret, id, error } = await res.json();
      if (error) throw new Error(error);

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (result.error) throw new Error(result.error.message);

      if (result.paymentIntent.status === "succeeded") {
        sessionStorage.setItem("tvr_paid", "true");
        sessionStorage.setItem("tvr_order_id", id);
        sessionStorage.setItem("tvr_order_provider", "stripe");
        window.location.href = `report.html?vin=${encodeURIComponent(vin)}`;
      }
    } catch (err) {
      errorEl.textContent = err.message || "Payment could not be completed. Please try again.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Pay $14.99";
    }
  });
}

if (window.paypal) {
  paypal.Buttons({
    style: { layout: "vertical", color: "black", shape: "rect", label: "paypal" },
    createOrder: function (data, actions) {
      return actions.order.create({
        purchase_units: [{ amount: { value: "14.99", currency_code: "USD" } }],
      });
    },
    onApprove: function (data, actions) {
      return actions.order.capture().then(function (details) {
        const vin = sessionStorage.getItem("tvr_vin");
        if (!vin) {
          alert("Please decode a VIN first, then complete payment.");
          return;
        }
        sessionStorage.setItem("tvr_paid", "true");
        sessionStorage.setItem("tvr_order_id", details.id);
        sessionStorage.setItem("tvr_order_provider", "paypal");
        window.location.href = `report.html?vin=${encodeURIComponent(vin)}`;
      });
    },
    onError: function (err) {
      console.error(err);
      alert("Payment could not be completed. Please try again.");
    },
  }).render("#paypal-button-container");
}
