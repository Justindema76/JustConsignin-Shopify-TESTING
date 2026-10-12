// Shopify locations for consignment.
//
// Locations are always read live from Shopify, never copied into the app.
// Renames, new stores and deactivations show up automatically.
//
// The only thing JustConsignIn stores is which locations are enabled for
// consignment: a JSON array of location GIDs in a merchant-owned shop
// metafield, so it survives an app reinstall.

const METAFIELD_NAMESPACE = 'justconsignin';
const METAFIELD_KEY = 'consignment_locations';

const LOCATIONS_QUERY = `#graphql
  query ConsignmentLocations($namespace: String!, $key: String!) {
    shop {
      id
      metafield(namespace: $namespace, key: $key) { value }
    }
    locations(first: 100, includeInactive: true, includeLegacy: true, sortKey: NAME) {
      nodes {
        id
        name
        isActive
        fulfillmentService { id serviceName }
        address { formatted city provinceCode countryCode }
      }
    }
  }
`;

const SAVE_MUTATION = `#graphql
  mutation SaveConsignmentLocations($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

async function graphql(admin, query, variables) {
  const response = await admin.graphql(query, { variables });
  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((error) => error.message).join(', '));
  }
  return json.data;
}

function parseSavedIds(value) {
  if (!value) return null; // never saved
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

function toLocation(node) {
  return {
    id: node.id,
    name: node.name,
    isActive: Boolean(node.isActive),
    isFulfillmentService: Boolean(node.fulfillmentService),
    fulfillmentServiceName: node.fulfillmentService?.serviceName || null,
    // Shopify formats these lines per country, so no Province/State or
    // Postal/ZIP assumptions are needed here.
    addressLines: (node.address?.formatted || []).filter(Boolean),
    countryCode: node.address?.countryCode || null,
  };
}

// Returns { shopId, locations, enabledIds, isDefault }.
// isDefault is true when the merchant has never saved a selection.
export async function getConsignmentLocations(admin) {
  const data = await graphql(admin, LOCATIONS_QUERY, {
    namespace: METAFIELD_NAMESPACE,
    key: METAFIELD_KEY,
  });

  const locations = (data.locations?.nodes || []).map(toLocation);
  const savedIds = parseSavedIds(data.shop?.metafield?.value);

  if (savedIds) {
    return {
      shopId: data.shop.id,
      locations,
      enabledIds: savedIds,
      isDefault: false,
    };
  }

  // Default: a store with exactly one active retail location gets it enabled
  // automatically, so single-store merchants see no change. Multi-store
  // merchants pick their own.
  const retail = locations.filter(
    (location) => location.isActive && !location.isFulfillmentService,
  );

  return {
    shopId: data.shop.id,
    locations,
    enabledIds: retail.length === 1 ? [retail[0].id] : [],
    isDefault: true,
  };
}

export async function saveConsignmentLocations(admin, shopId, enabledIds) {
  const ids = [...new Set((enabledIds || []).filter((id) => typeof id === 'string'))];

  const data = await graphql(admin, SAVE_MUTATION, {
    metafields: [
      {
        ownerId: shopId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEY,
        type: 'json',
        value: JSON.stringify(ids),
      },
    ],
  });

  const errors = data.metafieldsSet?.userErrors || [];
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(', '));
  }

  return ids;
}
