/* eslint-disable react/prop-types */

import '../../styles/social-media.css';

import { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Send,
  Tag,
  Trash2,
  Users,
  Video,
} from 'lucide-react';

const MAX_MEDIA_ITEMS = 10;

function moneyValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : '';
}

function defaultCaption(item) {
  const title = String(item.shopifyTitle || item.description || '').trim();
  const description = String(item.productDescription || '').trim();
  const price = moneyValue(item.shopifyPrice ?? item.price);
  const rawTags = Array.isArray(item.tags) ? item.tags.join(',') : String(item.tags || '');
  const hashtags = rawTags.split(',').map((tag) => tag.trim()).filter(Boolean)
    .map((tag) => `#${tag.replace(/[^a-zA-Z0-9]/g, '')}`).filter((tag) => tag.length > 1).join(' ');
  return [title, description, price, hashtags].filter(Boolean).join('\n\n').trim();
}

function productMedia(item) {
  const source = Array.isArray(item.shopifyMedia) && item.shopifyMedia.length
    ? item.shopifyMedia
    : (item.shopifyPhoto || item.photo)
      ? [{ id: 'product-image', url: item.shopifyPhoto || item.photo, alt: item.shopifyTitle || item.description || '' }]
      : [];
  return source.filter((entry) => entry?.url).slice(0, MAX_MEDIA_ITEMS).map((entry, index) => ({
    id: entry.id || `meta-product-image-${index}`,
    type: entry.type || 'image',
    url: entry.url,
    previewUrl: entry.previewUrl || entry.url,
    name: entry.alt || entry.name || `Shopify product image ${index + 1}`,
  }));
}

