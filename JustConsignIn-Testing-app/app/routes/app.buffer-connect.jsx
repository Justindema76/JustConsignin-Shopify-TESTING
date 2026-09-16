import { redirect } from 'react-router';
import db from '../db.server';
import { authenticate } from '../shopify.server';
import {
  buildBufferAuthorizationUrl,
  createOAuthState,
  createPkcePair,
  encryptSecret,
} from '../services/buffer.server';

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const requestUrl = new URL(request.url);
  const { verifier, challenge } = createPkcePair();
  const state = createOAuthState();

  await db.bufferOAuthState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  await db.bufferOAuthState.create({
    data: {
      state,
      shop: session.shop,
      codeVerifier: encryptSecret(verifier),
      host: requestUrl.searchParams.get('host') || null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  return redirect(buildBufferAuthorizationUrl({ state, challenge }));
};

export default function BufferConnectRoute() {
  return null;
}
