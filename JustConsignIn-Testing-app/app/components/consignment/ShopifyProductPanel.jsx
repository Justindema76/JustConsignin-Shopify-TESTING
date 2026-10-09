/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useEffect, useMemo, useRef, useState } from 'react';
import { uploadImage } from './productMedia.client';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  ShoppingBag,
  X,
} from 'lucide-react';

import {
  getShopifyProductOrganization,
  getShopifyPublishingChannels,
  searchShopifyCategories,
  searchShopifyFiles,
} from '../../consignmentApi';

function parseTags(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(source.map((tag) => String(tag).trim()).filter(Boolean))];
}

function normalizeCollection(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return { id: entry, title: entry };
  return {
    id: entry.id || entry.handle || entry.title,
    title: entry.title || entry.name || entry.handle || 'Collection',
    handle: entry.handle || '',
    isManual: entry.isManual !== false,
  };
}

function normalizeMedia(form) {
  const supplied = Array.isArray(form?.media) ? form.media : [];
  const media = supplied
    .map((entry) => ({
      id: entry?.id || null,
      url: entry?.url || entry?.previewUrl || null,
      alt: entry?.alt || '',
      pending: entry?.pending === true,
      clientKey: entry?.clientKey,
    }))
    .filter((entry) => entry.id || entry.url);

  if (!media.length && (form?.photoId || form?.photo)) {
    media.push({
      id: form.photoId || null,
      url: form.photo || null,
      alt: '',
    });
  }

  const seen = new Set();
  return media.filter((entry) => {
    const key = entry.id || entry.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


function ShopifyFilePicker({
  onClose,
  onConfirm,
  existingIds = [],
}) {
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerError, setPickerError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setPickerError('');

      try {
        const results = await searchShopifyFiles(search);
        if (!cancelled) setFiles(results);
      } catch (error) {
        if (!cancelled) {
          setFiles([]);
          setPickerError(
            error instanceof Error ? error.message : 'Could not load Shopify Files.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, search.trim() ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const existingSet = useMemo(
    () => new Set(existingIds.filter(Boolean)),
    [existingIds],
  );

  function toggleFile(file) {
    if (existingSet.has(file.id)) return;

    setSelectedIds((current) =>
      current.includes(file.id)
        ? current.filter((id) => id !== file.id)
        : [...current, file.id],
    );
  }

  function confirmSelection() {
    const selected = files.filter((file) => selectedIds.includes(file.id));
    if (!selected.length) return;
    onConfirm(selected);
  }

  return (
    <div
      className="shopify-file-picker-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="shopify-file-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopify-product-file-picker-title"
      >
        <header className="shopify-file-picker-header">
          <div className="shopify-file-picker-heading">
            <strong id="shopify-product-file-picker-title">
              Choose from Shopify Files
            </strong>
            <span>Select one or more images, then add them together.</span>
          </div>

          <button
            type="button"
            className="shopify-file-picker-close"
            onClick={onClose}
            aria-label="Close Shopify Files"
          >
            <X size={18} />
          </button>
        </header>

        <div className="shopify-file-picker-search">
          <input
            className="consignment-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Shopify Files"
            autoFocus
          />
        </div>

        <div className="shopify-file-picker-content">
          {loading && (
            <div className="shopify-file-picker-state">
              <Loader2 className="consignment-spin" size={18} />
              <span>Loading Shopify Files…</span>
            </div>
          )}

          {!loading && pickerError && (
            <div className="shopify-file-picker-state error">{pickerError}</div>
          )}

          {!loading && !pickerError && files.length === 0 && (
            <div className="shopify-file-picker-state">No Shopify images found.</div>
          )}

          {!loading && !pickerError && files.length > 0 && (
            <div className="shopify-file-picker-grid">
              {files.map((file) => {
                const selected = selectedIds.includes(file.id);
                const alreadyAdded = existingSet.has(file.id);

                return (
                  <button
                    key={file.id}
                    type="button"
                    className={[
                      'shopify-file-picker-card',
                      selected ? 'is-selected' : '',
                      alreadyAdded ? 'is-added' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => toggleFile(file)}
                    disabled={alreadyAdded}
                    aria-pressed={selected}
                  >
                    <span className="shopify-file-picker-image">
                      <img src={file.url} alt={file.alt || 'Shopify file'} />
                      {selected && (
                        <span className="shopify-file-picker-selected-mark">
                          <Check size={16} />
                        </span>
                      )}
                      {alreadyAdded && (
                        <span className="shopify-file-picker-added-mark">
                          Added
                        </span>
                      )}
                    </span>

                    <span className="shopify-file-picker-name">
                      {file.alt || 'Shopify image'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="shopify-file-picker-footer">
          <span className="shopify-file-picker-selection-count">
            {selectedIds.length
              ? `${selectedIds.length} selected`
              : 'Select images to add'}
          </span>

          <div className="shopify-file-picker-footer-actions">
            <button
              type="button"
              className="consignment-btn secondary"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="button"
              className="consignment-btn"
              disabled={!selectedIds.length}
              onClick={confirmSelection}
            >
              Add selected{selectedIds.length ? ` (${selectedIds.length})` : ''}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function ProductMedia({
  form,
  setForm,
  disabled,
}) {
  const [showShopifyFiles, setShowShopifyFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const previewUrls = useRef([]);
  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const media = normalizeMedia(form);

  function commitMedia(nextMedia) {
    const first = nextMedia[0] || null;
    setForm((current) => ({
      ...current,
      media: nextMedia,
      photoId: first?.id || null,
      photo: first?.url || null,
    }));
  }

  async function addLocalFiles(fileList) {
    const files = [...(fileList || [])].filter((file) =>
      file.type?.startsWith('image/'),
    );

    if (!files.length) return;

    setUploading(true);
    setUploadError('');

    try {
      const pending = files.map((file) => {
        const url = URL.createObjectURL(file);
        previewUrls.current.push(url);
        return { id: null, url, clientKey: url, alt: file.name, pending: true };
      });
      setForm((current) => ({ ...current, media: [...normalizeMedia(current), ...pending] }));
      for (let index = 0; index < files.length; index += 1) {
        const uploaded = { ...await uploadImage(files[index], form.shopifyTitle || 'Consignment item'), clientKey: pending[index].url };
        setForm((current) => {
          const next = (current.media || []).map((entry) => entry.url === pending[index].url ? uploaded : entry);
          return { ...current, media: next, photoId: next[0]?.id || null, photo: next[0]?.url || null };
        });
      }
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'Could not upload image.',
      );
    } finally {
      setForm((current) => {
        const next = (current.media || []).filter((entry) => !entry.pending);
        return { ...current, media: next, photoId: next[0]?.id || null, photo: next[0]?.url || null };
      });
      setUploading(false);
    }
  }

  function addShopifyFiles(files) {
    const next = [
      ...media,
      ...files.map((file) => ({
        id: file.id,
        url: file.url,
        alt: file.alt || '',
      })),
    ];

    const seen = new Set();
    commitMedia(
      next.filter((entry) => {
        const key = entry.id || entry.url;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
    setShowShopifyFiles(false);
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= media.length) return;
    const next = [...media];
    [next[index], next[target]] = [next[target], next[index]];
    commitMedia(next);
  }

  function remove(index) {
    commitMedia(media.filter((_, mediaIndex) => mediaIndex !== index));
  }

  return (
    <div className="consignment-shopify-product-media">
      <div className="consignment-shopify-product-media-toolbar">
        <span className="consignment-shopify-product-field-label">Media</span>
      </div>

      <div className="consignment-shopify-product-media-grid">
        {media.map((entry, index) => (
          <div
            className="consignment-shopify-product-media-tile"
            key={entry.id || entry.url || index}
          >
            {entry.url ? (
              <img src={entry.url} alt={entry.alt || `Product image ${index + 1}`} />
            ) : (
              <span>Image {index + 1}</span>
            )}

            {index === 0 && (
              <span className="consignment-shopify-product-primary-badge">
                Primary
              </span>
            )}

            <span className="consignment-shopify-product-media-number">
              {index + 1}
            </span>

            <div className="consignment-shopify-product-media-controls">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={disabled || index === 0}
                aria-label="Move image left"
              >
                <ChevronLeft size={15} />
              </button>

              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={disabled || index === media.length - 1}
                aria-label="Move image right"
              >
                <ChevronRight size={15} />
              </button>

              <button
                type="button"
                className="danger"
                onClick={() => remove(index)}
                disabled={disabled}
                aria-label="Remove image"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        ))}

        <div className="consignment-shopify-product-media-add">
          <ImagePlus size={22} />
          <span>Add images</span>

          <div className="consignment-shopify-product-media-add-actions">
            <label className="consignment-btn secondary consignment-shopify-product-small-action">
              From device
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                disabled={disabled || uploading}
                onChange={(event) => {
                  addLocalFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </label>

            <button
              type="button"
              className="consignment-btn secondary consignment-shopify-product-small-action"
              disabled={disabled || uploading}
              onClick={() => setShowShopifyFiles(true)}
            >
              Shopify Files
            </button>
          </div>
        </div>
      </div>

      {uploading && (
        <div className="consignment-shopify-product-media-status">
          <Loader2 className="consignment-spin" size={15} />
          Uploading images…
        </div>
      )}

      {uploadError && (
        <div className="consignment-shopify-product-media-error">
          {uploadError}
        </div>
      )}

      {showShopifyFiles && (
        <ShopifyFilePicker
          onClose={() => setShowShopifyFiles(false)}
          onConfirm={addShopifyFiles}
          existingIds={media.map((entry) => entry.id).filter(Boolean)}
        />
      )}
    </div>
  );
}

function TagEditor({
  value,
  onChange,
  disabled,
  suggestions = [],
}) {
  const tags = useMemo(() => parseTags(value), [value]);
  const [draft, setDraft] = useState('');
  const [showExisting, setShowExisting] = useState(false);

  function commit(nextTags) {
    onChange([...new Set(nextTags)].join(', '));
  }

  function addDraft() {
    const next = draft.trim().replace(/^#/, '');
    if (!next) return;
    commit([...tags, next]);
    setDraft('');
  }

  const available = suggestions
    .map((tag) => String(tag).trim())
    .filter((tag) => tag && !tags.includes(tag));

  return (
    <div className="consignment-shopify-product-tags">
      <div className="consignment-shopify-product-chip-list">
        {tags.map((tag) => (
          <span className="consignment-shopify-product-chip" key={tag}>
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => commit(tags.filter((entry) => entry !== tag))}
                aria-label={`Remove ${tag}`}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      </div>

      {!disabled && (
        <>
          <div className="consignment-shopify-product-add-row">
            <input
              className="consignment-input consignment-shopify-product-tag-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={addDraft}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  addDraft();
                }
              }}
              placeholder="Add tag"
            />

            {available.length > 0 && (
              <button
                type="button"
                className="consignment-shopify-product-inline-link"
                onClick={() => setShowExisting((current) => !current)}
              >
                {showExisting ? 'Hide existing' : 'Add existing'}
              </button>
            )}
          </div>

          {showExisting && available.length > 0 && (
            <div className="consignment-shopify-product-option-list">
              {available.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => commit([...tags, tag])}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CollectionEditor({
  value,
  onChange,
  disabled,
  options = [],
}) {
  const collections = (Array.isArray(value) ? value : ['Consignment'])
    .map(normalizeCollection)
    .filter(Boolean);
  const [showExisting, setShowExisting] = useState(false);
  const selectedIds = new Set(
    collections.map((entry) => entry.id || entry.title),
  );
  const selectedTitles = new Set(
    collections.map((entry) => entry.title).filter(Boolean),
  );
  const available = options
    .map(normalizeCollection)
    .filter(
      (entry) =>
        entry &&
        entry.isManual !== false &&
        !selectedIds.has(entry.id || entry.title) &&
        !selectedTitles.has(entry.title),
    );

  function commit(nextCollections) {
    onChange(
      nextCollections.map((entry) => ({
        id: entry.id,
        title: entry.title,
        handle: entry.handle || '',
        isManual: entry.isManual !== false,
      })),
    );
  }

  return (
    <div>
      <div className="consignment-shopify-product-chip-list">
        {collections.map((collection) => (
          <span
            className="consignment-shopify-product-chip"
            key={collection.id || collection.title}
          >
            {collection.title}
            {!disabled && collection.title !== 'Consignment' && (
              <button
                type="button"
                onClick={() =>
                  commit(
                    collections.filter(
                      (entry) =>
                        (entry.id || entry.title) !==
                        (collection.id || collection.title),
                    ),
                  )
                }
                aria-label={`Remove ${collection.title}`}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      </div>

      {!disabled && available.length > 0 && (
        <>
          <button
            type="button"
            className="consignment-shopify-product-inline-link"
            onClick={() => setShowExisting((current) => !current)}
          >
            {showExisting ? 'Hide collections' : 'Add collection'}
          </button>

          {showExisting && (
            <div className="consignment-shopify-product-option-list">
              {available.map((collection) => (
                <button
                  type="button"
                  key={collection.id || collection.title}
                  onClick={() => commit([...collections, collection])}
                >
                  {collection.title}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ShopifyProductPanel({
  shopifyForm,
  setShopifyForm,
  linkedProductId = '',
  linkedStatus = '',
  disabled = false,
  onSync = null,
  syncing = false,
  tier2Enabled = true,
  direct = false,
}) {
  const [categorySearch, setCategorySearch] = useState(
    shopifyForm.shopifyCategoryName || '',
  );
  const [categoryResults, setCategoryResults] = useState([]);
  const [searchingCategories, setSearchingCategories] = useState(false);
  const [organization, setOrganization] = useState({
    collections: [],
    tags: [],
  });
  const [publishingChannels, setPublishingChannels] = useState({
    metaInstalled: false,
    metaPublicationName: '',
  });

  useEffect(() => {
    setCategorySearch(shopifyForm.shopifyCategoryName || '');
  }, [shopifyForm.shopifyCategoryName]);

  useEffect(() => {
    let cancelled = false;
    getShopifyPublishingChannels()
      .then((result) => {
        if (!cancelled) setPublishingChannels(result);
      })
      .catch(() => {
        if (!cancelled) setPublishingChannels({ metaInstalled: false, metaPublicationName: '' });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    getShopifyProductOrganization()
      .then((result) => {
        if (!cancelled) {
          setOrganization({
            collections: result.collections || [],
            tags: result.tags || [],
            storefrontUrl: result.storefrontUrl || '',
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOrganization({ collections: [], tags: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = categorySearch.trim();

    if (
      query.length < 2 ||
      query === String(shopifyForm.shopifyCategoryName || '').trim()
    ) {
      setCategoryResults([]);
      return undefined;
    }

    const timer = setTimeout(() => {
      setSearchingCategories(true);
      searchShopifyCategories(query)
        .then(setCategoryResults)
        .catch(() => setCategoryResults([]))
        .finally(() => setSearchingCategories(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [categorySearch, shopifyForm.shopifyCategoryName]);

  const canSync = Boolean(onSync) && tier2Enabled;
  function setValue(key, value) {
    setShopifyForm((current) => ({ ...current, [key]: value }));
  }

  if (!tier2Enabled) {
    return (
      <section className="consignment-form-section">
        <div className="consignment-form-section-head consignment-shopify-summary consignment-shopify-locked">
          <span>
            <span className="consignment-form-section-marker" aria-hidden="true" />
            <ShoppingBag size={17} />
            <h2>Shopify product</h2>
          </span>
          <span className="consignment-row-sub">
            Requires Manual + Shopify Sync plan
          </span>
        </div>
      </section>
    );
  }

  return (
    <details className="consignment-form-section" open>
      <summary className="consignment-form-section-head consignment-shopify-summary">
        <span>
          <span className="consignment-form-section-marker" aria-hidden="true" />
          <ShoppingBag size={17} />
          <h2>Shopify product</h2>
        </span>

        <span className="consignment-row-sub">
          {linkedProductId ? 'Connected' : direct ? 'Create product' : 'Create linked product'}
        </span>
      </summary>

      <div className="consignment-form-section-body consignment-shopify-product-body">
        <fieldset
          disabled={disabled}
          className="consignment-shopify-product-fieldset"
        >
          <div className="consignment-shopify-product-layout">
            <div className="consignment-shopify-product-main">
              <div className="consignment-shopify-product-card">
                <div className="consignment-form-field">
                  <label className="consignment-shopify-product-field-label">
                    Title
                  </label>
                  <input
                    className="consignment-input"
                    value={shopifyForm.shopifyTitle || ''}
                    onChange={(event) =>
                      setValue('shopifyTitle', event.target.value)
                    }
                    placeholder="Auto-filled from item description"
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-shopify-product-field-label">
                    Price
                  </label>
                  <input
                    className="consignment-input"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={shopifyForm.shopifyPrice ?? ''}
                    onChange={(event) =>
                      setValue('shopifyPrice', event.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-shopify-product-field-label">
                    Description
                  </label>
                  <textarea
                    className="consignment-textarea consignment-shopify-product-description"
                    rows={6}
                    value={shopifyForm.productDescription || ''}
                    onChange={(event) =>
                      setValue('productDescription', event.target.value)
                    }
                    placeholder="Shown to customers on Shopify"
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-shopify-product-field-label">SKU</label>
                  <input className="consignment-input" value={shopifyForm.sku ?? ''} onChange={(event) => setValue('sku', event.target.value)} />
                </div>
                <div className="consignment-form-field">
                  <label className="consignment-shopify-product-field-label">Weight</label>
                  <input className="consignment-input" type="number" min="0" step="any" inputMode="decimal" value={shopifyForm.weight ?? ''} onChange={(event) => setValue('weight', event.target.value)} />
                  <select className="consignment-select" aria-label="Weight unit" value={shopifyForm.weightUnit || 'KILOGRAMS'} onChange={(event) => setValue('weightUnit', event.target.value)}>
                    <option value="KILOGRAMS">kg</option><option value="GRAMS">g</option><option value="POUNDS">lb</option><option value="OUNCES">oz</option>
                  </select>
                </div>
                <div className="consignment-form-field">
                  <h3>Search engine listing</h3>
                  <div aria-label="Search engine listing preview">
                    <strong>{shopifyForm.seoTitle || shopifyForm.shopifyTitle || 'Product title'}</strong>
                    <div>{organization.storefrontUrl}/products/{shopifyForm.shopifyHandle || String(shopifyForm.shopifyTitle || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}</div>
                    <p>{shopifyForm.seoDescription || shopifyForm.productDescription || 'Product description'}</p>
                  </div>
                  <label className="consignment-shopify-product-field-label">Page title</label>
                  <input className="consignment-input" value={shopifyForm.seoTitle || ''} onChange={(event) => setValue('seoTitle', event.target.value)} />
                  <label className="consignment-shopify-product-field-label">Meta description</label>
                  <textarea className="consignment-textarea" rows={3} value={shopifyForm.seoDescription || ''} onChange={(event) => setValue('seoDescription', event.target.value)} />
                  <label className="consignment-shopify-product-field-label">URL handle</label>
                  <input className="consignment-input" value={shopifyForm.shopifyHandle || ''} onChange={(event) => setValue('shopifyHandle', event.target.value)} placeholder="product-url-handle" />
                </div>

                <ProductMedia
                  form={shopifyForm}
                  setForm={setShopifyForm}
                  disabled={disabled}
                />

                <div className="consignment-form-field consignment-shopify-product-category-field">
                  <label className="consignment-shopify-product-field-label">
                    Category
                  </label>

                  <input
                    className="consignment-input"
                    value={categorySearch}
                    onChange={(event) => {
                      setCategorySearch(event.target.value);
                      if (
                        event.target.value !== shopifyForm.shopifyCategoryName
                      ) {
                        setShopifyForm((current) => ({
                          ...current,
                          shopifyCategoryId: '',
                          shopifyCategoryName: '',
                        }));
                      }
                    }}
                    placeholder="Search Shopify categories"
                  />

                  {searchingCategories && (
                    <div className="consignment-row-sub consignment-shopify-product-category-status">
                      Searching Shopify…
                    </div>
                  )}

                  {categoryResults.length > 0 && (
                    <div className="consignment-category-results">
                      {categoryResults.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          className="consignment-category-result"
                          onClick={() => {
                            setShopifyForm((current) => ({
                              ...current,
                              shopifyCategoryId: category.id,
                              shopifyCategoryName: category.name,
                            }));
                            setCategorySearch(category.name);
                            setCategoryResults([]);
                          }}
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {shopifyForm.shopifyCategoryId && (
                    <div className="consignment-selected-category">
                      <span>{shopifyForm.shopifyCategoryName}</span>
                      <button
                        type="button"
                        className="consignment-batch-remove"
                        aria-label="Remove Shopify category"
                        onClick={() => {
                          setShopifyForm((current) => ({
                            ...current,
                            shopifyCategoryId: '',
                            shopifyCategoryName: '',
                          }));
                          setCategorySearch('');
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>


              </div>
            </div>

            <aside className="consignment-shopify-product-sidebar">
              <div className="consignment-shopify-product-side-card">
                <div className="consignment-form-field">
                  <label className="consignment-shopify-product-field-label">
                    Status
                  </label>
                  <select className="consignment-select" value="ACTIVE" disabled>
                    <option value="ACTIVE">Active</option>
                  </select>
                </div>

                <div className="consignment-shopify-product-side-heading">
                  Publishing
                </div>

                <label className="consignment-shopify-product-publish-option">
                  <input
                    type="checkbox"
                    checked={shopifyForm.publishToPos !== false}
                    onChange={(event) =>
                      setValue('publishToPos', event.target.checked)
                    }
                  />
                  <span>
                    <strong>Point of Sale</strong>
                    <small>Publish this product to Shopify POS.</small>
                  </span>
                </label>

                <label className="consignment-shopify-product-publish-option">
                  <input
                    type="checkbox"
                    checked={shopifyForm.publishOnline === true}
                    onChange={(event) =>
                      setValue('publishOnline', event.target.checked)
                    }
                  />
                  <span>
                    <strong>Online Store</strong>
                    <small>Also publish this product online.</small>
                  </span>
                </label>

                {publishingChannels.metaInstalled ? (
                  <label className="consignment-shopify-product-publish-option">
                    <input
                      type="checkbox"
                      checked={shopifyForm.publishMeta === true}
                      onChange={(event) => setValue('publishMeta', event.target.checked)}
                    />
                    <span>
                      <strong>Facebook &amp; Instagram</strong>
                      <small>Publish this product to the connected Meta sales channel.</small>
                    </span>
                  </label>
                ) : (
                  <p className="consignment-shopify-help" style={{ margin: '10px 0 0' }}>
                    Want to tag this product in Facebook or Instagram posts?{' '}
                    <a href="https://apps.shopify.com/facebook" target="_blank" rel="noreferrer">
                      Install Facebook &amp; Instagram by Meta
                    </a>
                  </p>
                )}
              </div>

              <div className="consignment-shopify-product-side-card">
                <div className="consignment-shopify-product-side-heading">
                  Product organization
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-shopify-product-field-label">
                    Type
                  </label>
                  <input
                    className="consignment-input"
                    value={shopifyForm.productType || ''}
                    onChange={(event) =>
                      setValue('productType', event.target.value)
                    }
                    placeholder="Product type"
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-shopify-product-field-label">
                    Vendor
                  </label>
                  <input
                    className="consignment-input"
                    value={shopifyForm.vendor || ''}
                    onChange={(event) => setValue('vendor', event.target.value)}
                    placeholder="Defaults to store name"
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-shopify-product-field-label">
                    Collections
                  </label>
                  <CollectionEditor
                    value={shopifyForm.collections}
                    disabled={disabled}
                    options={organization.collections}
                    onChange={(value) => setValue('collections', value)}
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-shopify-product-field-label">
                    Tags
                  </label>
                  <TagEditor
                    value={shopifyForm.tags}
                    disabled={disabled}
                    suggestions={organization.tags}
                    onChange={(value) => setValue('tags', value)}
                  />
                </div>
              </div>
            </aside>
          </div>

          {linkedProductId && (
            <div className="consignment-shopify-product-linked">
              <Check size={14} />
              Linked Shopify product · {linkedStatus || 'Connected'}
            </div>
          )}

          <div className="consignment-shopify-product-actions">
            <button
              className="consignment-btn"
              disabled={
                !canSync ||
                disabled ||
                syncing ||
                shopifyForm.media?.some((entry) => entry.pending) ||
                (
                  shopifyForm.publishToPos === false &&
                  shopifyForm.publishOnline !== true &&
                  shopifyForm.publishMeta !== true
                )
              }
              onClick={onSync}
            >
              {syncing ? (
                <Loader2 className="consignment-spin" size={16} />
              ) : linkedProductId ? (
                <Check size={16} />
              ) : (
                <ShoppingBag size={16} />
              )}
              {linkedProductId ? 'Update Shopify product' : 'Create Shopify product'}
            </button>

            {linkedProductId && (
              <a
                className="consignment-btn secondary"
                href={`shopify://admin/products/${String(linkedProductId).split('/').pop()}`}
                target="_top"
              >
                Edit in Shopify
              </a>
            )}
          </div>
        </fieldset>
      </div>
    </details>
  );
}
