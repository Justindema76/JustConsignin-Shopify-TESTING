// app/routes/app.plans.jsx
//
// Plan picker screen. Merchants land here after install if they have no
// active subscription, or any time they want to upgrade/downgrade.

import { useEffect } from 'react';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';
import { authenticate } from '../shopify.server';
import {
  PLANS,
  getActivePlan,
  createSubscription,
  cancelActiveSubscription,
} from '../billing.server';
import '../styles/pricing-plans.css';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const activePlan = await getActivePlan(admin);

  return {
    activePlan,
    plans: PLANS,
  };
};

export const action = async ({ request }) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    const formData = await request.formData();
    const intent = formData.get('intent');

    if (intent === 'cancel') {
      const cancelledSubscription = await cancelActiveSubscription(admin, {
        prorate: false,
      });

      return {
        cancelled: true,
        cancelledSubscription,
      };
    }

    const planKey = formData.get('plan');

    if (!planKey || !PLANS[planKey]) {
      return {
        error: `Invalid or missing plan key: ${JSON.stringify(planKey)}`,
      };
    }

    const appUrl = process.env.SHOPIFY_APP_URL || '';

    if (!appUrl) {
      return {
        error:
          'SHOPIFY_APP_URL is not set on the server - required to build an absolute returnUrl for billing.',
      };
    }

    /*
     * IMPORTANT:
     * Shopify sends the merchant back to exactly the returnUrl we provide.
     *
     * Do NOT depend on `shop` being present in the current browser URL.
     * In an embedded app, the plan form can be submitted without `shop`
     * surviving in request.url.
     *
     * We already have the authoritative shop from the authenticated Shopify
     * session, so use session.shop every time.
     */
    const returnUrl = new URL('/app/plans', appUrl);

    returnUrl.searchParams.set('shop', session.shop);

    /*
     * Preserve host when Shopify supplied it. It is useful for embedded
     * navigation, but the shop value above never depends on it.
     */
    const requestUrl = new URL(request.url);
    const hostParam = requestUrl.searchParams.get('host');

    if (hostParam) {
      returnUrl.searchParams.set('host', hostParam);
    }

    const confirmationUrl = await createSubscription(admin, planKey, {
      returnUrl: returnUrl.toString(),
      isTest: process.env.BILLING_LIVE_MODE !== 'true',
    });

    if (!confirmationUrl || typeof confirmationUrl !== 'string') {
      return {
        error: `createSubscription returned an invalid confirmationUrl: ${JSON.stringify(
          confirmationUrl,
        )}`,
      };
    }

    return {
      confirmationUrl,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.stack || error.message
        : String(error);

    console.error('[app.plans action] failed:', message);

    return {
      error: message,
    };
  }
};

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13.5 4L6 11.5L2.5 8"
        stroke="#2952d9"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 7V5a4 4 0 0 1 8 0v2"
        stroke="#5b606c"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect
        x="3"
        y="7"
        width="10"
        height="7"
        rx="1.4"
        stroke="#5b606c"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function PlanCard({
  plan,
  isActive,
  isBestValue,
  submitting,
  activePlan,
}) {
  let actionLabel = `Start ${plan.trialDays}-day free trial`;

  if (activePlan === 'TIER1' && plan.key === 'TIER2') {
    actionLabel = `Start ${plan.trialDays}-day Shopify trial`;
  } else if (activePlan === 'TIER2' && plan.key === 'TIER1') {
    actionLabel = `Start ${plan.trialDays}-day Manual trial`;
  }

  return (
    <div className={`pricing-card${isBestValue ? ' featured' : ''}`}>
      {isBestValue && (
        <span className="pricing-kicker">
          Best value
        </span>
      )}

      <div className="pricing-card-top">
        <h3 className="pricing-card-name">
          {plan.shortName}
        </h3>

        <span className="pricing-badge">
          {plan.trialDays} days free
        </span>
      </div>

      <p className="pricing-trial-line">
        {plan.trialDays}-day free trial, then
      </p>

      <p className="pricing-price-line">
        ${plan.amount}{' '}
        <span>/ 30 days</span>
      </p>

      <p className="pricing-desc">
        {plan.description}
      </p>

      <ul className="pricing-features">
        {plan.features.map((feature) => (
          <li key={feature}>
            <CheckIcon />
            {feature}
          </li>
        ))}
      </ul>

      {isActive ? (
        <span className="pricing-cta primary current">
          Current plan
        </span>
      ) : (
        <Form method="post">
          <input
            type="hidden"
            name="plan"
            value={plan.key}
          />

          <button
            type="submit"
            className="pricing-cta primary"
            disabled={submitting}
          >
            {submitting
              ? 'Redirecting...'
              : actionLabel}
          </button>
        </Form>
      )}
    </div>
  );
}

