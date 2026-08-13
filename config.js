/**
 * ClearVIN — site configuration
 * ------------------------------------------------------------------
 * Fill these in yourself. Nothing here is a real credential.
 */
window.CLEARVIN_CONFIG = {
  // PayPal Client ID — also update the <script src="...client-id=..."> tag in index.html
  paypalClientId: "YOUR_PAYPAL_CLIENT_ID",

  // Stripe PUBLISHABLE key only (starts with pk_...) — safe to expose in frontend code.
  // Never put your Stripe SECRET key (sk_...) here or anywhere in frontend/.
  stripePublishableKey: "YOUR_STRIPE_PUBLISHABLE_KEY",

  // Your deployed backend URL (see /backend). Required for card payments — Stripe
  // needs a server to create the PaymentIntent with your secret key. Leave blank
  // and the "Pay with card" tab will show a setup notice instead of a broken form.
  // e.g. "https://your-app-name.onrender.com"
  backendBaseUrl: "",

  reportPrice: "14.99",

  // Optional paid vehicle-history data provider (accidents / title brands / odometer).
  // NHTSA's free APIs (used elsewhere in this site) do NOT cover this data — see README.
  vehicleHistoryApi: {
    enabled: false,
    endpoint: "", // e.g. "https://your-backend.example.com/api/history"
  },
};
