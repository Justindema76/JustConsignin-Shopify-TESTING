import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { ensureMetaobjectsInstalled } from "../metaobjects.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const setup = await ensureMetaobjectsInstalled(admin, session.shop);
  if (!setup.ok) {
    // STAGING: do not block the app if metaobject setup/repair cannot complete.
    // Existing metaobjects can still be used and setup can be retried manually.
    console.warn(`Metaobject setup skipped for ${session.shop}:`, setup.errors);
  }

  // STAGING ONLY: billing enforcement is intentionally disabled here.
  // The production app.jsx should keep the active subscription checks.

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
        /* STAGING: expose Shopify-sync controls so the full app can be tested. */
        .tier1-hidden-create-choice {
          display: flex !important;
        }
        .tier1-shopify-save {
          display: flex !important;
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
