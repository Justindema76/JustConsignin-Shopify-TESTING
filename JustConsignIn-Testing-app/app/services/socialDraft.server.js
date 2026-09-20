const SOCIAL_DRAFT_FIELD = {
  key: 'social_draft',
  name: 'Social Media Draft',
  type: 'multi_line_text_field',
};

const DEFINITION_QUERY = `#graphql
  query SocialDraftDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
      fieldDefinitions {
        key
        type { name }
      }
    }
  }
`;

const DEFINITION_UPDATE_MUTATION = `#graphql
  mutation AddSocialDraftField(
    $id: ID!
    $definition: MetaobjectDefinitionUpdateInput!
  ) {
    metaobjectDefinitionUpdate(id: $id, definition: $definition) {
      metaobjectDefinition { id }
      userErrors { field message code }
    }
  }
`;

const ITEM_QUERY = `#graphql
  query SocialDraftItem($id: ID!) {
    node(id: $id) {
      ... on Metaobject {
        id
        type
        fields {
          key
          jsonValue
        }
      }
    }
  }
`;

const ITEM_UPDATE_MUTATION = `#graphql
  mutation SaveSocialDraft($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject {
        id
        fields {
          key
          jsonValue
        }
      }
      userErrors { field message code }
    }
  }
`;

async function graphql(admin, query, variables) {
  const response = await admin.graphql(query, { variables });
  const payload = await response.json();

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(', '));
  }

  return payload.data;
}

function assertNoUserErrors(result, operation) {
  const errors = result?.userErrors || [];
  if (errors.length) {
    throw new Error(`${operation}: ${errors.map((error) => error.message).join(', ')}`);
  }
}

function parseDraftValue(value) {
  if (!value) return null;

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed?.schema === 'social-draft-v1' ? parsed : null;
  } catch {
    return null;
  }
}

export function sanitizeSocialDraft(input = {}) {
  return {
    schema: 'social-draft-v1',
    caption: String(input.caption || '').slice(0, 10000),
    selectedIds: Array.isArray(input.selectedIds)
      ? input.selectedIds.map(String).slice(0, 20)
      : [],
    postTypes: input.postTypes && typeof input.postTypes === 'object'
      ? Object.fromEntries(
          Object.entries(input.postTypes)
            .slice(0, 20)
            .map(([key, value]) => [String(key), String(value || 'post')]),
        )
      : {},
    media: Array.isArray(input.media)
      ? input.media
          .slice(0, 10)
          .map((entry) => ({
            id: entry?.id ? String(entry.id) : '',
            type: entry?.type === 'video' ? 'video' : 'image',
            url: entry?.url ? String(entry.url) : '',
            previewUrl: entry?.previewUrl ? String(entry.previewUrl) : '',
            name: entry?.name ? String(entry.name).slice(0, 255) : '',
          }))
          .filter((entry) => entry.url)
      : [],
    scheduleAt: input.scheduleAt ? String(input.scheduleAt) : '',
    scheduleOpen: input.scheduleOpen === true,
    bufferPosts: Array.isArray(input.bufferPosts)
      ? input.bufferPosts
          .slice(0, 20)
          .map((entry) => ({
            channelId: entry?.channelId ? String(entry.channelId) : '',
            postId: entry?.postId ? String(entry.postId) : '',
            channelName: entry?.channelName ? String(entry.channelName) : '',
            service: entry?.service ? String(entry.service) : '',
            status: entry?.status ? String(entry.status) : '',
            dueAt: entry?.dueAt ? String(entry.dueAt) : '',
          }))
          .filter((entry) => entry.channelId && entry.postId)
      : [],
    lastAction: ['draft', 'now', 'schedule'].includes(String(input.lastAction))
      ? String(input.lastAction)
      : 'draft',
    updatedAt: new Date().toISOString(),
  };
}

export async function ensureSocialDraftField(admin) {
  const data = await graphql(admin, DEFINITION_QUERY, {
    type: 'consignment_item',
  });
  const definition = data.metaobjectDefinitionByType;

  if (!definition?.id) {
    throw new Error('The Consignment Item definition is not installed yet.');
  }

  const exists = (definition.fieldDefinitions || []).some(
    (field) => field.key === SOCIAL_DRAFT_FIELD.key,
  );
  if (exists) return definition.id;

  const updateData = await graphql(admin, DEFINITION_UPDATE_MUTATION, {
    id: definition.id,
    definition: {
      fieldDefinitions: [{ create: SOCIAL_DRAFT_FIELD }],
    },
  });

  assertNoUserErrors(
    updateData.metaobjectDefinitionUpdate,
    'Could not add the Social Media Draft field',
  );

  return definition.id;
}

export async function getSocialDraft(admin, itemId) {
  await ensureSocialDraftField(admin);

  const data = await graphql(admin, ITEM_QUERY, { id: itemId });
  const item = data.node;

  if (!item?.id || item.type !== 'consignment_item') {
    throw new Error('Consignment item not found.');
  }

  const field = (item.fields || []).find(
    (entry) => entry.key === SOCIAL_DRAFT_FIELD.key,
  );

  return parseDraftValue(field?.jsonValue);
}

export async function saveSocialDraft(admin, itemId, input) {
  await ensureSocialDraftField(admin);

  const draft = sanitizeSocialDraft(input);
  const data = await graphql(admin, ITEM_UPDATE_MUTATION, {
    id: itemId,
    metaobject: {
      fields: [{
        key: SOCIAL_DRAFT_FIELD.key,
        value: JSON.stringify(draft),
      }],
    },
  });

  assertNoUserErrors(
    data.metaobjectUpdate,
    'Could not save the social media draft',
  );

  return draft;
}
