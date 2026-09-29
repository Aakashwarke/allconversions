# AllConversions — cost, moat and revenue

This is the reasoning behind the architecture. The short version: converting
files **in the browser** instead of on a server changes the unit economics of
this business by roughly two orders of magnitude, and it buys a marketing claim
the incumbents structurally cannot copy.

---

## 1. Is the idea any good?

Honestly: the *category* is proven and the *competition* is brutal.

Smallpdf, iLovePDF, Zamzar, CloudConvert and Adobe's own free tools already own
this space. iLovePDF alone does hundreds of millions of visits a year. You will
not out-spend them and you will not out-feature them on day one.

What you *can* do is attack the one thing they all share: **they upload your
file to a stranger's server.**

Every one of those products is built on server-side conversion. That is not a
choice they can reverse cheaply — it is their entire infrastructure, their
pricing model and their scaling story. It also means:

- they have per-conversion costs, so they impose file-size caps, daily limits,
  watermarks and paywalls;
- they must answer "where did my contract/payslip/passport scan go?";
- they are a breach waiting to happen, and several have had one.

Doing it client-side inverts all three. That is the wedge. It is narrow, but it
is real, and it is defensible precisely because copying it would require the
incumbents to rewrite their product.

**Realistic expectation:** this is a 12–24 month SEO play, not a launch-and-win.
The traffic in this vertical comes almost entirely from long-tail search
("convert pdf to word free", "epub to pdf no upload"). That is why the site
generates a dedicated static page for all 281 conversions plus their common
search aliases — 374 indexable URLs from one codebase.

---

## 2. What it costs to run

The architecture has no conversion servers, no file storage and no queue.
What remains is static hosting.

### Bandwidth is the only variable cost

| Asset | Size (gzipped) | Who downloads it |
|---|---|---|
| HTML page | ~7 KB | every visit |
| App JS (React + UI) | ~180 KB | every visit, then cached |
| Font subset | ~25 KB | every visit, then cached |
| Engine chunk (PDF / sheet / doc) | 90–400 KB | only on first conversion of that type |
| FFmpeg wasm core | ~31 MB *(uncompressed)* | only for audio/video, once per browser |

The FFmpeg core is the one line that matters. Everything else is rounding.

### Monthly cost at each stage

Assumes Cloudflare Pages + R2, ~250 KB average first visit, and 3% of sessions
performing an audio/video conversion.

| Visits / month | Static egress | FFmpeg egress | **Total infra** | Notes |
|---|---|---|---|---|
| 10,000 | ~2.5 GB | ~9 GB | **$0** | Free tier, comfortably |
| 100,000 | ~25 GB | ~93 GB | **$0–5** | Still free tier |
| 1,000,000 | ~250 GB | ~930 GB | **$5–20** | R2 storage + Pages; egress free |
| 10,000,000 | ~2.5 TB | ~9.3 TB | **$50–150** | Enterprise Pages or R2 + custom domain |

Add the fixed costs, which do not scale with traffic:

| Item | Cost |
|---|---|
| Domain | ~$12 / year |
| Email (Cloudflare routing → existing inbox) | $0 |
| Analytics (Cloudflare Web Analytics, or Plausible) | $0 / $9 per month |
| Error tracking (Sentry free tier) | $0 |
| CI/CD (GitHub Actions free tier) | $0 |

**So: roughly $0/month to launch, and under $200/month at 10 million visits.**

> **Pick Cloudflare specifically.** On AWS (S3 + CloudFront) the same 10 TB of
> egress costs about **$850/month** at $0.085/GB. Cloudflare R2 and Pages do not
> bill egress. At this asset profile that single choice is the difference
> between a hobby's running cost and a real bill.

### What the server-side version would have cost

For comparison, at 1M conversions/month with an average 3 seconds of CPU each:

- ~830 CPU-hours/month → 4–8 always-on workers with headroom for spikes
- egress *and ingress* for every file, in both directions
- temporary object storage, lifecycle rules, deletion guarantees
- SOC2 / GDPR posture, a DPA, and a breach plan

Realistically **$400–900/month** at that volume, before anyone is paid. And it
grows linearly with usage forever, which is why every competitor has a paywall.

---

## 3. How it makes money

Four streams, in the order they should be switched on.

### a) Display advertising — the base load
This vertical monetises well because intent is high and sessions are short.

- Realistic RPM: **$4–8** with AdSense early on; **$12–25** with Ezoic,
  Mediavine or Raptive once you clear their traffic floors (Ezoic ~10k/mo,
  Mediavine ~50k sessions/mo).
- One ad unit below the converter and one in the footer. **Not** above the tool
  and never interstitial — the entire pitch is "fast and clean", and a site that
  feels like a trap loses the repeat visits that make SEO compound.

At 1M pageviews/month and a conservative $5 RPM: **~$5,000/month.**

### b) Pro subscription — $3/month
Deliberately cheap. There is no marginal cost to serve a Pro user, so the price
only has to clear the payment processor and feel like an easy yes.

What Pro buys: no ads, batch queue with saved presets, an installable offline
PWA, and OCR for scanned PDFs (the one genuinely missing capability).

Conversion in free-tool markets runs 0.1–1%. At 1M visits (~500k uniques),
even **0.2% is ~1,000 subscribers = $3,000/month** recurring.

### c) API access — $19/month and up
The same engines, running headless server-side, sold to developers who want
conversion inside their own product. This is the highest-margin line and the
least traffic-dependent. 50 customers is another **$950/month**.

Note this is the one part that *does* need servers — but they are paid for by
the customers using them, which is the correct shape.

### d) Affiliate placement
Contextual, not spammy: a PDF editor recommendation on the PDF pages, a cloud
storage referral on the "download all" screen. Adds 5–15% on top of ad revenue
in this category.

### Rough picture at 1M visits/month

| Stream | Monthly |
|---|---|
| Ads (conservative $5 RPM) | $5,000 |
| Pro (0.2% of uniques) | $3,000 |
| API (50 customers) | $950 |
| Affiliate | $500 |
| **Revenue** | **~$9,450** |
| **Infra cost** | **~$20** |

The margin is not a typo. It is what happens when the customer's own hardware
does the compute.

---

## 4. Why the downloaded file is named `AllConversions_yourfile.pdf`

It is deliberate, and it does three jobs:

1. **It solves a real user problem.** After converting, you have `report.pdf` and
   `report.docx` in the same folder. The prefix makes the converted copy obvious
   at a glance.
2. **It is the cheapest distribution channel available.** That file gets emailed,
   dropped in Slack and shared to Drive. Every one of those is the brand name in
   front of a new person, at zero cost.
3. **It is honest.** It is a filename, not a watermark. The file contents are
   untouched and the user can rename it freely — which is exactly why it does not
   feel hostile the way a stamped-over PDF does.

Implemented in `lib/naming.ts`, applied at download time, and it deliberately
does not stack when you re-convert an already-converted file.

---

## 5. The honest risks

- **SEO is slow and the incumbents have a decade of domain authority.** Budget
  12–24 months before organic traffic is meaningful.
- **Big files hit browser memory limits.** The 2GB cap is real, and a 1.5GB video
  will struggle on a low-end phone. Server-side competitors handle these better.
- **Scanned PDFs need OCR**, which is a further ~10MB wasm download
  (Tesseract). Currently surfaced as a clear error rather than a bad result.
- **Fidelity ceiling on complex DOCX→PDF.** Reconstructing a heavily formatted
  Word document in-browser will not match LibreOffice rendering. For those, an
  optional server-side "high fidelity" path is the natural Pro upsell.
- **Ad blockers** are common in a technical audience. This is a real dent in
  stream (a), and the main reason Pro and API matter.
