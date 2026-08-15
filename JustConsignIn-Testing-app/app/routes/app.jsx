import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { ensureMetaobjectsInstalled } from "../metaobjects.server";
import { getActivePlan } from "../billing.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  // After a merchant approves a billing charge, Shopify redirects the
  // browser straight to our returnUrl (?charge_id=...) as a bare top-level
  // page load — completely outside the Shopify admin iframe, with no
  // host/embedded params. Rendering the embedded shell here crashes App
  // Bridge exactly like our very first bug ("missing required configuration
  // fields: shop"), because there's nothing to embed into. Detect that
  // specific case and bounce the top-level browser back into the real
  // embedded admin URL — Shopify re-embeds it there with all the right
  // context, and this loader runs again normally on the next request.
  const url = new URL(request.url);
  const isEmbeddedRequest = url.searchParams.get("embedded") === "1" || url.searchParams.get("host");
  if (!isEmbeddedRequest && url.searchParams.get("charge_id")) {
    const apiKey = process.env.SHOPIFY_API_KEY || "";
    throw new Response(null, {
      status: 302,
      headers: { Location: `https://${session.shop}/admin/apps/${apiKey}${url.search}` },
    });
  }

  const setup = await ensureMetaobjectsInstalled(admin, session.shop);
  if (!setup.ok) {
    // Do not crash the whole app over a metaobject repair failure — this can
    // legitimately happen when a definition is owned by a different app
    // registration on this shop. Reads/writes to existing entries still work.
    // Visit /app/setup to retry manually if a genuinely new field is needed.
    console.warn(`Metaobject setup skipped for ${session.shop}:`, setup.errors);
  }

  // Send merchants with no active subscription to the plan picker before
  // they see anything else. Skip the check on /app/plans itself to avoid a
  // redirect loop.
  if (url.pathname !== "/app/plans") {
    const activePlan = await getActivePlan(admin);
    if (!activePlan) {
      // Preserve the embedded-app query params (shop, host, id_token, etc.)
      // on the redirect. Dropping them breaks App Bridge's initialization on
      // the destination route ("missing required configuration fields: shop").
      throw new Response(null, {
        status: 302,
        headers: { Location: `/app/plans${url.search}` },
      });
    }
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Consignment</s-link>
      </s-app-nav>
      <Outlet />
      <style>{`
        /* Keep the original Shopify product section unchanged. */
        .tier1-hidden-create-choice {
          display: flex !important;
        }
        .tier1-shopify-save {
          display: none !important;
        }
      `}</style>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
