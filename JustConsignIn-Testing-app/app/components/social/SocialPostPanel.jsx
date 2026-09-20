/* eslint-disable react/prop-types */

import '../../styles/social-media.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Send,
  Tag,
  Trash2,
  Users,
  Video,
} from 'lucide-react';

import {
  canPersistSocialDraft,
  loadSocialDraft,
  saveSocialDraft,
} from './socialDraft.client';

const SUPPORTED_SERVICES = new Set(['instagram', 'facebook', 'tiktok']);
const MAX_MEDIA_ITEMS = 10;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function postTypeOptions(service) {
  return ['facebook', 'instagram'].includes(service)
    ? ['post', 'story', 'reel']
    : ['post'];
}

function toLocalDateTimeInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

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
  const productDescription = String(item.productDescription || '').trim();
  const brand = String(item.brand || item.vendor || '').trim();
  const size = String(item.size || '').trim();
  const condition = String(item.condition || '').trim();
  const price = moneyValue(item.shopifyPrice ?? item.price);
  const rawTags = Array.isArray(item.tags) ? item.tags.join(',') : String(item.tags || '');
  const hashtags = rawTags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => `#${tag.replace(/[^a-zA-Z0-9]/g, '')}`)
    .filter((tag) => tag.length > 1)
    .join(' ');

  const details = productDescription
    ? [productDescription]
    : [
        brand ? `Brand: ${brand}` : '',
        size ? `Size: ${size}` : '',
        condition ? `Condition: ${condition}` : '',
      ].filter(Boolean);

  return [
    title,
    ...details,
    price,
    hashtags || '#consignment #shoplocal',
  ].filter(Boolean).join('\n\n').trim();
}

