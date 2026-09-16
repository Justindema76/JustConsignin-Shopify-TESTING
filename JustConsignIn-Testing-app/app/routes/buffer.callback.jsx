import { redirect } from 'react-router';
import db from '../db.server';
import {
  decryptSecret,
  exchangeBufferCode,
  getBufferAccountSnapshot,
  saveBufferConnection,
} from '../services/buffer.server';

function socialRedirect({ shop, host, status }) {
  const appUrl = String(process.env.SHOPIFY_APP_URL || '').replace(/\/$/, '');
  if (!appUrl) {
    throw new Error('SHOPIFY_APP_URL is not configured.');
  }

  const url = new URL('/app/social', appUrl);
  if (shop) url.searchParams.set('shop', shop);
  if (host) url.searchParams.set('host', host);
  url.searchParams.set('embedded', '1');
  url.searchParams.set('buffer', status);
  return url.toString();
}

export const loader = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get('state');
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');

  if (!state) {
    throw new Response('Missing Buffer OAuth state.', { status: 400 });
  }

  const pending = await db.bufferOAuthState.findUnique({ where: { state } });
  if (!pending) {
    throw new Response('This Buffer connection request is no longer valid.', { status: 400 });
  }

  if (pending.expiresAt < new Date()) {
    await db.bufferOAuthState.delete({ where: { state } });
    return redirect(socialRedirect({
      shop: pending.shop,
      host: pending.host,
      status: 'expired',
    }));
  }

  if (error || !code) {
    await db.bufferOAuthState.delete({ where: { state } });
    return redirect(socialRedirect({
      shop: pending.shop,
      host: pending.host,
      status: error || 'denied',
    }));
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

    return redirect(socialRedirect({
      shop: pending.shop,
      host: pending.host,
      status: 'connected',
    }));
  } catch (connectionError) {
    console.error('Buffer OAuth connection failed:', connectionError);
    await db.bufferOAuthState.deleteMany({ where: { state } });

    return redirect(socialRedirect({
      shop: pending.shop,
      host: pending.host,
      status: 'error',
    }));
  }
};

export default function BufferCallbackRoute() {
  return null;
}
