import { authenticate } from '../shopify.server';

const ITEM_QUERY = `#graphql
  query PosConsignmentItem($handle: MetaobjectHandleInput!) {
    shop {
      currencyCode
    }
    item: metaobjectByHandle(handle: $handle) {
      id
      handle
      fields {
        key
        jsonValue
        reference {
          ... on MediaImage {
            id
            image { url }
          }
          ... on GenericFile {
            id
            url
          }
          ... on Metaobject {
            id
            handle
            fields { key jsonValue }
          }
          ... on Product {
            id
            title
            status
            variants(first: 10) {
              nodes {
                id
                sku
              }
            }
          }
        }
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

function numericId(gid) {
  const value = Number(String(gid || '').split('/').pop());
  return Number.isSafeInteger(value) ? value : null;
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const itemNumber = url.searchParams.get('itemNumber')?.trim();

  if (!itemNumber) {
    return Response.json({ error: 'Enter the ticket number.' }, { status: 400 });
  }

  try {
    const response = await admin.graphql(ITEM_QUERY, {
      variables: {
        handle: {
          type: 'consignment_item',
          handle: itemNumber.toLowerCase(),
        },
      },
    });
    const payload = await response.json();

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join(', '));
    }

    const node = payload.data?.item;
    if (!node) {
      return Response.json(
        { error: `No consignment item matches ticket ${itemNumber}.` },
        { status: 404 },
      );
    }

    const field = values(node.fields);
    const reference = references(node.fields);
    const consignor = reference.consignor;
    const consignorField = values(consignor?.fields);
    const product = reference.shopify_product;
    const photo = reference.photo;
    const itemTicket = field.item_number || node.handle;
    const variant = product?.variants?.nodes?.find(
      (entry) => entry.sku?.toLowerCase() === itemTicket.toLowerCase(),
    ) || product?.variants?.nodes?.[0];
    const storedStatus = field.status || 'Draft';
    const status = product?.status === 'ACTIVE' && storedStatus === 'Draft'
      ? 'Available'
      : storedStatus;

    if (!product) {
      return Response.json(
        { error: `${itemTicket} does not have a Shopify product yet.` },
        { status: 409 },
      );
    }

    if (!variant) {
      return Response.json(
        { error: `${itemTicket} does not have a Shopify product variant.` },
        { status: 409 },
      );
    }

    if (status !== 'Available' || product.status !== 'ACTIVE') {
      return Response.json(
        { error: `${itemTicket} is ${status}, not available for sale.` },
        { status: 409 },
      );
    }

    return Response.json({
      id: node.id,
      itemNumber: itemTicket,
      title: field.description || product.title,
      description: field.description || '',
      category: field.category || '',
      type: field.item_type || '',
      size: field.size || '',
      condition: field.condition || '',
      price: Number(field.price || 0),
      currencyCode: payload.data.shop.currencyCode,
      status,
      photo: photo?.image?.url || photo?.url || null,
      consignor: {
        id: consignor?.id || field.consignor || null,
        number: consignorField.number || null,
        name: [consignorField.first_name, consignorField.last_name]
          .filter(Boolean)
          .join(' ') || 'Unknown consignor',
      },
      product: {
        id: product.id,
        title: product.title,
        status: product.status,
        variantId: numericId(variant.id),
        variantGid: variant.id,
        sku: variant.sku,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
