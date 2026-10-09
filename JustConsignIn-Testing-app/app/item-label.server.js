import { authenticate } from "./shopify.server";

export async function loadItemLabel({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const itemNumber = params.itemNumber?.trim();
  if (!itemNumber) throw new Response("An item number is required.", { status: 400 });

  const response = await admin.graphql(`#graphql
    query PrintConsignmentLabel($handle: MetaobjectHandleInput!) {
      item: metaobjectByHandle(handle: $handle) {
        handle
        fields { key value }
      }
      shop { currencyCode }
    }
  `, { variables: { handle: { type: "consignment_item", handle: itemNumber.toLowerCase() } } });
  const payload = await response.json();
  if (payload.errors?.length) throw new Response("Unable to load this item for printing. Please try again.", { status: 502 });
  const item = payload.data?.item;
  if (!item) throw new Response("This consignment item was not found.", { status: 404 });
  const fields = Object.fromEntries(item.fields.map(({ key, value }) => [key, value]));
  return {
    itemNumber: fields.item_number || item.handle,
    description: fields.description || fields.type || "Consignment item",
    price: fields.price || "0",
    currency: payload.data.shop.currencyCode,
  };
}

