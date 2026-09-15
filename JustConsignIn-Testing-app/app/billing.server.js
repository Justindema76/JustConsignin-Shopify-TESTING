// app/billing.server.js
//
// JustConsignIn Shopify Billing
//
// TIER1 = Manual
// TIER2 = Manual + Shopify Sync
//
// Shopify Billing API only.
// No Stripe, PayPal, or external billing.

export const PLANS = {
  TIER1: {
    key: 'TIER1',
    name: 'JustConsignIn - Manual',
    amount: 19,
    currencyCode: 'USD',
    interval: 'EVERY_30_DAYS',
    trialDays: 14,

    description:
      'Manual consignment management for stores that do not need Shopify product syncing.',

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
    name: 'JustConsignIn - Manual + Shopify Sync',
    amount: 29,
    currencyCode: 'USD',
    interval: 'EVERY_30_DAYS',
    trialDays: 14,

    description:
      'Full consignment management with Shopify products, POS, inventory and Online Store publishing.',

    features: [
      'Everything in Manual',
      'Create real Shopify products',
      'Upload product photos',
      'Shopify POS sync',
      'Online Store publishing',
      'Inventory synchronization',
      'Automatic Shopify sale tracking',
    ],
  },
};


/* =========================================================
   GRAPHQL
   ========================================================= */

const ACTIVE_SUBSCRIPTIONS_QUERY = `#graphql
  query ActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        createdAt
        currentPeriodEnd
        trialDays
      }
    }
  }
`;


const CREATE_SUBSCRIPTION_MUTATION = `#graphql
  mutation AppSubscriptionCreate(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $test: Boolean
    $trialDays: Int
    $replacementBehavior: AppSubscriptionReplacementBehavior
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      lineItems: $lineItems
      test: $test
      trialDays: $trialDays
      replacementBehavior: $replacementBehavior
    ) {
      confirmationUrl

      appSubscription {
        id
        name
        status
      }

      userErrors {
        field
        message
      }
    }
  }
`;


const CANCEL_SUBSCRIPTION_MUTATION = `#graphql
  mutation AppSubscriptionCancel(
    $id: ID!
    $prorate: Boolean
  ) {
    appSubscriptionCancel(
      id: $id
      prorate: $prorate
    ) {
      appSubscription {
        id
        name
        status
      }

      userErrors {
        field
        message
      }
    }
  }
`;


/* =========================================================
   HELPERS
   ========================================================= */

function planKeyFromSubscriptionName(name) {
  if (name === PLANS.TIER1.name) {
    return 'TIER1';
  }

  if (name === PLANS.TIER2.name) {
    return 'TIER2';
  }

  return null;
}


function graphqlErrors(data) {
  if (!data?.errors?.length) {
    return null;
  }

  return data.errors
    .map((error) => error.message)
    .join(', ');
}


function userErrors(errors = []) {
  if (!errors.length) {
    return null;
  }

  return errors
    .map((error) => error.message)
    .join(', ');
}


/* =========================================================
   ACTIVE SUBSCRIPTION
   ========================================================= */

export async function getActiveSubscription(admin) {
  const response = await admin.graphql(
    ACTIVE_SUBSCRIPTIONS_QUERY,
  );

  const data = await response.json();

  const topLevelError = graphqlErrors(data);

  if (topLevelError) {
    throw new Error(topLevelError);
  }

  const subscriptions =
    data?.data
      ?.currentAppInstallation
      ?.activeSubscriptions || [];

  const active =
    subscriptions.find(
      (subscription) =>
        subscription.status === 'ACTIVE',
    ) || null;

  if (!active) {
    return null;
  }

  return {
    ...active,

    planKey:
      planKeyFromSubscriptionName(
        active.name,
      ),
  };
}


/* =========================================================
   ACTIVE PLAN
   ========================================================= */

export async function getActivePlan(admin) {
  // TESTING REPOSITORY ONLY:
  // Always unlock the full Tier 2 feature set in the testing app.
  // Production billing remains untouched in the live repository.
  return 'TIER2';
}


/* =========================================================
   CREATE / CHANGE PLAN
   ========================================================= */

export async function createSubscription(
  admin,
  planKey,
  {
    returnUrl,
    isTest = false,
  },
) {
  const plan = PLANS[planKey];

  if (!plan) {
    throw new Error(
      `Unknown plan: ${planKey}`,
    );
  }

  if (!returnUrl) {
    throw new Error(
      'A Shopify billing returnUrl is required.',
    );
  }

  const response = await admin.graphql(
    CREATE_SUBSCRIPTION_MUTATION,
    {
      variables: {
        name: plan.name,

        returnUrl,

        test: isTest,

        trialDays:
          plan.trialDays || 0,

        replacementBehavior:
          'STANDARD',

        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: {
                  amount:
                    plan.amount,

                  currencyCode:
                    plan.currencyCode,
                },

                interval:
                  plan.interval,
              },
            },
          },
        ],
      },
    },
  );

  const data = await response.json();

  const topLevelError =
    graphqlErrors(data);

  if (topLevelError) {
    throw new Error(
      topLevelError,
    );
  }

  const result =
    data?.data
      ?.appSubscriptionCreate;

  if (!result) {
    throw new Error(
      'Shopify did not return appSubscriptionCreate data.',
    );
  }

  const mutationError =
    userErrors(
      result.userErrors,
    );

  if (mutationError) {
    throw new Error(
      mutationError,
    );
  }

  if (!result.confirmationUrl) {
    throw new Error(
      'Shopify did not return a billing confirmation URL.',
    );
  }

  return result.confirmationUrl;
}


/* =========================================================
   CANCEL SUBSCRIPTION
   ========================================================= */

export async function cancelActiveSubscription(
  admin,
  {
    prorate = false,
  } = {},
) {
  const subscription =
    await getActiveSubscription(
      admin,
    );

  if (!subscription?.id) {
    throw new Error(
      'No active Shopify subscription was found.',
    );
  }

  const response = await admin.graphql(
    CANCEL_SUBSCRIPTION_MUTATION,
    {
      variables: {
        id: subscription.id,
        prorate,
      },
    },
  );

  const data = await response.json();

  const topLevelError =
    graphqlErrors(data);

  if (topLevelError) {
    throw new Error(
      topLevelError,
    );
  }

  const result =
    data?.data
      ?.appSubscriptionCancel;

  if (!result) {
    throw new Error(
      'Shopify did not return appSubscriptionCancel data.',
    );
  }

  const mutationError =
    userErrors(
      result.userErrors,
    );

  if (mutationError) {
    throw new Error(
      mutationError,
    );
  }

  return (
    result.appSubscription ||
    null
  );
}


/* =========================================================
   TIER 2 GUARD
   ========================================================= */

export async function requireTier2(admin) {
  const plan =
    await getActivePlan(admin);

  if (plan !== 'TIER2') {
    throw new Response(
      JSON.stringify({
        error:
          'This feature requires the Manual + Shopify Sync plan.',
      }),
      {
        status: 402,

        headers: {
          'Content-Type':
            'application/json',
        },
      },
    );
  }

  return plan;
}


/* =========================================================
   ACTIVE PLAN GUARD
   ========================================================= */

export async function requireActivePlan(admin) {
  const plan =
    await getActivePlan(admin);

  if (!plan) {
    throw new Response(
      JSON.stringify({
        error:
          'No active subscription. Choose a plan to continue.',
      }),
      {
        status: 402,

        headers: {
          'Content-Type':
            'application/json',
        },
      },
    );
  }

  return plan;
}