// app/billing.server.js
//
// Central plan definitions + helpers for JustConsignIn's two-tier pricing:
//   TIER1 — Manual only
//   TIER2 — Manual + Shopify product sync
//
// Billing runs entirely through Shopify's GraphQL Billing API
// (appSubscriptionCreate / activeSubscriptions). Do not add Stripe, PayPal,
// or any offsite checkout — Shopify App Store review requires billing to go
// exclusively through this API for AppStore-distributed apps.

export const PLANS = {
  TIER1: {
    key: 'TIER1',
    name: 'JustConsignIn — Manual',
    amount: 19,
    currencyCode: 'USD',
    interval: 'EVERY_30_DAYS',
    trialDays: 14,
    features: [
      'Consignors',
      'Items',
      'Manual sales',
      'Payouts',
      'Transactions',
      'Reports',
      'CSV import / export',
    ],
  },
  TIER2: {
    key: 'TIER2',
    name: 'JustConsignIn — Manual + Shopify Sync',
    amount: 29,
    currencyCode: 'USD',
    interval: 'EVERY_30_DAYS',
    trialDays: 14,
    features: [
      'Everything in Manual',
      'Real Shopify products, not just line items',
      "Snap or upload a photo — it's on the listing instantly",
      'POS sync, so in-store sales update inventory everywhere',
      'Publish to your Online Store with one click',
      'Sold anywhere, marked sold everywhere — automatically',
    ],
  },
};

const CREATE_SUBSCRIPTION_MUTATION = `#graphql
  mutation AppSubscriptionCreate(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $test: Boolean
    $trialDays: Int
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      lineItems: $lineItems
      test: $test
      trialDays: $trialDays
    ) {
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

const ACTIVE_SUBSCRIPTIONS_QUERY = `#graphql
  query ActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
      }
    }
  }
`;

/**
 * Returns 'TIER1' | 'TIER2' | null for the current admin session's shop.
 * null means there's no active paid subscription — the caller should send
 * the merchant to /app/plans.
 */
export async function getActivePlan(admin) {
  const response = await admin.graphql(ACTIVE_SUBSCRIPTIONS_QUERY);
  const data = await response.json();
  const subscriptions = data?.data?.currentAppInstallation?.activeSubscriptions || [];
  const active = subscriptions.find((sub) => sub.status === 'ACTIVE');
  if (!active) return null;
  if (active.name === PLANS.TIER2.name) return 'TIER2';
  if (active.name === PLANS.TIER1.name) return 'TIER1';
  return null;
}

/**
 * Starts a subscription for the given plan key ('TIER1' | 'TIER2').
 * Returns the confirmationUrl the merchant must be redirected to so they
 * can approve the charge on Shopify's side.
 */
export async function createSubscription(admin, planKey, { returnUrl, isTest = false }) {
  const plan = PLANS[planKey];
  if (!plan) throw new Error(`Unknown plan: ${planKey}`);

  const response = await admin.graphql(CREATE_SUBSCRIPTION_MUTATION, {
    variables: {
      name: plan.name,
      returnUrl,
      test: isTest,
      trialDays: plan.trialDays || 0,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: plan.amount, currencyCode: plan.currencyCode },
              interval: plan.interval,
            },
          },
        },
      ],
    },
  });

  const data = await response.json();
  if (data?.errors?.length) {
    throw new Error(data.errors.map((error) => error.message).join(', '));
  }
  const result = data?.data?.appSubscriptionCreate;
  if (!result) {
    throw new Error('appSubscriptionCreate returned no data — check SHOPIFY_APP_URL is a full absolute URL.');
  }
  const errors = result.userErrors || [];
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(', '));
  }
  return result.confirmationUrl;
}

/**
 * TESTING REPOSITORY ONLY:
 * Tier 2 server actions are intentionally unlocked while the Tier 2 workflow
 * is being built and tested. Restore the subscription check before using this
 * behavior in production.
 */
export async function requireTier2() {
  return 'TIER2';
}

/**
 * Route/action guard: throws a 402 Response if the shop has no active plan
 * at all (neither Tier 1 nor Tier 2).
 */
export async function requireActivePlan(admin) {
  const plan = await getActivePlan(admin);
  if (!plan) {
    throw new Response(
      JSON.stringify({ error: 'No active subscription. Choose a plan to continue.' }),
      { status: 402, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return plan;
}