export default function MetaProductPostPanel({ item, disabled = false }) {
  const [caption, setCaption] = useState(() => defaultCaption(item));
  const [captionTouched, setCaptionTouched] = useState(false);
  const [media, setMedia] = useState(() => productMedia(item));
  const [mediaTouched, setMediaTouched] = useState(false);
  const [facebook, setFacebook] = useState(true);
  const [instagram, setInstagram] = useState(true);
  const [tagProduct, setTagProduct] = useState(true);
  const productReady = Boolean(item?.shopifyProductId);

  useEffect(() => {
    if (!captionTouched) setCaption(defaultCaption(item));
  }, [item, captionTouched]);

  useEffect(() => {
    if (!mediaTouched) setMedia(productMedia(item));
  }, [item, mediaTouched]);

  function removeMedia(index) {
    setMediaTouched(true);
    setMedia((current) => current.filter((_, mediaIndex) => mediaIndex !== index));
  }

  function moveMedia(index, direction) {
    setMediaTouched(true);
    setMedia((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  return (
    <details className="consignment-form-section social-post-panel meta-product-post-panel" open>
      <summary className="consignment-form-section-head social-post-summary">
        <span>
          <span className="consignment-form-section-marker" aria-hidden="true" />
          <Tag size={17} aria-hidden="true" />
          <h2>Meta Product Post</h2>
        </span>
        <span className="consignment-row-sub">Facebook & Instagram product tagging</span>
      </summary>

      <div className="consignment-form-section-body social-post-body">
        <div className="social-composer-grid">
          <div className="social-composer-editor">
            <label className="consignment-label" htmlFor="meta-product-caption">Caption</label>
            <textarea
              id="meta-product-caption"
              className="consignment-textarea"
              rows={8}
              value={caption}
              onChange={(event) => {
                setCaptionTouched(true);
                setCaption(event.target.value);
              }}
              disabled={disabled}
            />

            <div className="social-media-toolbar">
              <label className="consignment-btn secondary social-upload-button">
                <ImagePlus size={16} /> Add images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  disabled={disabled}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    const available = Math.max(0, MAX_MEDIA_ITEMS - media.length);
                    const additions = files.slice(0, available).map((file, index) => ({
                      id: `local-meta-${Date.now()}-${index}`,
                      type: 'image',
                      url: URL.createObjectURL(file),
                      previewUrl: URL.createObjectURL(file),
                      name: file.name,
                      file,
                    }));
                    setMediaTouched(true);
                    setMedia((current) => [...current, ...additions]);
                    event.target.value = '';
                  }}
                />
              </label>
              <label className="consignment-btn secondary social-upload-button">
                <Video size={16} /> Add video
                <input type="file" accept="video/*" hidden disabled={disabled} />
              </label>
            </div>

            <div className="social-media-grid">
              {media.map((entry, index) => (
                <div className="social-media-card" key={`${entry.id || entry.url}-${index}`}>
                  <div className="social-media-thumb">
                    {entry.type === 'video'
                      ? <video src={entry.previewUrl || entry.url} muted playsInline />
                      : <img src={entry.previewUrl || entry.url} alt="" />}
                    <span>{index + 1}</span>
                  </div>
                  <div className="social-media-meta">
                    <strong>{entry.name || 'Product image'}</strong>
                    <small>{entry.type}</small>
                  </div>
                  <div className="social-media-actions">
                    <button type="button" onClick={() => moveMedia(index, -1)} disabled={index === 0 || disabled} aria-label="Move left"><ChevronLeft size={15} /></button>
                    <button type="button" onClick={() => moveMedia(index, 1)} disabled={index === media.length - 1 || disabled} aria-label="Move right"><ChevronRight size={15} /></button>
                    <button type="button" className="danger" onClick={() => removeMedia(index)} disabled={disabled} aria-label="Remove media"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="social-live-preview">
            <span className="consignment-label">Preview</span>
            <div className="social-preview-card post">
              <div className="social-preview-profile"><Camera size={17} /><strong>Meta product post</strong></div>
              <div className="social-preview-media">
                {media[0]
                  ? media[0].type === 'video'
                    ? <video src={media[0].previewUrl || media[0].url} controls muted playsInline />
                    : <img src={media[0].previewUrl || media[0].url} alt="" />
                  : <div className="social-post-no-image">Add media</div>}
                {media.length > 1 && <span className="social-preview-count">1 / {media.length}</span>}
              </div>
              <div className="social-preview-caption">{caption || 'No caption'}</div>
            </div>
          </div>
        </div>

        <div className="social-post-channels">
          <span className="consignment-label">Publish directly to Meta</span>
          <div className="social-post-channel-grid">
            <label className={`social-post-channel ${facebook ? 'selected' : ''}`}>
              <input type="checkbox" checked={facebook} onChange={(event) => setFacebook(event.target.checked)} disabled={disabled} />
              <Users size={17} />
              <span><strong>Facebook</strong><small>Meta direct</small></span>
            </label>
            <label className={`social-post-channel ${instagram ? 'selected' : ''}`}>
              <input type="checkbox" checked={instagram} onChange={(event) => setInstagram(event.target.checked)} disabled={disabled} />
              <Camera size={17} />
              <span><strong>Instagram</strong><small>Meta direct</small></span>
            </label>
          </div>
        </div>

        <div className="social-post-product-tag">
          <label className={`social-post-channel ${tagProduct ? 'selected' : ''}`}>
            <input
              type="checkbox"
              checked={tagProduct}
              onChange={(event) => setTagProduct(event.target.checked)}
              disabled={disabled || !productReady}
            />
            <Tag size={17} />
            <span>
              <strong>Tag Shopify product</strong>
              <small>{productReady ? (item.shopifyTitle || item.description || 'Current Shopify product') : 'Create the Shopify product first'}</small>
            </span>
          </label>
        </div>

        <div className="social-post-actions social-post-actions-primary">
          <button
            type="button"
            className="consignment-btn social-post-now"
            disabled
            title="Direct Meta publishing connection is not wired yet"
          >
            <Send size={16} /> Post to Meta
          </button>
        </div>

        {!productReady && <p className="consignment-form-help">Create the Shopify product above before tagging it in a Meta post.</p>}
        {productReady && <div className="social-post-message success"><Check size={16} /> Shopify product ready for Meta tagging.</div>}
      </div>
    </details>
  );
}
