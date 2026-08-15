import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory Shopify compliance webhook — fires 48 hours after a shop
// uninstalls the app, as the final guaranteed instruction to delete any
// shop-related data the app still holds.
//
// The app's own database only ever stores OAuth session records for this
// shop (see prisma/schema.prisma) — webhooks.app.uninstalled.jsx already
// clears these when the shop uninstalls, but this webhook is Shopify's
// mandatory backstop in case that cleanup didn't happen (e.g. the
// uninstall webhook failed to deliver). Consignor and item data are not
// duplicated into this app's own database — they live in the merchant's
// own Shopify metaobjects and are the merchant's data, not this app's, so
// there's nothing else here to purge.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
