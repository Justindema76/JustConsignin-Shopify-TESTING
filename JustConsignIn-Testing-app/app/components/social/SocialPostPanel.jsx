/* eslint-disable react/prop-types */

import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  ChevronRight,
  Loader2,
  Tag,
  Users,
} from 'lucide-react';

const SUPPORTED_SERVICES = new Set(['instagram', 'facebook', 'tiktok']);

function ChannelIcon({ service }) {
  if (service === 'instagram') return <Camera size={17} aria-hidden="true" />;
  if (service === 'facebook') return <Users size={17} aria-hidden="true" />;
  return <Tag size={17} aria-hidden="true" />;
}

function moneyValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : '';
}

function defaultCaption(item) {
  const title = String(item.shopifyTitle || item.description || '').trim();
  const brand = String(item.brand || item.vendor || '').trim();
  const size = String(item.size || '').trim();
  const condition = String(item.condition || '').trim();
  const price = moneyValue(item.shopifyPrice ?? item.price);

  return [
    'New arrival',
    '',
    title,
    brand ? `Brand: ${brand}` : '',
    size ? `Size: ${size}` : '',
    condition ? `Condition: ${condition}` : '',
    price,
    '',
    '#consignment #shoplocal',
  ].filter((line, index, lines) => line || (index > 0 && lines[index - 1])).join('\n').trim();
}

export default function SocialPostPanel({ item, disabled = false }) {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [caption, setCaption] = useState(() => defaultCaption(item));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const imageUrl = item.shopifyPhoto || item.photo || '';
  const socialSettingsHref = typeof window === 'undefined'
    ? '/app/social'
    : `/app/social${window.location.search || ''}`;

  const channels = useMemo(
    () => (connection?.channels || []).filter((channel) => {
      const service = String(channel.service || '').toLowerCase();
      return SUPPORTED_SERVICES.has(service) && !channel.isDisconnected && !channel.isLocked;
    }),
    [connection],
  );

  useEffect(() => {
    setCaption(defaultCaption(item));
  }, [item.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadConnection() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/social');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Could not load social media connection.');
        if (cancelled) return;
        setConfigured(Boolean(payload.configured));
        setConnection(payload.connection || null);
        const available = (payload.connection?.channels || []).filter((channel) => {
          const service = String(channel.service || '').toLowerCase();
          return SUPPORTED_SERVICES.has(service) && !channel.isDisconnected && !channel.isLocked;
        });
        setSelectedIds(available.map((channel) => String(channel.id)));
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load social media connection.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadConnection();
    return () => { cancelled = true; };
  }, []);

  function toggleChannel(channelId) {
    const id = String(channelId);
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]
    ));
  }

  async function saveDrafts() {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'createBufferDrafts',
          channelIds: selectedIds,
          text: caption,
          imageUrl,
          itemId: item.id,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not create social drafts.');

      const count = payload.drafts?.length || 0;
      setMessage(`${count} Buffer draft${count === 1 ? '' : 's'} created.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not create social drafts.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="consignment-form-section social-post-panel" open>
      <summary className="consignment-form-section-head social-post-summary">
        <span>
          <span className="consignment-form-section-marker" aria-hidden="true" />
          <Tag size={17} aria-hidden="true" />
          <h2>Social media</h2>
        </span>
        <span className="consignment-row-sub">
          {connection ? 'Buffer connected' : 'Connect a publishing account'}
        </span>
      </summary>

      <div className="consignment-form-section-body social-post-body">
        {loading ? (
          <div className="social-post-state">
            <Loader2 className="consignment-spin" size={18} />
            Checking social connection…
          </div>
        ) : !connection ? (
          <div className="social-post-connect">
            <div>
              <strong>Connect this store to social media</strong>
              <p>
                Each merchant uses their own Buffer account. Once connected, this item can create ready-to-review social drafts.
              </p>
            </div>
            <a className="consignment-btn" href={socialSettingsHref}>
              {configured ? 'Connect Buffer' : 'Social Media setup'}
            </a>
          </div>
        ) : (
          <>
            <div className="social-post-preview">
              <div className="social-post-image">
                {imageUrl ? (
                  <img src={imageUrl} alt={item.shopifyTitle || item.description || 'Consignment item'} />
                ) : (
                  <div className="social-post-no-image">No image</div>
                )}
              </div>

              <div className="social-post-editor">
                <label className="consignment-label" htmlFor={`social-caption-${item.id}`}>
                  Caption
                </label>
                <textarea
                  id={`social-caption-${item.id}`}
                  className="consignment-textarea"
                  rows={8}
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="social-post-channels">
              <span className="consignment-label">Create drafts for</span>
              <div className="social-post-channel-grid">
                {channels.map((channel) => {
                  const id = String(channel.id);
                  const service = String(channel.service || '').toLowerCase();
                  const checked = selectedIds.includes(id);
                  return (
                    <label key={id} className={`social-post-channel ${checked ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChannel(id)}
                        disabled={disabled}
                      />
                      <ChannelIcon service={service} />
                      <span>
                        <strong>{channel.displayName || channel.name}</strong>
                        <small>{service}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {!imageUrl && channels.some((channel) => ['instagram', 'tiktok'].includes(String(channel.service).toLowerCase())) && (
              <p className="consignment-form-help">
                Instagram and TikTok drafts need an item image. Add a Shopify/product image first or select Facebook only.
              </p>
            )}

            {error && <div className="social-post-message error">{error}</div>}
            {message && (
              <div className="social-post-message success">
                <Check size={16} aria-hidden="true" /> {message}
              </div>
            )}

            <div className="social-post-actions">
              <button
                type="button"
                className="consignment-btn"
                onClick={saveDrafts}
                disabled={disabled || saving || !caption.trim() || selectedIds.length === 0}
              >
                {saving ? <Loader2 className="consignment-spin" size={16} /> : <Tag size={16} />}
                Save to Buffer drafts
              </button>

              <a
                className="consignment-btn secondary"
                href="https://publish.buffer.com/"
                target="_blank"
                rel="noreferrer"
              >
                Open Buffer <ChevronRight size={14} aria-hidden="true" />
              </a>
            </div>
          </>
        )}

        {!loading && error && !connection && (
          <div className="social-post-message error">{error}</div>
        )}
      </div>
    </details>
  );
}
