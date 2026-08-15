import { authenticate } from "../shopify.server";

const ITEM_QUERY = `#graphql
  query PaidConsignmentItem($handle: MetaobjectHandleInput!) {
    item: metaobjectByHandle(handle: $handle) {
      id
      handle
      fields {
        key
        jsonValue
        reference {
          ... on Product {
            id
            status
          }
        }
      }
    }
  }
`;

const ITEM_UPSERT_MUTATION = `#graphql
  mutation RecordConsignmentSale(
    $handle: MetaobjectHandleInput!
    $metaobject: MetaobjectUpsertInput!
  ) {
    metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject {
        id
        handle
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation RetireSoldConsignmentProduct($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function values(fields = []) {
  return Object.fromEntries(fields.map((field) => [field.key, field.jsonValue]));
}

function references(fields = []) {
  return Object.fromEntries(
    fields
      .filter((field) => field.reference)
      .map((field) => [field.key, field.reference]),
  );
}

function salePrice(lineItem) {
  const quantity = Math.max(1, Number(lineItem.quantity) || 1);
  const unitPrice = Number(lineItem.price) || 0;
  const unitDiscount = (Number(lineItem.total_discount) || 0) / quantity;
  return Math.max(0, unitPrice - unitDiscount).toFixed(2);
}

function saleDate(payload) {
  const timestamp = payload.processed_at || payload.created_at;
  const parsed = timestamp ? new Date(timestamp) : new Date();
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10);
}

function saleSource(payload) {
  const source = String(payload.source_name || payload.sourceName || "").trim().toLowerCase();

  if (source === "pos" || source.includes("point_of_sale") || source.includes("point of sale")) {
    return "POS";
  }
  if (source === "web" || source === "online_store" || source.includes("online")) {
    return "Online";
  }

  // Keep unknown Shopify mechanisms honest rather than incorrectly calling
  // them POS or Online.
  return "Shopify";
}

function itemDetailsWithSaleSource(rawValue, source) {
  const fallback = {
    schema: "consignment-product-details-v1",
    notes: "",
    tags: [],
    vendor: "",
    brand: "",
    productDescription: "",
    shopifyTitle: "",
    shopifyPrice: null,
    shopifyCategoryId: "",
    shopifyCategoryName: "",
    seoTitle: "",
    seoDescription: "",
    publishOnline: false,
    payoutId: "",
    payoutDate: "",
    payoutMethod: "",
    payoutReference: "",
    payoutNote: "",
    payoutAmount: 0,
    payoutTotal: 0,
    payoutAdjustment: 0,
    importKey: "",
  };

  if (!rawValue) {
    return JSON.stringify({ ...fallback, saleSource: source });
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed?.schema === "consignment-product-details-v1") {
      return JSON.stringify({ ...fallback, ...parsed, saleSource: source });
    }
  } catch {
    // Older plain-text notes are preserved below.
  }

  return JSON.stringify({
    ...fallback,
    notes: String(rawValue),
    saleSource: source,
  });
}

function assertUserErrors(result, operation) {
  if (result?.userErrors?.length) {
    throw new Error(
      `${operation}: ${result.userErrors.map((error) => error.message).join(", ")}`,
    );
  }
}

async function graphql(admin, query, variables) {
  const response = await admin.graphql(query, { variables });
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(", "));
  }
  return payload.data;
}

async function recordSoldItem(admin, payload, lineItem) {
  const ticket = String(lineItem.sku || "").trim();
  if (!ticket) {
    return { status: "ignored", reason: "missing SKU" };
  }

  const handle = {
    type: "consignment_item",
    handle: ticket.toLowerCase(),
  };
  const data = await graphql(admin, ITEM_QUERY, { handle });
  if (!data.item) {
    return { status: "ignored", ticket, reason: "not a consignment item" };
  }

  const field = values(data.item.fields);
  const reference = references(data.item.fields);
  const orderId = String(payload.admin_graphql_api_id || payload.id || "");
  const source = saleSource(payload);

  const alreadyRecorded =
    field.status === "Sold" && String(field.order_id || "") === orderId;

  if (!alreadyRecorded) {
    const sold = await graphql(admin, ITEM_UPSERT_MUTATION, {
      handle,
      metaobject: {
        fields: [
          { key: "status", value: "Sold" },
          { key: "sale_price", value: salePrice(lineItem) },
          { key: "date_sold", value: saleDate(payload) },
          { key: "order_name", value: String(payload.name || payload.order_number || "") },
          { key: "order_id", value: orderId },
          { key: "notes", value: itemDetailsWithSaleSource(field.notes, source) },
          { key: "paid_out", value: "false" },
        ],
      },
    });
    assertUserErrors(sold.metaobjectUpsert, `Could not record sale for ${ticket}`);
  }

  const linkedProduct = reference.shopify_product;
  const productId = linkedProduct?.id || (
    lineItem.product_id
      ? `gid://shopify/Product/${lineItem.product_id}`
      : null
  );
  if (productId && linkedProduct?.status !== "DRAFT") {
    const retired = await graphql(admin, PRODUCT_UPDATE_MUTATION, {
      product: {
        id: productId,
        status: "DRAFT",
      },
    });
    assertUserErrors(retired.productUpdate, `Could not archive product for ${ticket}`);
  }

  return {
    status: alreadyRecorded ? "already-recorded" : "sold",
    ticket,
    saleSource: source,
  };
}

export const action = async ({ request }) => {
  const { admin, payload, shop, topic } = await authenticate.webhook(request);

  if (!admin) {
    console.error(`No Admin API session available for ${topic} webhook on ${shop}`);
    return new Response("Missing Admin API session", { status: 500 });
  }

  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];
  const results = [];

  for (const lineItem of lineItems) {
    results.push(await recordSoldItem(admin, payload, lineItem));
  }

  console.log(`Processed ${topic} webhook for ${shop}`, {
    order: payload.name || payload.id,
    source: saleSource(payload),
    results,
  });

  return new Response();
};
