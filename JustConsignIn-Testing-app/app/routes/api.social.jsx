import { authenticate } from '../shopify.server';
import {
  bufferConfiguration,
  createBufferDrafts,
  createBufferPosts,
  getBufferConnectionSummary,
} from '../services/buffer.server';

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const configuration = bufferConfiguration();

  try {
    const connection = await getBufferConnectionSummary(session.shop);
    return Response.json({
      configured: configuration.configured,
      connection,
    });
  } catch (error) {
    return Response.json(
      {
        configured: configuration.configured,
        connection: null,
        error: error instanceof Error ? error.message : 'Could not connect to Buffer.',
      },
      { status: 502 },
    );
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const body = await request.json().catch(() => ({}));

  try {
    if (body.operation === 'createBufferPosts') {
      const posts = await createBufferPosts({
        shop: session.shop,
        channels: Array.isArray(body.channels) ? body.channels : [],
        assets: Array.isArray(body.assets) ? body.assets : [],
        action: body.action || 'draft',
        dueAt: body.dueAt || null,
      });

      return Response.json({ posts });
    }

    if (body.operation === 'createBufferDrafts') {
      const drafts = await createBufferDrafts({
        shop: session.shop,
        channelIds: Array.isArray(body.channelIds) ? body.channelIds : [],
        text: body.text || '',
        imageUrl: body.imageUrl || '',
      });

      return Response.json({ drafts });
    }

    return Response.json({ error: 'Unknown social media operation.' }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not create social posts.' },
      { status: 400 },
    );
  }
};
