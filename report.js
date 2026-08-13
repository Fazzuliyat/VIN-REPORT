document.getElementById("year").textContent = new Date().getFullYear();
document.body.classList.add("report-body");

const params = new URLSearchParams(window.location.search);
const vin = (params.get("vin") || sessionStorage.getItem("tvr_vin") || "").toUpperCase();
document.getElementById("reportVin").textContent = vin || "NO VIN PROVIDED";

const lockedNotice = document.getElementById("lockedNotice");
const reportBody = document.getElementById("reportBody");
const cfg = window.CLEARVIN_CONFIG || {};

checkPaymentAndLoad();

/**
 * Confirms payment before showing report data. If a backend is configured
 * (config.js -> backendBaseUrl), this asks the backend's order log —
 * built from the real PayPal capture / Stripe webhook, not anything the
 * browser can fake. Without a backend configured, it falls back to the
 * sessionStorage flag from app.js, which is fine for local testing but
 * NOT tamper-proof — see the security note in app.js and README.md.
 */
async function checkPaymentAndLoad() {
  let paid = sessionStorage.getItem("tvr_paid") === "true";
  const orderId = sessionStorage.getItem("tvr_order_id");

  if (cfg.backendBaseUrl && orderId) {
    try {
      const res = await fetch(`${cfg.backendBaseUrl}/api/orders/${encodeURIComponent(orderId)}/status`);
      const data = await res.json();
      paid = !!data.paid;
    } catch {
      // backend unreachable — fall back to the sessionStorage flag already read above
    }
  }

  if (!paid || !isValidVin(vin)) {
    lockedNotice.classList.remove("hidden");
  } else {
    reportBody.classList.remove("hidden");
    loadReport(vin);
  }
}

async function loadReport(vin) {
  try {
    const decoded = JSON.parse(sessionStorage.getItem("tvr_decoded") || "null") || await decodeVin(vin);
    renderSpecTable(decoded);

    const [recalls, complaints] = await Promise.all([
      getRecalls(decoded.Make, decoded.Model, decoded.ModelYear),
      getComplaints(decoded.Make, decoded.Model, decoded.ModelYear),
    ]);
    renderRecalls(recalls);
    renderComplaints(complaints);
    const historyStatus = await renderHistorySection(vin);
    renderSummary(recalls.length, complaints.length, historyStatus);
  } catch (err) {
    console.error(err);
    reportBody.insertAdjacentHTML("beforeend", `<p style="color:var(--red)">Something went wrong loading live data. Please refresh.</p>`);
  }
}

function renderSummary(recallCount, complaintCount, historyStatus) {
  const el = document.getElementById("reportSummary");
  const recallTone = recallCount > 0 ? "var(--red)" : "var(--green)";
  el.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Open recalls</div>
        <div class="summary-value" style="color:${recallTone}">${recallCount}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Safety complaints</div>
        <div class="summary-value">${complaintCount}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Title &amp; history</div>
        <div class="summary-value" style="font-size:1.1rem;">${historyStatus}</div>
      </div>
    </div>`;
}

/**
 * Title / accident / odometer history — the one part of a "full" vehicle
 * report that NHTSA's free APIs do not cover. Checks config.js for a
 * connected provider and falls back to an honest explanation instead of
 * pretending to have data we don't. Returns a short status string used
 * in the summary cards above.
 */
async function renderHistorySection(vin) {
  const el = document.getElementById("historySection");
  const historyCfg = cfg.vehicleHistoryApi;

  if (!historyCfg || !historyCfg.enabled || !historyCfg.endpoint) {
    el.innerHTML = `
      <div class="history-placeholder">
        <p><span class="status-pill status-locked">Not yet connected</span></p>
        <p>Accident, salvage/flood title, and odometer records aren't part of any free public API — they come from
        NMVTIS-approved data providers under a paid agreement (the same gate Carfax and AutoCheck go through).
        Once a provider is connected in <code>config.js</code>, results appear here automatically.</p>
      </div>`;
    return "Not connected";
  }

  try {
    const res = await fetch(`${historyCfg.endpoint}?vin=${encodeURIComponent(vin)}`);
    if (!res.ok) throw new Error("history lookup failed");
    const data = await res.json();
    el.innerHTML = `<table class="data-table">
      <tr><th>Field</th><th>Value</th></tr>
      ${Object.entries(data).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
    </table>`;
    return "Checked";
  } catch (err) {
    el.innerHTML = `<p style="color:var(--red)">Couldn't load title/history data right now. Please refresh.</p>`;
    return "Error";
  }
}

function renderSpecTable(d) {
  const rows = [
    ["Year", d.ModelYear], ["Make", d.Make], ["Model", d.Model], ["Trim", d.Trim],
    ["Body class", d.BodyClass], ["Engine cylinders", d.EngineCylinders],
    ["Fuel type", d.FuelTypePrimary], ["Drive type", d.DriveType],
    ["Plant country", d.PlantCountry], ["Plant city", d.PlantCity],
    ["GVWR", d.GVWR], ["Manufacturer", d.Manufacturer],
  ].filter(([, v]) => v);

  const table = document.getElementById("specTable");
  table.innerHTML = "<tr><th>Field</th><th>Value</th></tr>" +
    rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
}

function renderRecalls(recalls) {
  const el = document.getElementById("recallsList");
  if (!recalls.length) {
    el.innerHTML = `<p><span class="status-pill status-clear">No open recalls found</span></p>`;
    return;
  }
  el.innerHTML = `<p><span class="status-pill status-flag">${recalls.length} recall(s) on file</span></p>` +
    recalls.map(r => `
      <div class="recall-item">
        <h4>${r.Component || "Component not specified"}</h4>
        <p>${r.Summary || "No summary provided."}</p>
      </div>
    `).join("");
}

function renderComplaints(complaints) {
  document.getElementById("complaintsSummary").textContent =
    `${complaints.length} complaint(s) reported to NHTSA for this make/model/year`;
  const table = document.getElementById("complaintsTable");
  if (!complaints.length) {
    table.innerHTML = "";
    return;
  }
  const rows = complaints.slice(0, 15);
  table.innerHTML = "<tr><th>Component</th><th>Date filed</th><th>Summary</th></tr>" +
    rows.map(c => `
      <tr>
        <td>${c.components || "—"}</td>
        <td>${c.dateComplaintFiled || "—"}</td>
        <td>${(c.summary || "").slice(0, 160)}${(c.summary || "").length > 160 ? "…" : ""}</td>
      </tr>
    `).join("");
}
