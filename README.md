# Free QR Code Generator Pro

Static QR codes that never expire, generated 100% in the browser. No backend, no database, no sign-up.

Next.js (App Router) · Tailwind CSS v4 · `qrcode` · `lucide-react`

## Setup from scratch

```bash
npx create-next-app@latest free-qr-code-generator-pro --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
cd free-qr-code-generator-pro
npm install qrcode lucide-react
npm install -D @types/qrcode
```

Then copy in the files from this repository:

| File | Purpose |
| --- | --- |
| `lib/site.ts` | Site name, title, description, canonical URL, **tip-jar link** |
| `app/layout.tsx` | Root layout, full SEO metadata (title, description, canonical, Open Graph, Twitter, robots, verification) |
| `app/page.tsx` | Server-rendered page: hero, features, how-to, static-vs-dynamic table, use cases, FAQ, JSON-LD |
| `components/qr-code-generator.tsx` | Client component: input, colors, live preview, PNG/SVG download, tip jar |
| `app/globals.css` | Tailwind import + glow animations |
| `app/robots.ts`, `app/sitemap.ts` | `/robots.txt` and `/sitemap.xml` |
| `app/opengraph-image.tsx` | Generated 1200×630 social share image |
| `app/icon.svg` | Favicon (delete the default `app/favicon.ico`) |

## Configure before deploying

1. `lib/site.ts` → replace `YOUR_PAYMENT_LINK_HERE` with your Stripe / Buy Me a Coffee / Ko-fi / PayPal link.
2. Environment variables (Vercel → Project → Settings → Environment Variables):

| Variable | Required | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes (outside Vercel) | `https://www.yourdomain.com` |
| `GOOGLE_SITE_VERIFICATION` | Optional | token from Google Search Console (HTML tag method) |
| `BING_SITE_VERIFICATION` | Optional | token from Bing Webmaster Tools |

`NEXT_PUBLIC_SITE_URL` drives the canonical URL, Open Graph URLs, sitemap and robots.txt. On Vercel it falls back to the project's production domain; elsewhere it falls back to `http://localhost:3000`, so set it.

## Run

```bash
npm run dev     # http://localhost:3000
npm run build   # production build (every route is statically prerendered)
npm start
```

## After the first deploy

1. Add the domain to Google Search Console and Bing Webmaster Tools.
2. Submit `https://www.yourdomain.com/sitemap.xml`.
3. Use URL Inspection → Request indexing for the home page.
4. Validate structured data at https://validator.schema.org/.