export default function PlansScreen() {
  const {
    activePlan,
    plans,
  } = useLoaderData();

  const actionData = useActionData();
  const navigation = useNavigation();

  const submitting =
    navigation.state === 'submitting' ||
    Boolean(actionData?.confirmationUrl);

  const cancelling =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === 'cancel';

  useEffect(() => {
    if (!actionData?.confirmationUrl) {
      return;
    }

    /*
     * Billing approval must leave the embedded iframe and open at the top
     * Shopify window.
     */
    window.open(
      actionData.confirmationUrl,
      '_top',
    );
  }, [actionData?.confirmationUrl]);

  const manualPlan = {
    ...plans.TIER1,
    shortName: 'Manual',
  };

  const shopifyPlan = {
    ...plans.TIER2,
    shortName: 'Shopify',
  };

  const hasActivePlan =
    Boolean(activePlan);

  const currentPlanName =
    activePlan === 'TIER2'
      ? 'Manual + Shopify Sync'
      : activePlan === 'TIER1'
        ? 'Manual'
        : null;

  return (
    <div className="pricing-page">
      <div className="pricing-wrap">
        <p className="pricing-eyebrow">
          Pricing
        </p>

        <h1>
          {hasActivePlan
            ? 'Change your JustConsignIn plan.'
            : 'Start with the plan that fits your workflow.'}
        </h1>

        <p className="pricing-sub">
          {hasActivePlan
            ? 'Your current plan stays active until you approve a different plan through Shopify. Changing plans starts a new 14-day free trial on the plan you choose.'
            : 'Try JustConsignIn free for 14 days on either plan below. A payment method is collected at signup, and billing starts only after the trial unless you cancel first.'}
        </p>

        {actionData?.cancelled && (
          <div className="pricing-error" role="status">
            <p>
              Subscription cancelled successfully through Shopify.
            </p>
          </div>
        )}

        {actionData?.error && (
          <div className="pricing-error">
            <p>
              Could not complete that billing action:
            </p>

            <pre>
              {actionData.error}
            </pre>
          </div>
        )}

        <div className="pricing-grid">
          <PlanCard
            plan={manualPlan}
            isActive={
              activePlan === manualPlan.key
            }
            isBestValue={false}
            submitting={submitting}
            activePlan={activePlan}
          />

          <PlanCard
            plan={shopifyPlan}
            isActive={
              activePlan === shopifyPlan.key
            }
            isBestValue
            submitting={submitting}
            activePlan={activePlan}
          />

          <div className="pricing-card muted">
            <div className="pricing-card-top">
              <h3 className="pricing-card-name">
                Advanced
              </h3>

              <div className="pricing-lock">
                <LockIcon />
              </div>
            </div>

            <p
              className="pricing-trial-line"
              style={{
                marginBottom: 20,
              }}
            >
              Coming later
            </p>

            <p className="pricing-desc">
              For larger operations and additional workflows.
            </p>

            <ul className="pricing-features">
              <li>
                <CheckIcon />
                Multi-location
              </li>

              <li>
                <CheckIcon />
                Consignor portal
              </li>

              <li>
                <CheckIcon />
                Advanced reporting
              </li>

              <li>
                <CheckIcon />
                Additional integrations
              </li>
            </ul>

            <button
              type="button"
              className="pricing-cta disabled"
              disabled
            >
              Not available yet
            </button>
          </div>
        </div>

        {hasActivePlan && (
          <div className="pricing-card" style={{ marginTop: 24 }}>
            <div className="pricing-card-top">
              <div>
                <p className="pricing-eyebrow" style={{ marginBottom: 6 }}>
                  Subscription
                </p>
                <h3 className="pricing-card-name">
                  {currentPlanName}
                </h3>
              </div>
            </div>

            <p className="pricing-desc">
              Cancelling stops your active JustConsignIn Shopify app subscription. You can start a plan again later from this page.
            </p>

            <Form
              method="post"
              onSubmit={(event) => {
                if (!window.confirm('Cancel your JustConsignIn subscription?')) {
                  event.preventDefault();
                }
              }}
            >
              <input
                type="hidden"
                name="intent"
                value="cancel"
              />

              <button
                type="submit"
                className="pricing-cta"
                disabled={cancelling}
              >
                {cancelling
                  ? 'Cancelling...'
                  : 'Cancel subscription'}
              </button>
            </Form>
          </div>
        )}

        <p className="pricing-fineprint">
          Prices shown in USD, billed every 30 days after the selected
          plan&apos;s 14-day trial ends. Cancel anytime before the trial
          ends and you will not be charged for that plan.
        </p>
      </div>
    </div>
  );
}
