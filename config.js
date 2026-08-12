/**
 * ClearVIN — site configuration
 * ------------------------------------------------------------------
 * Fill these in yourself. Nothing here is a real credential.
 */
window.CLEARVIN_CONFIG = {
  // PayPal Client ID — also update the <script src="...client-id=..."> tag in index.html
  paypalClientId: "YOUR_PAYPAL_CLIENT_ID",

  // Optional paid vehicle-history data provider (accidents / title brands / odometer).
  // NHTSA's free APIs (used elsewhere in this site) do NOT cover this data — see README.
  // Once you have a provider, set enabled: true and point endpoint at YOUR OWN backend
  // route that calls the provider server-side (never put a paid API's secret key here,
  // it would be visible to anyone who views page source).
  vehicleHistoryApi: {
    enabled: false,
    endpoint: "", // e.g. "https://your-backend.example.com/api/history"
  },
};
