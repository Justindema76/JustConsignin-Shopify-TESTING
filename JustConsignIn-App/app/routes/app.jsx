import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { ensureMetaobjectsInstalled } from "../metaobjects.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const setup = await ensureMetaobjectsInstalled(admin, session.shop);
  if (!setup.ok) {
    // Do not crash the whole app over a metaobject repair failure — this can
    // legitimately happen when a definition is owned by a different app
    // registration on this shop. Reads/writes to existing entries still work.
    console.warn(`Metaobject setup skipped for ${session.shop}:`, setup.errors);
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