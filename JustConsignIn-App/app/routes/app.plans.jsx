// app/routes/app.plans.jsx
//
// Plan picker screen. Merchants land here after install if they have no
// active subscription, or any time they want to upgrade/downgrade.

import { useEffect } from 'react';
import { Form, useLoaderData, useNavigation, useActionData } from 'react-router';
import { authenticate } from '../shopify.server';
import { PLANS, getActivePlan, createSubscription } from '../billing.server';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const activePlan = await getActivePlan(admin);
  return { activePlan, plans: PLANS };
};

export const action = async ({ request }) => {
  // IMPORTANT: this action never throws on purpose. React Router strips the
  // real message off thrown errors before they reach the browser in a
  // production build ("Unexpected Server Error" is all you'll ever see) —
  // so any failure here is caught and returned as normal action data
  // instead, which is NOT stripped. That's the only way to see what's
  // actually going wrong without pulling server logs.
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const planKey = formData.get('plan');

    if (!planKey || !PLANS[planKey]) {
      return { error: `Invalid or missing plan key: ${JSON.stringify(planKey)}` };
    }

    const appUrl = process.env.SHOPIFY_APP_URL || '';
    if (!appUrl) {
      return { error: 'SHOPIFY_APP_URL is not set on the server — required to build an absolute returnUrl for billing.' };
    }
    const returnUrl = `${appUrl}/app`;

    const confirmationUrl = await createSubscription(admin, planKey, {
      returnUrl,
      // Do NOT derive this from NODE_ENV — Render sets NODE_ENV=production
      // on every Node web service by default, whether or not you're really
      // in production. That silently sent test: false to Shopify, which a
      // Developer Preview / dev store can't accept ("The shop cannot accept
      // the provided charge"). Use an explicit, deliberate flag instead —
      // set BILLING_LIVE_MODE=true on Render only once you're ready to
      // charge real merchants for real.
      isTest: process.env.BILLING_LIVE_MODE !== 'true',
    });

    if (!confirmationUrl || typeof confirmationUrl !== 'string') {
      return { error: `createSubscription returned an invalid confirmationUrl: ${JSON.stringify(confirmationUrl)}` };
    }

    // IMPORTANT: do NOT Response.redirect() here. This runs inside an
    // embedded app's iframe, and a server-side 3xx redirect gets followed
    // by the iframe's own document load — landing on
    // admin.shopify.com/.../confirm_recurring_application_charge INSIDE the
    // iframe, which Shopify's own anti-framing protection blocks outright
    // ("admin.shopify.com refused to connect"). The confirmation screen has
    // to load in the full top-level browser tab instead. So we hand the URL
    // back as normal data, and the client breaks out of the iframe itself
    // using target="_top" (Shopify's documented pattern for this exact case).
    return { confirmationUrl };
  } catch (error) {
    // Catches literally anything: GraphQL client errors, network failures,
    // authenticate.admin() failures, thrown Errors from billing.server.js,
    // bad URL construction in Response.redirect, all of it.
    const message = error instanceof Error ? (error.stack || error.message) : String(error);
    // Still goes to Render's logs for a permanent record...
    console.error('[app.plans action] failed:', message);
    // ...and also comes straight back to the browser, unstripped.
    return { error: message };
  }
};

export default function PlansScreen() {
  const { activePlan, plans } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting' || Boolean(actionData?.confirmationUrl);

  // Escape the app's iframe to load Shopify's billing confirmation screen
  // in the full top-level browser tab. A server-side redirect can't do this
  // — it gets blocked by admin.shopify.com's own anti-framing protection.
  useEffect(() => {
    if (actionData?.confirmationUrl) {
      window.open(actionData.confirmationUrl, '_top');
    }
  }, [actionData?.confirmationUrl]);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px 80px', fontFamily: '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif' }}>
      <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2952d9', margin: '0 0 12px' }}>
        Pricing
      </p>
      <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700, fontSize: 34, lineHeight: 1.15, margin: '0 0 16px', maxWidth: '18ch' }}>
        Choose your plan
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: '#5b606c', maxWidth: '56ch', margin: '0 0 40px' }}>
        Try JustConsignIn free for 14 days on either plan below. A payment
        method is collected at signup, and billing starts only after the
        trial unless you cancel first.
      </p>

      {actionData?.error && (
        <div style={{ marginBottom: 24, border: '2px solid #c0392b', background: '#fdecea', borderRadius: 12, padding: '16px 20px' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>Couldn't start that plan:</p>
          <pre
            style={{
              margin: '8px 0 0',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
            }}
          >
            {actionData.error}
          </pre>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        {Object.values(plans).map((plan) => {
          const isActive = activePlan === plan.key;
          const shortName = plan.name.split('—')[1]?.trim() || plan.name;
          const isBestValue = plan.key === 'TIER2';
          return (
            <div
              key={plan.key}
              style={{
                position: 'relative',
                background: '#fff',
                border: isBestValue ? '2px solid #2952d9' : '1px solid #e4e6ea',
                borderRadius: 14,
                padding: '28px 24px 24px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: isBestValue ? '0 1px 2px rgba(23,24,28,0.04)' : undefined,
              }}
            >
              {isBestValue && (
                <span
                  style={{
                    position: 'absolute',
                    top: -11,
                    left: 20,
                    background: '#2952d9',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '4px 10px',
                    borderRadius: 999,
                  }}
                >
                  Best value
                </span>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: isBestValue ? '#1f3fae' : undefined }}>
                  {shortName}
                </h3>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#1c7a3e',
                    background: '#e7f6ec',
                    padding: '5px 10px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                  }}
                >
                  14 days free
                </span>
              </div>

              <p style={{ fontSize: 14, color: '#5b606c', margin: '6px 0 2px' }}>14-day free trial, then</p>
              <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>
                ${plan.amount}
                <span style={{ fontWeight: 400, color: '#5b606c' }}> / 30 days</span>
              </p>

              <ul style={{ listStyle: 'none', margin: '0 0 24px', padding: 0, flexGrow: 1 }}>
                {plan.features.map((feature) => (
                  <li key={feature} style={{ fontSize: 14, padding: '6px 0', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 3 }}>
                      <path d="M13.5 4L6 11.5L2.5 8" stroke="#2952d9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {isActive ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    padding: '13px 20px',
                    borderRadius: 9,
                    fontSize: 15,
                    fontWeight: 700,
                    background: '#e7f6ec',
                    color: '#1c7a3e',
                  }}
                >
                  Current plan
                </span>
              ) : (
                <Form method="post">
                  <input type="hidden" name="plan" value={plan.key} />
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      padding: '13px 20px',
                      borderRadius: 9,
                      fontSize: 15,
                      fontWeight: 700,
                      border: 'none',
                      cursor: submitting ? 'default' : 'pointer',
                      background: '#2952d9',
                      color: '#fff',
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? 'Redirecting…' : `Start free trial`}
                  </button>
                </Form>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 40, fontSize: 13, color: '#5b606c', maxWidth: '60ch', lineHeight: 1.6 }}>
        Prices shown in USD, billed every 30 days after your 14-day trial ends.
        Cancel anytime before the trial ends and you won't be charged.
      </p>
    </div>
  );
}
