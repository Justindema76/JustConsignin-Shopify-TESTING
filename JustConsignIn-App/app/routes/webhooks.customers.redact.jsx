import { authenticate } from "../shopify.server";

// Mandatory Shopify compliance webhook — fires ~10 days after a shop's
// customer requests erasure (or automatically ~6 months after their last
// order), instructing the app to delete any personal data it holds about
// that specific customer.
//
// JustConsignIn does not store Shopify customer data in its own database
// — see webhooks.customers.data_request.jsx for the full explanation.
// Consignor records are separate, merchant-managed metaobjects inside the
// merchant's own store and are not linked to Shopify Customer IDs, so
// there is nothing in this app's own database to redact for a given
// customer.
//
// If consignors are ever linked to real Shopify Customer records in the
// future, this handler needs to actually locate and redact matching data
// — don't leave this as a no-op then.
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`, {
    customerId: payload?.customer?.id,
  });

  return new Response();
};
