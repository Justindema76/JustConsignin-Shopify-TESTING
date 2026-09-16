/* eslint-disable react/prop-types */

import {
  CheckCircle2,
  ExternalLink,
  Facebook,
  Instagram,
  Link2,
  Music2,
  Youtube,
} from 'lucide-react';
import { Form } from 'react-router';

function NetworkIcon({ service }) {
  const normalized = String(service || '').toLowerCase();
  if (normalized === 'instagram') return <Instagram size={17} aria-hidden="true" />;
  if (normalized === 'facebook') return <Facebook size={17} aria-hidden="true" />;
  if (normalized === 'tiktok') return <Music2 size={17} aria-hidden="true" />;
  if (normalized === 'youtube') return <Youtube size={17} aria-hidden="true" />;
  return <Link2 size={17} aria-hidden="true" />;
}

export default function SocialConnectionCard({
  configured,
  connection,
  connectHref,
  redirectUri,
}) {
  const channels = connection?.channels || [];

  return (
    <section className="consignment-form-section social-connection-card">
      <div className="consignment-form-section-head">
        <span className="consignment-form-section-marker" aria-hidden="true" />
        <Link2 size={18} aria-hidden="true" />
        <div>
          <h2>Social media publishing</h2>
          <p>Connect this Shopify store to its own Buffer account.</p>
        </div>
      </div>

      <div className="consignment-form-section-body social-connection-body">
        {connection ? (
          <>
            <div className="social-connection-status connected">
              <CheckCircle2 size={20} aria-hidden="true" />
              <div>
                <strong>Buffer connected</strong>
                <span>
                  {connection.accountName || 'Buffer account'}
                  {connection.organizationName ? ` · ${connection.organizationName}` : ''}
                </span>
              </div>
            </div>

            <div className="social-channel-list">
              <div className="social-channel-list-head">
                <strong>Connected social channels</strong>
                <span>{channels.length} available</span>
              </div>

              {channels.length > 0 ? (
                <div className="social-channel-grid">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      className={`social-channel-pill ${channel.isDisconnected || channel.isLocked ? 'disabled' : ''}`}
                    >
                      <NetworkIcon service={channel.service} />
                      <div>
                        <strong>{channel.displayName || channel.name}</strong>
                        <span>{channel.service}</span>
                      </div>
                      {(channel.isDisconnected || channel.isLocked) && (
                        <small>{channel.isLocked ? 'Locked' : 'Reconnect in Buffer'}</small>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="consignment-form-help">
                  Buffer is connected, but no social channels were returned yet. Add channels in Buffer and reconnect here.
                </p>
              )}
            </div>

            <div className="social-connection-actions">
              <a
                className="consignment-btn social-secondary-button"
                href="https://publish.buffer.com/"
                target="_blank"
                rel="noreferrer"
              >
                Open Buffer <ExternalLink size={15} aria-hidden="true" />
              </a>

              <a className="consignment-btn" href={connectHref} target="_top">
                Reconnect Buffer
              </a>

              <Form method="post">
                <input type="hidden" name="intent" value="disconnect-buffer" />
                <button type="submit" className="consignment-btn social-danger-button">
                  Disconnect
                </button>
              </Form>
            </div>
          </>
        ) : (
          <>
            <div className="social-connection-status">
              <Link2 size={20} aria-hidden="true" />
              <div>
                <strong>Buffer not connected</strong>
                <span>
                  Each merchant connects their own Buffer account. JustConsignIn never needs their social-media passwords.
                </span>
              </div>
            </div>

            <div className="social-connection-explainer">
              <div>
                <strong>1. Connect Buffer</strong>
                <span>Sign in to the merchant's own Buffer account.</span>
              </div>
              <div>
                <strong>2. Approve JustConsignIn</strong>
                <span>OAuth grants posting access without sharing passwords.</span>
              </div>
              <div>
                <strong>3. Choose channels when posting</strong>
                <span>Instagram, Facebook, TikTok and other Buffer channels become available.</span>
              </div>
            </div>

            {configured ? (
              <div className="social-connection-actions">
                <a className="consignment-btn" href={connectHref} target="_top">
                  Connect Buffer
                </a>
              </div>
            ) : (
              <div className="social-config-warning">
                <strong>Buffer OAuth needs its testing credentials.</strong>
                <span>
                  The code is ready for the connection. Add BUFFER_CLIENT_ID and BUFFER_TOKEN_ENCRYPTION_KEY to the TESTING server, then register this callback in Buffer:
                </span>
                <code>{redirectUri || 'https://YOUR-TESTING-APP/buffer/callback'}</code>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
