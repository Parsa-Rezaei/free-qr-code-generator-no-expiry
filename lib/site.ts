/**
 * Central site configuration. Edit these values before deploying.
 */

/** Replace with your Stripe / Buy Me a Coffee / Ko-fi / PayPal link. */
export const TIP_JAR_URL = "YOUR_PAYMENT_LINK_HERE";

/**
 * Public, canonical origin of the site (no trailing slash).
 * Set NEXT_PUBLIC_SITE_URL (e.g. https://www.yourdomain.com) in your hosting
 * provider. On Vercel the production domain is used automatically as a fallback.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/+$/, "");

export const SITE_NAME = "Free QR Code Generator Pro";

export const SITE_TITLE =
  "Free QR Code Generator – No Expiry, No Sign-Up, No Watermark";

export const SITE_DESCRIPTION =
  "Create free static QR codes that never expire. No sign-up, no watermark, no scan limits. Custom colors and high-res PNG & SVG downloads, made in your browser.";
