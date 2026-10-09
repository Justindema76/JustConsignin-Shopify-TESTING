import { redirect, useLoaderData } from 'react-router';
import BufferResultPage from '../components/social/BufferResultPage';
import {
  bufferConfiguration,
  readConnectTicket,
  startBufferAuthorization,
} from '../services/buffer.server';

// Opened in the merchant's own browser (not the Shopify iframe or mobile
// webview) from the Connect Buffer button. The signed ticket identifies the
// shop, so no Shopify session is needed here.
export const loader = async ({ request }) => {
  const ticket = new URL(request.url).searchParams.get('ticket');
  const result = readConnectTicket(ticket);

  if (!result.ok) {
    return { status: result.reason };
  }
  if (!bufferConfiguration().oauthConfigured) {
    return { status: 'error' };
  }

  return redirect(await startBufferAuthorization(result.shop));
};

export default function BufferStartRoute() {
  const { status } = useLoaderData();
  return <BufferResultPage status={status} />;
}
