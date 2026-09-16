import { authenticate } from '../shopify.server';
import {
  bufferConfiguration,
  createBufferDrafts,
  getBufferConnectionSummary,
} from '../services/buffer.server';

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const configuration = bufferConfiguration();
  const connection = await getBufferConnectionSummary(session.shop);

  return Response.json({
    configured: configuration.configured,
    connection,
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const body = await request.json().catch(() => ({}));

  if (body.operation !== 'createBufferDrafts') {
    return Response.json({ error: 'Unknown social media operation.' }, { status: 400 });
  }

  try {
    const drafts = await createBufferDrafts({
      shop: session.shop,
      channelIds: Array.isArray(body.channelIds) ? body.channelIds : [],
      text: body.text || '',
      imageUrl: body.imageUrl || '',
    });

    return Response.json({ drafts });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not create Buffer drafts.' },
      { status: 400 },
    );
  }
};
