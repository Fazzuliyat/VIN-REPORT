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
 * PayPal Smart Buttons
 * ------------------------------------------------------------------
 * IMPORTANT — read before going live:
 * This client-side flow is fine for testing, but on its own it is
 * NOT secure: anyone could open the browser console and set
 * tvr_paid = "true" without paying. For a real launch, move order
 * creation + capture to a backend (see /backend in this project)
 * and have report.html ask your backend "was this order actually
 * captured?" instead of trusting sessionStorage. Full explanation
 * in README.md.
 * ------------------------------------------------------------------ */
if (window.paypal) {
  paypal.Buttons({
    style: { layout: "vertical", color: "black", shape: "rect", label: "paypal" },
    createOrder: function (data, actions) {
      return actions.order.create({
        purchase_units: [{ amount: { value: "9.95", currency_code: "USD" } }],
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
        window.location.href = `report.html?vin=${encodeURIComponent(vin)}`;
      });
    },
    onError: function (err) {
      console.error(err);
      alert("Payment could not be completed. Please try again.");
    },
  }).render("#paypal-button-container");
}
