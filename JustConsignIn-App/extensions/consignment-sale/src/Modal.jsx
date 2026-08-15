import "@shopify/ui-extensions/preact";
import {render} from 'preact';
import {useCallback, useEffect, useState} from 'preact/hooks';

const ITEM_QUERY = `#graphql
  query PosConsignmentItem($handle: MetaobjectHandleInput!) {
    shop {
      currencyCode
    }
    publications(first: 50) {
      nodes {
        id
        name
      }
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

const PUBLISH_TO_POS_MUTATION = `#graphql
  mutation PublishPosProduct($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      publishable {
        ... on Product {
          id
          status
        }
      }
      userErrors { field message }
    }
  }
`;

export default async () => {
  render(<Extension />, document.body);
};

function values(fields = []) {
  return Object.fromEntries(
    fields.map((field) => [field.key, field.jsonValue]),
  );
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

async function adminRequest(query, variables) {
  const response = await fetch('shopify:admin/api/graphql.json', {
    method: 'POST',
    body: JSON.stringify({query, variables}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    throw new Error(
      payload.errors?.map((entry) => entry.message).join(', ')
        || `Shopify returned ${response.status}.`,
    );
  }
  return payload.data;
}

async function lookupConsignmentItem(itemNumber) {
  const data = await adminRequest(ITEM_QUERY, {
    handle: {
      type: 'consignment_item',
      handle: itemNumber.toLowerCase(),
    },
  });
  const node = data?.item;
  if (!node) {
    throw new Error(`No consignment item matches ticket ${itemNumber}.`);
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
    throw new Error(`${itemTicket} does not have a Shopify product yet.`);
  }
  if (!variant) {
    throw new Error(`${itemTicket} does not have a Shopify product variant.`);
  }
  if (status !== 'Available' || product.status !== 'ACTIVE') {
    throw new Error(`${itemTicket} is ${status}, not available for sale.`);
  }

  const posPublication = data.publications?.nodes?.find((entry) => {
    const name = String(entry.name || '').toLowerCase();
    return name.includes('point of sale') || name === 'pos';
  });
  if (!posPublication?.id) {
    throw new Error('The Point of Sale sales channel is not available for this store.');
  }

  const publishData = await adminRequest(PUBLISH_TO_POS_MUTATION, {
    id: product.id,
    input: [{publicationId: posPublication.id}],
  });
  const publishErrors = publishData.publishablePublish?.userErrors || [];
  if (publishErrors.length) {
    throw new Error(
      publishErrors.map((entry) => entry.message).join(', ')
        || `Could not make ${itemTicket} available in Point of Sale.`,
    );
  }

  return {
    id: node.id,
    itemNumber: itemTicket,
    title: field.description || product.title,
    description: field.description || '',
    category: field.category || '',
    type: field.item_type || '',
    size: field.size || '',
    condition: field.condition || '',
    price: Number(field.price || 0),
    currencyCode: data.shop.currencyCode,
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
  };
}

function Extension() {
  const {i18n} = shopify;
  const [ticket, setTicket] = useState('');
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const findItem = useCallback(async (value) => {
    const enteredValue = value ?? ticket;
    const normalizedTicket = enteredValue.trim();
    if (!normalizedTicket) {
      setError(i18n.translate('ticket_required'));
      setItem(null);
      return;
    }

    setLoading(true);
    setError('');
    setItem(null);

    try {
      const payload = await lookupConsignmentItem(normalizedTicket);
      if (!payload.product?.variantId) {
        throw new Error(i18n.translate('variant_missing'));
      }
      setItem(payload);
    } catch (lookupError) {
      setError(lookupError.message || i18n.translate('lookup_failed'));
    } finally {
      setLoading(false);
    }
  }, [i18n, ticket]);

  useEffect(() => {
    const subscription = shopify.scanner.scannerData.current.subscribe((scan) => {
      if (!scan?.data) return;
      const scannedTicket = scan.data.trim();
      setTicket(scannedTicket);
      void findItem(scannedTicket);
    });

    return () => subscription();
  }, [findItem]);

  async function addToCart() {
    if (!item?.product?.variantId) return;

    setAdding(true);
    setError('');
    try {
      const uuid = await shopify.cart.addLineItem(item.product.variantId, 1);

      if (uuid) {
        await shopify.cart.addLineItemProperties(uuid, {
          _consignment_item: item.itemNumber,
          Consignor: item.consignor?.number
            ? `#${item.consignor.number}`
            : item.consignor?.name || '',
        }).catch(() => {
          // The variant SKU still identifies the consignment item for the paid-order webhook.
        });
      }

      if (!uuid) {
        setError(i18n.translate('add_cancelled'));
        return;
      }

      shopify.toast.show(String(i18n.translate('added_to_cart', {
        itemNumber: item.itemNumber,
      })));
      // Note: there is no supported API to programmatically close a
      // pos.home.modal.render extension from within itself — the Action API's
      // presentModal()/dismissModal() only exists on the launching tile/menu
      // item, not inside the modal. The associate closes via the native "X".
    } catch (cartError) {
      setError(cartError.message || i18n.translate('add_failed'));
    } finally {
      setAdding(false);
    }
  }

  return (
    <s-page heading={i18n.translate('modal_heading')}>
      <s-scroll-box>
        <s-stack direction="block" gap="base" padding="base">
          <s-banner heading={i18n.translate('instructions_heading')} tone="info">
            {i18n.translate('instructions')}
          </s-banner>

          <s-text-field
            label={i18n.translate('ticket_label')}
            value={ticket}
            placeholder={i18n.translate('ticket_placeholder')}
            disabled={loading || adding}
            onInput={(event) => setTicket(event.currentTarget.value)}
          />

          <s-button
            variant="primary"
            loading={loading}
            disabled={adding}
            onClick={() => findItem()}
          >
            {i18n.translate('find_item')}
          </s-button>

          {error ? (
            <s-banner heading={error} tone="critical" />
          ) : null}

          {item ? (
            <s-section heading={item.title}>
              <s-stack direction="block" gap="small">
                {item.photo ? (
                  <s-box inlineSize="100%" blockSize="200px">
                    <s-image
                      src={item.photo}
                      alt={item.title}
                      inlineSize="fill"
                      objectFit="cover"
                    />
                  </s-box>
                ) : null}
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-heading>{item.itemNumber}</s-heading>
                  <s-badge tone="success">{item.status}</s-badge>
                </s-stack>
                <s-text>{item.description}</s-text>
                <s-text>
                  {[
                    item.category,
                    item.type,
                    item.size ? `${i18n.translate('size')}: ${item.size}` : '',
                    item.condition
                      ? `${i18n.translate('condition')}: ${item.condition}`
                      : '',
                  ].filter(Boolean).join(' · ')}
                </s-text>
                <s-text>
                  {i18n.translate('consignor')}: {item.consignor?.name}
                  {item.consignor?.number ? ` (#${item.consignor.number})` : ''}
                </s-text>
                <s-heading>
                  {new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: item.currencyCode || 'CAD',
                  }).format(Number(item.price))}
                </s-heading>
                <s-banner heading={i18n.translate('confirm_heading')} tone="warning">
                  {i18n.translate('confirm', {itemNumber: item.itemNumber})}
                </s-banner>
                <s-button
                  variant="primary"
                  loading={adding}
                  disabled={loading}
                  onClick={addToCart}
                >
                  {i18n.translate('confirm_add')}
                </s-button>
                <s-button
                  variant="secondary"
                  disabled={adding}
                  onClick={() => {
                    setItem(null);
                    setTicket('');
                    setError('');
                  }}
                >
                  {i18n.translate('different_ticket')}
                </s-button>
              </s-stack>
            </s-section>
          ) : null}
        </s-stack>
      </s-scroll-box>
    </s-page>
  );
}
