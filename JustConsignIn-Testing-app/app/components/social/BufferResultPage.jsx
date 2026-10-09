/* eslint-disable react/prop-types */

// Standalone page shown in the merchant's own browser during the Buffer
// login. It lives outside Shopify Admin, so it does not use App Bridge or
// the consignment styles.
const MESSAGES = {
  connected: {
    title: 'Buffer is connected',
    body: 'You can close this browser window and go back to JustConsignIn in Shopify. Your Buffer channels will show on the Social Media page.',
  },
  expired: {
    title: 'This link expired',
    body: 'Go back to the Social Media page in JustConsignIn and tap Connect Buffer again.',
  },
  invalid: {
    title: 'This link is not valid',
    body: 'Go back to the Social Media page in JustConsignIn and tap Connect Buffer again.',
  },
  denied: {
    title: 'Buffer was not connected',
    body: 'The Buffer approval was cancelled. Go back to the Social Media page in JustConsignIn and tap Connect Buffer to try again.',
  },
  error: {
    title: 'Buffer could not be connected',
    body: 'Something went wrong while finishing the connection. Go back to the Social Media page in JustConsignIn and tap Connect Buffer to try again.',
  },
};

export default function BufferResultPage({ status }) {
  const message = MESSAGES[status] || MESSAGES.error;
  const ok = status === 'connected';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px 16px',
        background: '#f6f6f7',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#202223',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 28,
          borderRadius: 16,
          background: '#ffffff',
          border: `1px solid ${ok ? 'rgba(34, 197, 94, 0.35)' : '#dfe3e8'}`,
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>{message.title}</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: '#4a4f55' }}>
          {message.body}
        </p>
      </div>
    </main>
  );
}
