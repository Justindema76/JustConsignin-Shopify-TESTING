# JustConsignIn: Shopify TESTING

**This is my testing copy of the JustConsignIn Shopify app.** Every new feature, redesign and larger change is built and tested here, on a separate Shopify test store, before it goes to the live app that merchants use.

- **Live app repo:** [JustConsignIn-Shopify-App](https://github.com/Justindema76/JustConsignIn-Shopify-App) (see its README for the full feature list)
- **Website:** https://www.justconsignin.com

```text
JustConsignin-Shopify-TESTING   ← build + test new features here (test store)
            │  approved
            ▼
JustConsignIn-Shopify-App       ← live app (merchants)
```

The app code is in the [`JustConsignIn-Testing-app/`](JustConsignIn-Testing-app/) folder.

---

## How TESTING differs from live

Apart from the files below, the app code is the same as live. Each feature is migrated once it's approved.

| File | TESTING | Live |
|---|---|---|
| `app/billing.server.js` | Billing is off: every store gets **all Growth (Tier 2) features** for free, so everything can be tested | Real Starter ($19) / Growth ($29) plans |
| `app/routes/app.plans.jsx` | Testing plans page | Real plans page |
| `shopify.app.toml` | Separate Shopify app (its own client ID), hosted on Render | `app.justconsignin.com` |
| `Dockerfile`, `package.json` engines | Node 22.18 | Live Node settings |

These files are **never copied** between the two repos, so the live app's billing and settings can't be overwritten by testing.

Because TESTING forces Growth, the Starter-only screens can't be seen here.

---

## Features built and tested here

Each of these was built in TESTING first and is now **live**:

| Feature | What it does |
|---|---|
| **Item page redesign** | Item pages split into tabs, a clear **Active / Draft** status, and a compact social panel |
| **Shopify Polaris look** | The whole app restyled to match the Shopify admin (13px text, 32px controls) so it feels native |
| **Barcode label printing** | A barcode chip in the item header, plus a "Print label" pop-up that prints straight to a thermal label printer (tested on 2.25 × 1.25 in labels) |
| **Mark manual items sold** | Growth stores can mark items that aren't linked to a Shopify product as sold |
| **Editable item number** | Changing an item number renames its record and updates the SKU and the Shopify variant SKU |
| **Paid to date and payout history** | Each consignor's list row, card and page show what they've been paid |
| **Payout receipt email** | The receipt opens in the merchant's own mail app |
| **Simpler auto-tagging** | New items get only the `Consignment` tag (for the Consignment smart collection) instead of dozens of tags |
| **"Edit in Shopify" button** | Restored on items linked to a Shopify product |

### Multi-location (in progress)

Support for stores with more than one location, built step by step:

| Step | What it does | Status |
|---|---|---|
| 1 | **Settings → Locations:** choose which Shopify locations are consignment stores (added to the app sidebar) | ✅ Live |
| 2 | **Consignor store:** each consignor has a home store, plus country and province dropdowns that default from that store. Fulfillment-service locations are hidden. | ✅ Live |
| 3 | **Stock at the right store:** new items are stocked at the consignor's store; items show the location that really holds their Shopify stock; re-syncing never changes stock | ✅ Live |
| 4 | **Filter sales and payouts by location:** record which store made each sale (from the Shopify order) and filter by it | 🔨 Next |
| 5 | **Per-location currency and date formatting** | Planned |

Store and country are saved in the existing item and consignor detail fields, so no new metaobject fields are needed.

### On the roadmap

These are the "Advanced" features listed as coming later on justconsignin.com:

- **Consignor portal:** consignors can see their own items, sales and payouts
- **Advanced reporting**
- **More integrations**

---

## Safety rules

- **Nothing gets tested on live.** Big changes are built here and tested on the test store.
- **Backups before every sync.** A backup branch is made before syncing live into TESTING, or TESTING into live (for example `backup/testing-before-live-sync-2026-10-09`).
- **Small fixes** (one-line bugs, small UI fixes) can go straight to live and are copied back here so the two don't drift apart.

## Automation

| Workflow | What it does |
|---|---|
| `.github/workflows/validate-testing-app.yml` | Builds the app on every push to `main` to catch errors |
| `.github/workflows/sync-live-into-testing.yml` | Manually copies the live app into TESTING while keeping the testing-only files |

The testing app is hosted on Render.

## Run locally

```bash
cd JustConsignIn-Testing-app
npm install
npm run dev        # shopify app dev, using the test app's config
```

---

**Developer:** Justin DeMatteis ([justindematteis.com](https://www.justindematteis.com))
