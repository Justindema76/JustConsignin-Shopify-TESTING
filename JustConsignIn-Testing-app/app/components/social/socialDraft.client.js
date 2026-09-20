function isPersistedItemId(itemId) {
  return String(itemId || '').startsWith('gid://shopify/Metaobject/');
}

async function parseResponse(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || fallback);
  }
  return payload;
}

export function canPersistSocialDraft(itemId) {
  return isPersistedItemId(itemId);
}

export async function loadSocialDraft(itemId) {
  if (!isPersistedItemId(itemId)) return null;

  const response = await fetch(
    `/api/social-draft?itemId=${encodeURIComponent(itemId)}`,
  );
  const payload = await parseResponse(
    response,
    'Could not load the social media draft.',
  );
  return payload.socialDraft || null;
}

export async function saveSocialDraft(itemId, socialDraft) {
  if (!isPersistedItemId(itemId)) return null;

  const response = await fetch('/api/social-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, socialDraft }),
  });
  const payload = await parseResponse(
    response,
    'Could not save the social media draft.',
  );
  return payload.socialDraft || null;
}
