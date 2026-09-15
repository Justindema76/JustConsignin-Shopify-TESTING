import "@shopify/ui-extensions/preact";
import {render} from 'preact';
import {useCallback, useEffect, useMemo, useRef, useState} from 'preact/hooks';

// Looks up one item by its exact ticket number (metaobject handle). This is
// the authoritative path — it's the only place that checks Shopify product
// status, variant availability, and publishes to the POS sales channel.
// Both the scanner and the search/browse UI below eventually funnel into
// this same function before anything can be added to the cart.
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

// Powers the search/browse list (ticket, item, brand, or consignor name).
// Deliberately lightweight — just enough per item to search and render a
// result row. A full lookupConsignmentItem() call still happens on select
// (below), so the availability/POS-publish checks stay in exactly one
// place rather than being duplicated here.
const BROWSE_ITEMS_QUERY = `#graphql
  query PosConsignmentBrowse($cursor: String) {
    items: metaobjects(type: "consignment_item", first: 100, after: $cursor) {
      nodes {
        id
        handle
        fields {
          key
          jsonValue
          reference {
            ... on MediaImage {
              image { url }
            }
            ... on GenericFile {
              url
            }
            ... on Metaobject {
              fields { key jsonValue }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Fetching everything up front (rather than only after a keystroke) makes
// the first search feel instant instead of showing a spinner while the
// associate is mid-typing. It's a background, best-effort load — if it
// fails, exact ticket lookup (scanner or typed) still works untouched.
const MAX_BROWSE_PAGES = 5;
const RECENT_LIMIT = 5;

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
    brand: field.brand || '',
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

// Fetches a page-by-page snapshot of every Available consignment item, for
// the search/browse list only. Not the source of truth for whether an item
// can actually be sold — lookupConsignmentItem() re-checks that on select.
async function fetchBrowseRecords() {
  const records = [];
  let cursor = null;
  let hasNextPage = true;
  let pages = 0;

  while (hasNextPage && pages < MAX_BROWSE_PAGES) {
    const data = await adminRequest(BROWSE_ITEMS_QUERY, {cursor});
    const nodes = data?.items?.nodes || [];

    for (const node of nodes) {
      const field = values(node.fields);
      const reference = references(node.fields);
      const consignor = reference.consignor;
      const consignorField = values(consignor?.fields);
      const photo = reference.photo;
      const status = field.status || 'Draft';

      if (status !== 'Available') continue;

      records.push({
        itemNumber: field.item_number || node.handle,
        title: field.description || '',
        brand: field.brand || '',
        price: Number(field.price || 0),
        consignorName: [consignorField.first_name, consignorField.last_name]
          .filter(Boolean)
          .join(' ') || 'Unknown consignor',
        photo: photo?.image?.url || photo?.url || null,
      });
    }

    hasNextPage = Boolean(data?.items?.pageInfo?.hasNextPage);
    cursor = data?.items?.pageInfo?.endCursor || null;
    pages += 1;
  }

  return records;
}

function matchesQuery(record, needle) {
  return record.itemNumber.toLowerCase().includes(needle)
    || record.title.toLowerCase().includes(needle)
    || record.brand.toLowerCase().includes(needle)
    || record.consignorName.toLowerCase().includes(needle);
}

// When everything that matches does so only via the consignor's name (not
// the ticket, item, or brand), switch to a grouped "All items from X" view
// instead of a flat list — that's almost always what typing a name means.
function groupByConsignorIfApplicable(records, needle) {
  const byConsignor = records.filter((r) => r.consignorName.toLowerCase().includes(needle));
  const byOther = records.filter((r) => (
    r.itemNumber.toLowerCase().includes(needle)
      || r.title.toLowerCase().includes(needle)
      || r.brand.toLowerCase().includes(needle)
  ));
  if (byConsignor.length > 0 && byOther.length === 0) {
    return {consignorName: byConsignor[0].consignorName, records: byConsignor};
  }
  return null;
}

function ResultRow({record, onSelect, i18n}) {
  return (
    <s-clickable onClick={() => onSelect(record.itemNumber)}>
      <s-stack direction="inline" gap="small" alignItems="center" padding="small-200">
        <s-box inlineSize="44px" blockSize="44px">
          {record.photo ? (
            <s-image src={record.photo} objectFit="cover" />
          ) : (
            <s-icon type="image" tone="neutral" />
          )}
        </s-box>
        <s-stack direction="block" gap="small-500">
          <s-text type="strong">{record.title || record.itemNumber}</s-text>
          <s-text type="small" color="subdued">
            {record.itemNumber}
            {record.brand ? ` · ${record.brand}` : ''}
            {' · '}{record.consignorName}
          </s-text>
        </s-stack>
        <s-text type="strong">
          {new Intl.NumberFormat(undefined, {style: 'currency', currency: 'USD'}).format(record.price)}
        </s-text>
      </s-stack>
    </s-clickable>
  );
}

function Extension() {
  const {i18n} = shopify;
  const [query, setQuery] = useState('');
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [recent, setRecent] = useState([]);

  const [browseRecords, setBrowseRecords] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [browseFailed, setBrowseFailed] = useState(false);

  const [hasCameraScanner, setHasCameraScanner] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  // The scan subscription below gets torn down and rebuilt whenever
  // `findItem` changes identity (which happens on every query change,
  // including the one this same handler triggers) — and Shopify's Scanner
  // API can re-emit the previous scan value on resubscribe. Without this
  // guard, one physical scan could fire the handler twice, toggling the
  // camera overlay open/closed rapidly. Tracking the last processed value
  // is Shopify's own documented fix for this exact issue.
  const lastScannedRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    fetchBrowseRecords()
      .then((records) => {
        if (!cancelled) setBrowseRecords(records);
      })
      .catch(() => {
        if (!cancelled) setBrowseFailed(true);
      })
      .finally(() => {
        if (!cancelled) setBrowseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const findItem = useCallback(async (value) => {
    const enteredValue = value ?? query;
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
      setRecent((previous) => (
        [payload, ...previous.filter((entry) => entry.itemNumber !== payload.itemNumber)].slice(0, RECENT_LIMIT)
      ));
    } catch (lookupError) {
      setError(lookupError.message || i18n.translate('lookup_failed'));
    } finally {
      setLoading(false);
    }
  }, [i18n, query]);

  useEffect(() => {
    const subscription = shopify.scanner.scannerData.current.subscribe((scan) => {
      if (!scan?.data) return;
      // A scan landing mid-lookup or mid-add would blow away in-flight state
      // (e.g. two rapid scans while the first is still resolving) — ignore
      // it rather than racing two lookups against the same `item` state.
      if (loading || adding) return;
      const scannedTicket = scan.data.trim();
      // Skip re-emitted/stale scan values — see lastScannedRef comment above.
      if (scannedTicket === lastScannedRef.current) return;
      lastScannedRef.current = scannedTicket;
      // A camera scan needs the overlay explicitly closed afterward — a
      // hardware/embedded scanner has no overlay to close, so this is a
      // no-op for those sources.
      shopify.scanner.hideCameraScanner();
      setCameraActive(false);
      setQuery(scannedTicket);
      void findItem(scannedTicket);
    });

    return () => subscription();
  }, [findItem, loading, adding]);

  useEffect(() => {
    const unsubscribeSources = shopify.scanner.sources.current.subscribe((sources) => {
      setHasCameraScanner(sources.includes('camera'));
    });

    // Leaving the modal with the camera overlay still open would strand it
    // open behind the closed modal, so make sure it's closed on unmount too.
    return () => {
      unsubscribeSources();
      shopify.scanner.hideCameraScanner();
    };
  }, []);

  function startCameraScan() {
    // Starting a new scan should be able to accept the same ticket again
    // (e.g. adding two of the same item back to back) — clear the dedup
    // guard so that's not silently ignored as a "stale" repeat.
    lastScannedRef.current = '';
    shopify.scanner.showCameraScanner();
    setCameraActive(true);
  }

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    const grouped = groupByConsignorIfApplicable(browseRecords, needle);
    if (grouped) {
      return {group: grouped.consignorName, records: grouped.records};
    }
    const flat = browseRecords.filter((record) => matchesQuery(record, needle)).slice(0, 8);
    return {group: null, records: flat};
  }, [query, browseRecords]);

  function selectSearchResult(itemNumber) {
    setQuery(itemNumber);
    void findItem(itemNumber);
  }

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

      // Reset immediately so the associate lands back on a clean search
      // field for the next item, instead of the same item card staying on
      // screen where a stray tap could add it a second time. For a
      // hardware-scanner workflow this is enough on its own — the scanner
      // API fires regardless of DOM focus, so the next scan works right
      // away with no extra tap.
      setItem(null);
      setQuery('');
      setError('');

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

          {!item && (
            <s-search-field
              placeholder={i18n.translate('search_placeholder')}
              value={query}
              disabled={loading || adding}
              onInput={(event) => setQuery(event.currentTarget.value)}
            />
          )}

          {!item && hasCameraScanner && !cameraActive && (
            <s-button
              variant="secondary"
              disabled={loading || adding}
              onClick={startCameraScan}
            >
              {i18n.translate('scan_barcode')}
            </s-button>
          )}

          {error ? (
            <s-banner heading={error} tone="critical" />
          ) : null}

          {!item && browseFailed ? (
            <s-text type="small" color="subdued">{i18n.translate('catalog_unavailable')}</s-text>
          ) : null}

          {!item && query.trim() && (
            <s-stack direction="block" gap="small-200">
              {searchResults?.group ? (
                <s-text type="small" color="subdued">
                  {i18n.translate('all_items_from', {name: searchResults.group})}
                </s-text>
              ) : null}

              {browseLoading && browseRecords.length === 0 ? (
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-spinner accessibilityLabel={i18n.translate('catalog_loading')} />
                  <s-text type="small" color="subdued">{i18n.translate('catalog_loading')}</s-text>
                </s-stack>
              ) : searchResults && searchResults.records.length > 0 ? (
                searchResults.records.map((record, index) => (
                  <>
                    {index > 0 ? <s-divider /> : null}
                    <ResultRow key={record.itemNumber} record={record} onSelect={selectSearchResult} i18n={i18n} />
                  </>
                ))
              ) : (
                <s-stack direction="block" gap="small">
                  <s-text type="small" color="subdued">
                    {i18n.translate('no_results', {query})}
                  </s-text>
                  <s-button
                    variant="secondary"
                    loading={loading}
                    disabled={adding}
                    onClick={() => findItem()}
                  >
                    {i18n.translate('find_item')}
                  </s-button>
                </s-stack>
              )}
            </s-stack>
          )}

          {!item && !query.trim() && recent.length > 0 && (
            <s-stack direction="block" gap="small-200">
              <s-text type="small" color="subdued">{i18n.translate('recent_heading')}</s-text>
              {recent.map((entry, index) => (
                <>
                  {index > 0 ? <s-divider /> : null}
                  <ResultRow
                    key={entry.itemNumber}
                    record={{
                      itemNumber: entry.itemNumber,
                      title: entry.title,
                      brand: entry.brand,
                      price: entry.price,
                      consignorName: entry.consignor?.name || '',
                      photo: entry.photo,
                    }}
                    onSelect={selectSearchResult}
                    i18n={i18n}
                  />
                </>
              ))}
            </s-stack>
          )}

          {item ? (
            <s-section heading={item.title}>
              <s-stack direction="block" gap="small">
                {item.photo ? (
                  <s-box inlineSize="100%" blockSize="200px">
                    <s-image
                      src={item.photo}
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
                    currency: item.currencyCode || 'USD',
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
                    setQuery('');
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