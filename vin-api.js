/**
 * TrueVIN Reports — free data sources
 * ------------------------------------------------------------------
 * All of these are public, no-signup, no-API-key U.S. government
 * endpoints run by NHTSA (National Highway Traffic Safety Admin).
 * They are free and CORS-enabled, so they can be called straight
 * from the browser.
 *
 * 1. vPIC  — VIN decode (year/make/model/trim/engine/plant)
 *    https://vpic.nhtsa.dot.gov/api/
 * 2. Recalls  — open manufacturer recalls for a decoded model/year
 *    https://api.nhtsa.gov/recalls/recallsByVehicle
 * 3. Complaints — consumer safety complaints filed with NHTSA
 *    https://api.nhtsa.gov/complaints/complaintsByVehicle
 *
 * NOTE ON "FULL VEHICLE HISTORY" (accidents / title / odometer):
 * There is no free public API for that data. The authoritative
 * source is NMVTIS (nmvtis.gov) which requires becoming an approved
 * data provider (a paid, vetted commercial relationship) — the same
 * gate that Carfax/AutoCheck go through. If you plan to advertise
 * "full vehicle history," either integrate an NMVTIS-approved
 * provider or clearly scope your marketing to what you actually
 * check (recalls + complaints + VIN validity), to stay on the right
 * side of FTC truth-in-advertising rules. See README.md.
 */

const VPIC_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";
const RECALLS_BASE = "https://api.nhtsa.gov/recalls/recallsByVehicle";
const COMPLAINTS_BASE = "https://api.nhtsa.gov/complaints/complaintsByVehicle";

function isValidVin(vin) {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin || "");
}

async function decodeVin(vin) {
  const url = `${VPIC_BASE}/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("VIN decode request failed");
  const data = await res.json();
  return (data.Results && data.Results[0]) || null;
}

async function getRecalls(make, model, year) {
  const url = `${RECALLS_BASE}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

async function getComplaints(make, model, year) {
  const url = `${COMPLAINTS_BASE}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}
