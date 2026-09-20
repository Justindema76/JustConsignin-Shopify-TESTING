import { authenticate } from '../shopify.server';
import {
  getSocialDraft,
  saveSocialDraft,
} from '../services/socialDraft.server';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const itemId = String(url.searchParams.get('itemId') || '');

  if (!itemId) {
    return Response.json({ error: 'Item ID is required.' }, { status: 400 });
  }

  try {
    const socialDraft = await getSocialDraft(admin, itemId);
    return Response.json({ socialDraft });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not load the social media draft.' },
      { status: 400 },
    );
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Unsupported operation.' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const itemId = String(body.itemId || '');

  if (!itemId) {
    return Response.json({ error: 'Item ID is required.' }, { status: 400 });
  }

  try {
    const socialDraft = await saveSocialDraft(
      admin,
      itemId,
      body.socialDraft || {},
    );
    return Response.json({ socialDraft });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not save the social media draft.' },
      { status: 400 },
    );
  }
};
