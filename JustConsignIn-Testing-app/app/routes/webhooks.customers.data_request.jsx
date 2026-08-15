import { authenticate } from "../shopify.server";

// Mandatory Shopify compliance webhook — fires when a shop's customer
// requests a copy of their data. Shopify requires every public app to
// register this topic, even when (as here) the app holds nothing to export.
//
// JustConsignIn does not store Shopify customer data in its own database.
// The app's Prisma database (see prisma/schema.prisma) only ever holds
// OAuth session records for the merchant's own staff account — never
// shopper/customer records. Consignor and item records live entirely in
// Shopify metaobjects inside the merchant's own store, which the merchant
// already controls directly through Shopify admin; this app does not keep
// a separate copy of that data anywhere.
//
// If that ever changes (e.g. consignors get linked to real Shopify Customer
// records), this handler needs to actually look up and export matching data
// within Shopify's required window — don't leave this as a no-op then.
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`, {
    customerId: payload?.customer?.id,
    ordersRequested: payload?.orders_requested,
  });

  return new Response();
};
