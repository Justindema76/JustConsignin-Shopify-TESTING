import { redirect, useLoaderData } from 'react-router';
import { authenticate } from '../shopify.server';
import { getActivePlan } from '../billing.server';
import TierOneConsignmentApp from '../tier1_consignment_app';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const activePlan = await getActivePlan(admin);

  // No active subscription — send the merchant to the plan picker first.
  // This is what makes /app/plans the actual landing screen right after
  // install, instead of the dashboard rendering (unstyled/unusable) behind
  // a paywall nobody's hit yet.
  //
  // IMPORTANT: this is a server-side loader redirect, which forces a brand
  // new top-level document load of the embedded iframe — not a client-side
  // SPA navigation. Shopify's embedded auth (shop, host, embedded, hmac,
  // timestamp, session token) travels as query params on that request, and
  // App Bridge needs them present on the NEW document load to reinitialize.
  // A bare `redirect('/app/plans')` drops all of them, which is exactly
  // what broke this — the next request had no `shop` param, authenticate
  // couldn't resolve it, and App Bridge failed with "missing required
  // configuration fields: shop". Always carry the original search params
  // forward on any redirect inside the embedded app.
  if (!activePlan) {
    const url = new URL(request.url);
    throw redirect(`/app/plans${url.search}`);
  }

  return { activePlan };
};

export default function AppIndex() {
  const { activePlan } = useLoaderData();
  return <TierOneConsignmentApp activePlan={activePlan} />;
}
