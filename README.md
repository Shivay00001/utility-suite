# VisionQuantech Tools — Utility Suite

Free, client-side utility tools (no backend, zero marginal cost). Monetized via display ads (free tier) + Pro subscriptions + a future REST API.

## Structure

| Path | What |
|---|---|
| `index.html` | Landing page, tool grid, FAQ schema |
| `tools/*.html` | 10 tool pages, each with SEO meta + FAQ JSON-LD + AdSense placeholders |
| `pricing.html` | Free vs Pro ($5/mo) vs Enterprise API |
| `api.html` | API docs (endpoints, auth, pricing tiers) — docs only, no backend yet |
| `css/styles.css`, `js/common.js` | Shared design + helpers |
| `assets/` | Vendored libs: `pdf-lib.min.js`, `jszip.min.js`, `qrcode.min.js` (works offline / from file://) |
| `sitemap.xml`, `robots.txt` | SEO basics |
| `tests/verify.mjs` | 24 automated functional tests |

## Tools (all run 100% in-browser)

1. Image Compressor — canvas JPEG/WebP re-encode + downscale
2. Image Resizer — exact px / % / social presets
3. Image Format Converter — JPG ↔ PNG ↔ WebP
4. PDF Compressor — lossless rebuild (object streams, metadata strip)
5. PDF Merger — multi-file, reorder, pdf-lib
6. PDF Splitter — page ranges → PDF, or every page → ZIP (JSZip)
7. QR Code Generator — URL/text/Wi-Fi/vCard → PNG
8. Word Counter — words/chars/sentences/reading time, live
9. Password Generator — crypto.getRandomValues + entropy meter
10. JSON Formatter — beautify/minify/validate

## Run locally

Just open `index.html` — no server needed. (Python: `python3 -m http.server` in this dir.)

## Re-run tests

```bash
npm install   # jsdom + canvas + pdf-lib + jszip (dev only)
node tests/verify.mjs   # expect: 24 passed, 0 failed
```

## Monetization (as designed)

- **Free:** all tools unlimited-ish (25 MB/file, 5 files/batch), display ads via AdSense placeholder slots (`<!-- ADSENSE: ... -->` comments mark every slot).
- **Pro $5/mo:** no ads, 200 MB files, 100-file batches. Checkout link is a stub (`pricing.html`).
- **API:** Free 1k calls/mo → Pro $19/mo (25k) → Scale $99/mo (250k) → Enterprise custom. Docs live in `api.html`; hosted API is waitlist-only (no backend built).
- Reference comps: TinyPNG Pro $39/yr, Ultra $149/yr; Tinify API $0.009/compression after 500 free/mo; Smallpdf Pro $12/mo; iLovePDF Premium ~£5–9/mo. Tool-site AdSense RPM ≈ $1–3 (India) / $3–8 (blended).

## Notes / limits

- PDF "compression" is lossless structural optimization (10–40% typical on office PDFs); scanned PDFs gain little. Copy on the page says this honestly.
- WebP output needs a modern browser (all current ones support it).
- Nothing is deployed. To launch: point `tools.visionquantech.com` at this folder on any static host (Cloudflare Pages / Netlify / cPanel).