export default function SocialPostPanel({ item, disabled = false }) {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [caption, setCaption] = useState(() => defaultCaption(item));
  const [captionTouched, setCaptionTouched] = useState(false);
  const [mediaTouched, setMediaTouched] = useState(false);
  const [media, setMedia] = useState(() => {
    const url = item.shopifyPhoto || item.photo || '';
    return url ? [{ id: 'product-image', type: 'image', url, previewUrl: url, name: 'Product image' }] : [];
  });
  const [postTypes, setPostTypes] = useState({});
  const [uploading, setUploading] = useState(false);
  const [savingAction, setSavingAction] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [bufferPosts, setBufferPosts] = useState([]);
  const [lastAction, setLastAction] = useState('');
  const savedDraftRef = useRef(false);
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
    savedDraftRef.current = false;
    setCaptionTouched(false);
    setMediaTouched(false);
    setBufferPosts([]);
    setLastAction('');
    setScheduleAt('');
    setScheduleOpen(false);
    setMessage('');
    setError('');
  }, [item.id]);

  useEffect(() => {
    let cancelled = false;

    async function restoreDraft() {
      if (!canPersistSocialDraft(item.id)) return;

      try {
        const draft = await loadSocialDraft(item.id);
        if (cancelled || !draft) return;

        savedDraftRef.current = true;
        setCaptionTouched(true);
        setMediaTouched(true);
        setCaption(String(draft.caption || ''));
        setMedia(Array.isArray(draft.media) ? draft.media : []);
        setSelectedIds(Array.isArray(draft.selectedIds) ? draft.selectedIds.map(String) : []);
        setPostTypes(draft.postTypes && typeof draft.postTypes === 'object' ? draft.postTypes : {});
        setScheduleAt(String(draft.scheduleAt || ''));
        setScheduleOpen(draft.scheduleOpen === true);
        setBufferPosts(Array.isArray(draft.bufferPosts) ? draft.bufferPosts : []);
        setLastAction(String(draft.lastAction || 'draft'));
      } catch (draftError) {
        if (!cancelled) {
          setError(draftError instanceof Error ? draftError.message : 'Could not load the saved social draft.');
        }
      }
    }

    restoreDraft();
    return () => { cancelled = true; };
  }, [item.id]);

  useEffect(() => {
    if (!captionTouched) {
      setCaption(defaultCaption(item));
    }
  }, [
    item.id,
    item.shopifyTitle,
    item.productDescription,
    item.description,
    item.brand,
    item.vendor,
    item.size,
    item.condition,
    item.shopifyPrice,
    item.price,
    item.tags,
    captionTouched,
  ]);

  useEffect(() => {
    if (!mediaTouched) {
      const url = item.shopifyPhoto || item.photo || '';
      setMedia(url ? [{ id: 'product-image', type: 'image', url, previewUrl: url, name: 'Product image' }] : []);
    }
  }, [item.id, item.shopifyPhoto, item.photo, mediaTouched]);

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
        if (!savedDraftRef.current) {
          setSelectedIds(available.map((channel) => String(channel.id)));
          setPostTypes(Object.fromEntries(
            available.map((channel) => [String(channel.id), 'post']),
          ));
        } else {
          const availableIds = new Set(available.map((channel) => String(channel.id)));
          setSelectedIds((current) => current.filter((id) => availableIds.has(String(id))));
        }
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

  async function prepareUpload(file, kind) {
    const response = await fetch('/api/social-media-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'prepare',
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        kind,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Could not prepare media upload.');
    return payload;
  }

  async function finalizeUpload(file, kind, resourceUrl) {
    const response = await fetch('/api/social-media-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'finalize',
        filename: file.name,
        kind,
        resourceUrl,
        alt: item.shopifyTitle || item.description || 'Consignment item social media',
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Could not save social media.');
    return payload;
  }

  async function waitForMedia(upload) {
    if (upload.url) return upload;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await sleep(1500);
      const response = await fetch('/api/social-media-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'status', id: upload.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not check media processing.');
      if (payload.status === 'FAILED') throw new Error('Shopify could not process that media file.');
      if (payload.url) return payload;
    }
    throw new Error('The media is still processing. Try again in a moment.');
  }

  async function uploadFiles(fileList, kind) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (media.length + files.length > MAX_MEDIA_ITEMS) {
      setError(`You can attach up to ${MAX_MEDIA_ITEMS} media items.`);
      return;
    }

    setUploading(true);
    setMessage('');
    setError('');
    try {
      const uploaded = [];
      for (const file of files) {
        const prepared = await prepareUpload(file, kind);
        const uploadBody = new FormData();
        for (const parameter of prepared.parameters || []) {
          uploadBody.append(parameter.name, parameter.value);
        }
        uploadBody.append('file', file, file.name);
        const transfer = await fetch(prepared.uploadUrl, { method: 'POST', body: uploadBody });
        if (!transfer.ok) throw new Error(`Media transfer failed (${transfer.status}).`);
        const finalized = await finalizeUpload(file, kind, prepared.resourceUrl);
        const ready = await waitForMedia(finalized);
        uploaded.push({ ...ready, name: file.name });
      }
      setMediaTouched(true);
      setMedia((current) => [...current, ...uploaded]);
      setMessage(`${uploaded.length} media file${uploaded.length === 1 ? '' : 's'} added.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload media.');
    } finally {
      setUploading(false);
    }
  }

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

  function draftSnapshot(nextBufferPosts = bufferPosts, nextAction = lastAction || 'draft') {
    return {
      caption,
      selectedIds,
      postTypes,
      media,
      scheduleAt,
      scheduleOpen,
      bufferPosts: nextBufferPosts,
      lastAction: nextAction,
    };
  }

  async function submitPosts(action) {
    if (action === 'schedule' && !scheduleAt) {
      setError('Choose a date and time before scheduling.');
      return;
    }

    setSavingAction(action);
    setMessage('');
    setError('');

    let localDraftSaved = false;

    try {
      if (action === 'draft' && canPersistSocialDraft(item.id)) {
        await saveSocialDraft(item.id, draftSnapshot(bufferPosts, 'draft'));
        localDraftSaved = true;
      }
      const response = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'createBufferPosts',
          channels: selectedIds.map((id) => ({
            id,
            text: caption,
            type: postTypes[id] || 'post',
          })),
          assets: media.filter((entry) => entry.url).map((entry) => ({
            type: entry.type,
            url: entry.url,
          })),
          action,
          dueAt: action === 'schedule' ? new Date(scheduleAt).toISOString() : null,
          existingPosts: ['draft', 'schedule'].includes(lastAction) ? bufferPosts : [],
          itemId: item.id,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not create social posts.');

      const posts = Array.isArray(payload.posts) ? payload.posts : [];
      const count = posts.length;

      setBufferPosts(posts);
      setLastAction(action);
      savedDraftRef.current = true;
      setCaptionTouched(true);
      setMediaTouched(true);

      if (canPersistSocialDraft(item.id)) {
        await saveSocialDraft(item.id, draftSnapshot(posts, action));
      }

      if (action === 'draft') {
        setMessage(`${count} draft${count === 1 ? '' : 's'} saved in JustConsignIn and Buffer.`);
      }
      if (action === 'now') setMessage(`${count} post${count === 1 ? '' : 's'} sent for publishing.`);
      if (action === 'schedule') setMessage(`${count} post${count === 1 ? '' : 's'} scheduled.`);

      if (!canPersistSocialDraft(item.id) && action === 'draft') {
        setMessage(`${count} Buffer draft${count === 1 ? '' : 's'} saved. Save the item first to keep these social edits in JustConsignIn.`);
      }
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : 'Could not create social posts.';
      setError(localDraftSaved ? `Draft saved in JustConsignIn. Buffer: ${detail}` : detail);
    } finally {
      setSavingAction('');
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
                Each merchant uses their own Buffer account. Once connected, this item can create, preview, schedule, and publish social posts.
              </p>
            </div>
            <a className="consignment-btn" href={socialSettingsHref}>
              {configured ? 'Connect Buffer' : 'Social Media setup'}
            </a>
          </div>
        ) : (
          <>
            <div className="social-composer-grid">
              <div className="social-composer-editor">
                <label className="consignment-label" htmlFor={`social-caption-${item.id}`}>
                  Caption
                </label>
                <textarea
                  id={`social-caption-${item.id}`}
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
                      disabled={disabled || uploading}
                      onChange={(event) => {
                        uploadFiles(event.target.files, 'image');
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <label className="consignment-btn secondary social-upload-button">
                    <Video size={16} /> Add video
                    <input
                      type="file"
                      accept="video/*"
                      hidden
                      disabled={disabled || uploading}
                      onChange={(event) => {
                        uploadFiles(event.target.files, 'video');
                        event.target.value = '';
                      }}
                    />
                  </label>
                  {uploading && <span className="social-uploading"><Loader2 className="consignment-spin" size={15} /> Uploading…</span>}
                </div>

                <div className="social-media-grid">
                  {media.map((entry, index) => (
                    <div className="social-media-card" key={`${entry.id || entry.url}-${index}`}>
                      <div className="social-media-thumb">
                        {entry.type === 'video' ? (
                          <video src={entry.url} muted playsInline />
                        ) : (
                          <img src={entry.previewUrl || entry.url} alt="" />
                        )}
                        <span>{index + 1}</span>
                      </div>
                      <div className="social-media-meta">
                        <strong>{entry.name || (entry.type === 'video' ? 'Video' : 'Image')}</strong>
                        <small>{entry.type}</small>
                      </div>
                      <div className="social-media-actions">
                        <button type="button" onClick={() => moveMedia(index, -1)} disabled={index === 0 || disabled} aria-label="Move left">
                          <ChevronLeft size={15} />
                        </button>
                        <button type="button" onClick={() => moveMedia(index, 1)} disabled={index === media.length - 1 || disabled} aria-label="Move right">
                          <ChevronRight size={15} />
                        </button>
                        <button type="button" className="danger" onClick={() => removeMedia(index)} disabled={disabled} aria-label="Remove media">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="social-live-preview">
                <span className="consignment-label">Preview</span>
                <div className={`social-preview-card ${selectedIds.length ? (postTypes[selectedIds[0]] || 'post') : 'post'}`}>
                  <div className="social-preview-profile">
                    {channels.find((channel) => String(channel.id) === selectedIds[0]) ? (
                      <>
                        <ChannelIcon service={String(channels.find((channel) => String(channel.id) === selectedIds[0])?.service || '').toLowerCase()} />
                        <strong>{channels.find((channel) => String(channel.id) === selectedIds[0])?.displayName || channels.find((channel) => String(channel.id) === selectedIds[0])?.name}</strong>
                      </>
                    ) : (
                      <strong>Social preview</strong>
                    )}
                  </div>
                  <div className="social-preview-media">
                    {media[0] ? (
                      media[0].type === 'video'
                        ? <video src={media[0].url} controls muted playsInline />
                        : <img src={media[0].previewUrl || media[0].url} alt="" />
                    ) : (
                      <div className="social-post-no-image">Add media</div>
                    )}
                    {media.length > 1 && <span className="social-preview-count">1 / {media.length}</span>}
                  </div>
                  <div className="social-preview-caption">{caption || 'No caption'}</div>
                </div>
              </div>
            </div>

            <div className="social-post-channels">
              <span className="consignment-label">Publish to</span>
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
                      <select
                        className="social-post-type-select"
                        value={postTypes[id] || 'post'}
                        onChange={(event) => setPostTypes((current) => ({ ...current, [id]: event.target.value }))}
                        onClick={(event) => event.stopPropagation()}
                        disabled={disabled}
                        aria-label={`Post type for ${channel.displayName || channel.name}`}
                      >
                        {postTypeOptions(service).map((type) => (
                          <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>

            {media.length === 0 && channels.some((channel) => ['instagram', 'tiktok'].includes(String(channel.service).toLowerCase())) && (
              <p className="consignment-form-help">
                Instagram and TikTok need an image or video. Add media above or select Facebook only.
              </p>
            )}

            {error && <div className="social-post-message error">{error}</div>}
            {message && (
              <div className="social-post-message success">
                <Check size={16} aria-hidden="true" /> {message}
              </div>
            )}

            <div className="social-post-actions social-post-actions-primary">
              <button
                type="button"
                className="consignment-btn social-post-now"
                onClick={() => submitPosts('now')}
                disabled={disabled || uploading || Boolean(savingAction) || !caption.trim() || selectedIds.length === 0}
              >
                {savingAction === 'now' ? <Loader2 className="consignment-spin" size={16} /> : <Send size={16} />}
                Post Now
              </button>

              <button
                type="button"
                className="consignment-btn secondary"
                onClick={() => submitPosts('draft')}
                disabled={disabled || uploading || Boolean(savingAction) || !caption.trim() || selectedIds.length === 0}
              >
                {savingAction === 'draft' ? <Loader2 className="consignment-spin" size={16} /> : <Tag size={16} />}
                Save Draft
              </button>

              <button
                type="button"
                className="consignment-btn secondary"
                onClick={() => setScheduleOpen((current) => !current)}
                disabled={disabled || Boolean(savingAction)}
              >
                <CalendarClock size={16} />
                {scheduleOpen ? 'Hide Schedule' : 'Schedule'}
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

            {scheduleOpen && (
              <div className="social-schedule-panel">
                <div className="social-schedule-presets">
                  <button
                    type="button"
                    className="consignment-btn secondary"
                    onClick={() => setScheduleAt(toLocalDateTimeInput(new Date(Date.now() + 30 * 60 * 1000)))}
                  >
                    +30 min
                  </button>
                  <button
                    type="button"
                    className="consignment-btn secondary"
                    onClick={() => setScheduleAt(toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)))}
                  >
                    +1 hour
                  </button>
                  <button
                    type="button"
                    className="consignment-btn secondary"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      tomorrow.setHours(9, 0, 0, 0);
                      setScheduleAt(toLocalDateTimeInput(tomorrow));
                    }}
                  >
                    Tomorrow 9 AM
                  </button>
                </div>

                <div className="social-schedule-row">
                  <CalendarClock size={17} />
                  <input
                    type="datetime-local"
                    className="consignment-input"
                    value={scheduleAt}
                    onChange={(event) => setScheduleAt(event.target.value)}
                    disabled={disabled || Boolean(savingAction)}
                  />
                  <button
                    type="button"
                    className="consignment-btn"
                    onClick={() => submitPosts('schedule')}
                    disabled={disabled || uploading || Boolean(savingAction) || !caption.trim() || selectedIds.length === 0 || !scheduleAt}
                  >
                    {savingAction === 'schedule' ? <Loader2 className="consignment-spin" size={16} /> : <CalendarClock size={16} />}
                    Schedule Post
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && error && !connection && (
          <div className="social-post-message error">{error}</div>
        )}
      </div>
    </details>
  );
}
