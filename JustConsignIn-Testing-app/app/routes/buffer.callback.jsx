import { useLoaderData } from 'react-router';
import db from '../db.server';
import BufferResultPage from '../components/social/BufferResultPage';
import {
  decryptSecret,
  exchangeBufferCode,
  getBufferAccountSnapshot,
  saveBufferConnection,
} from '../services/buffer.server';

// Buffer sends the merchant back here in the same browser window that
// /buffer/start opened. That window is usually not signed in to Shopify
// (especially on a phone), so show a plain result page instead of
// redirecting into Shopify Admin. The Social page refreshes itself when
// the merchant switches back to it.
export const loader = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get('state');
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');

  if (!state) {
    return { status: 'invalid' };
  }

  const pending = await db.bufferOAuthState.findUnique({ where: { state } });
  if (!pending) {
    return { status: 'invalid' };
  }

  if (pending.expiresAt < new Date()) {
    await db.bufferOAuthState.delete({ where: { state } });
    return { status: 'expired' };
  }

  if (error || !code) {
    await db.bufferOAuthState.delete({ where: { state } });
    return { status: 'denied' };
  }

  try {
    const verifier = decryptSecret(pending.codeVerifier);
    const tokens = await exchangeBufferCode({ code, verifier });
    const snapshot = await getBufferAccountSnapshot(tokens.access_token);

    await saveBufferConnection({
      shop: pending.shop,
      tokens,
      snapshot,
    });

    await db.bufferOAuthState.delete({ where: { state } });

    return { status: 'connected' };
  } catch (connectionError) {
    console.error('Buffer OAuth connection failed:', connectionError);
    await db.bufferOAuthState.deleteMany({ where: { state } });

    return { status: 'error' };
  }
};

export default function BufferCallbackRoute() {
  const { status } = useLoaderData();
  return <BufferResultPage status={status} />;
}
