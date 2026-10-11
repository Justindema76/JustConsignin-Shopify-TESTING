/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useEffect, useRef, useState } from 'react';
import { Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Header from '../../components/consignment/Header';
import ItemBarcode from '../../components/consignment/ItemBarcode';
import {
  ManualItemCore,
  ShopifyProductSection,
} from '../../components/consignment/ManualItemCore';
import ManualSaleStatus from '../../components/consignment/ManualSaleStatus';
import SocialPostPanel from '../../components/social/SocialPostPanel';
import {
  money,
  productLabel,
  statusClass,
  statusLabel,
} from '../../lib/consignmentHelpers';
import '../../styles/item-page.css';

/* ============================================================================
   PAGE: ITEM DETAILS
   Header: photo (Growth), title, price, status, consignor; barcode + Print
   label (Growth); ••• menu with Edit details and Delete item.
   Tabs: Details (both plans), Shopify listing and Social post (Growth only).
   ============================================================================ */

const LOCKED_MESSAGE = 'Requires Manual + Shopify Sync plan';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(
    String(value).includes('T') ? value : `${value}T00:00:00`,
  );
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function LockedTab({ title }) {
  return (
    <div className="consignment-item-locked">
      <Lock size={20} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{LOCKED_MESSAGE}</span>
    </div>
  );
}

export default function EditItemScreen({
  item,
  consignor = null,
  currency = 'CAD',
  onBack,
  onSave,
  onDelete,
  onSyncProduct,
  onUpdateStatus,
  onOpenPayoutReceipt,
  onStartPayout,
  tier2Enabled = false,
}) {
  const [form, setForm] = useState({
    itemNumber: item.itemNumber || '',
    category: item.category || 'Other',
    type: '',
    description: item.description || '',
    size: item.size || '',
    condition: item.condition || 'Good',
    price: item.price ?? '',
    brand: item.brand || '',
    notes: item.notes || '',
    consignmentTerm: item.consignmentTerm || '',
  });
  const [shopifyForm, setShopifyForm] = useState({
    photo: item.shopifyPhoto || item.photo || null,
    photoId: item.photoId || null,
    media:
      Array.isArray(item.shopifyMedia) && item.shopifyMedia.length
        ? item.shopifyMedia
        : item.shopifyPhoto || item.photo
          ? [
              {
                id: item.photoId || null,
                url: item.shopifyPhoto || item.photo,
                alt: item.shopifyTitle || item.description || '',
              },
            ]
          : [],
    productType: item.shopifyProductType || item.type || item.category || '',
    collections:
      Array.isArray(item.shopifyCollections) && item.shopifyCollections.length
        ? item.shopifyCollections.filter(
            (entry) =>
              String(entry?.title || entry || '').toLowerCase() ===
              'consignment',
          )
        : ['Consignment'],
    shopifyTitle: item.shopifyTitle || '',
    shopifyPrice: item.shopifyPrice ?? item.price ?? '',
    shopifyStatus:
      String(item.shopifyProductStatus || '').toUpperCase() === 'DRAFT'
        ? 'DRAFT'
        : 'ACTIVE',
    tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '',
    vendor: item.vendor || '',
    productDescription: item.productDescription || '',
    shopifyCategoryId: item.shopifyCategoryId || '',
    shopifyCategoryName: item.shopifyCategoryName || '',
    sku: item.sku ?? item.itemNumber ?? '',
    weight: item.weight ?? '',
    weightUnit: item.weightUnit || 'KILOGRAMS',
    shopifyHandle: item.shopifyProductHandle || item.shopifyHandle || '',
    seoTitle: item.seoTitle || '',
    seoDescription: item.seoDescription || '',
    publishToPos: true,
    publishOnline: item.publishOnline === true,
    publishMeta: false,
  });
  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const menuRef = useRef(null);

  const isSold = item.status === 'Sold' || Boolean(item.dateSold);
  const allowManualSale = !tier2Enabled || !item.shopifyProductId;
  const canSave = form.description.trim() && form.price !== '';
  const title =
    item.shopifyTitle || item.description || `Item ${item.itemNumber}`;
  const photo = tier2Enabled
    ? shopifyForm.media?.[0]?.url || item.shopifyPhoto || item.photo || null
    : null;
  const channel = productLabel(item);
  const shopifyStatus = String(item.shopifyProductStatus || '').toUpperCase();
  const commissionPct = Number(
    item.commissionPct ?? consignor?.commissionPct ?? 0,
  );
  const price = Number(item.price ?? 0);
  const consignorShare = (price * commissionPct) / 100;

  // After the item number changes, the Shopify listing tab must show the
  // new SKU so a later "Save to Shopify" doesn't put the old one back.
  useEffect(() => {
    setShopifyForm((current) =>
      current.sku === (item.sku ?? item.itemNumber)
        ? current
        : { ...current, sku: item.sku ?? item.itemNumber ?? '' },
    );
  }, [item.itemNumber, item.sku]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function close(event) {
      if (menuRef.current && !menuRef.current.contains(event.target))
        setMenuOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const tabs = [
    { key: 'details', label: 'Details' },
    { key: 'shopify', label: 'Shopify listing', locked: !tier2Enabled },
    { key: 'social', label: 'Social post', locked: !tier2Enabled },
  ];

  const headerActions = (
    <div className="consignment-item-actions">
      {tier2Enabled && (
        <ItemBarcode
          compact
          value={item.itemNumber}
          description={item.description || item.type || 'Consignment item'}
          price={item.price}
          currency={currency}
        />
      )}
      <div className="consignment-item-menu" ref={menuRef}>
        <button
          type="button"
          className="consignment-btn secondary consignment-item-menu-button"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <MoreHorizontal size={20} strokeWidth={3} />
        </button>
        {menuOpen && (
          <div className="consignment-item-menu-popover" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setTab('details');
                setEditing(true);
                setConfirmingDelete(false);
              }}
            >
              <Pencil size={16} /> Edit details
            </button>
            <hr />
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => {
                setMenuOpen(false);
                setTab('details');
                setConfirmingDelete(true);
              }}
            >
              <Trash2 size={16} /> Delete item
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="consignment-item-page">
      <Header
        eyebrow={`Item ${item.itemNumber}`}
        title={title}
        onBack={onBack}
        action={headerActions}
        leading={
          photo ? (
            <span className="consignment-item-photo">
              <img src={photo} alt="" />
            </span>
          ) : null
        }
        meta={
          <>
            <strong className="consignment-item-price">
              {money(item.price)}
            </strong>
            <span
              className={`consignment-badge ${item.paidOut ? 'paid' : statusClass(item.status)}`}
            >
              {item.paidOut ? 'Paid' : statusLabel(item.status)}
            </span>
            <span className={`consignment-product-badge ${channel.className}`}>
              {channel.text}
            </span>
            {tier2Enabled && item.shopifyProductId && shopifyStatus && (
              <span
                className={`consignment-badge ${shopifyStatus === 'ACTIVE' ? 'active' : 'returned'}`}
              >
                Shopify: {shopifyStatus === 'ACTIVE' ? 'Active' : 'Draft'}
              </span>
            )}
            {consignor && (
              <span className="consignment-item-consignor">
                {consignor.firstName} {consignor.lastName} · {commissionPct}%
              </span>
            )}
          </>
        }
      />

      <div
        className="consignment-item-tabs"
        role="tablist"
        aria-label="Item sections"
      >
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            className={tab === entry.key ? 'active' : ''}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
            {entry.locked && <Lock size={13} aria-label="Growth plan" />}
          </button>
        ))}
      </div>

      <div className="consignment-body">
        {/* ---------------- DETAILS ---------------- */}
        <div
          role="tabpanel"
          hidden={tab !== 'details'}
          className="consignment-item-panel"
        >
          {confirmingDelete && (
            <div className="consignment-card consignment-item-delete-confirm">
              <span>
                Delete {item.itemNumber} and its linked Shopify product?
              </span>
              <div>
                <button
                  className="consignment-btn secondary"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </button>
                <button
                  className="consignment-btn danger"
                  onClick={() => onDelete(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Items linked to a Shopify product sell through Shopify, so they
              have no manual sale box. Manual items (every Starter item, and
              Growth items not linked to Shopify) record sales here. */}
          {(isSold || allowManualSale) && (
            <ManualSaleStatus
              item={item}
              allowManualSale={allowManualSale}
              onMarkSold={(itemId, details) =>
                onUpdateStatus(itemId, 'Sold', details)
              }
              money={money}
              onStartPayout={onStartPayout}
              onOpenPayoutReceipt={onOpenPayoutReceipt}
            />
          )}

          <div className="consignment-item-details-grid">
            <section className="consignment-card consignment-item-card">
              {editing ? (
                <>
                  <div className="consignment-item-card-head">
                    <h2>Edit details</h2>
                    <button
                      type="button"
                      className="consignment-btn secondary"
                      onClick={() => setEditing(false)}
                    >
                      Done
                    </button>
                  </div>
                  {isSold && (
                    <p className="consignment-form-help">
                      This item is sold, so its details are locked.
                    </p>
                  )}
                  <fieldset
                    disabled={isSold}
                    className="consignment-item-edit-fieldset"
                    style={{ opacity: isSold ? 0.45 : 1 }}
                  >
                    <ManualItemCore
                      form={form}
                      setForm={setForm}
                      onSave={() => onSave(item.id, form)}
                      saveDisabled={!canSave || isSold}
                      saveLabel="Save manual changes"
                      showItemNumber
                      helperText="Updates only the consignment item. Shopify product details are on the Shopify listing tab."
                    />
                  </fieldset>
                </>
              ) : (
                <dl className="consignment-item-facts">
                  <div>
                    <dt>Consignor</dt>
                    <dd>
                      {consignor
                        ? `${consignor.firstName} ${consignor.lastName} #${consignor.number}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Consignor gets</dt>
                    <dd>{commissionPct}%</dd>
                  </div>
                  <div>
                    <dt>Received</dt>
                    <dd>{formatDate(item.dateReceived)}</dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>
                      {item.expiryDate
                        ? formatDate(item.expiryDate)
                        : 'No term'}
                    </dd>
                  </div>
                  <div>
                    <dt>Description</dt>
                    <dd>{item.description || '—'}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{item.category || '—'}</dd>
                  </div>
                  <div>
                    <dt>Brand</dt>
                    <dd>{item.brand || '—'}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{item.size || '—'}</dd>
                  </div>
                  <div>
                    <dt>Condition</dt>
                    <dd>{item.condition || '—'}</dd>
                  </div>
                  <div>
                    <dt>Sells on</dt>
                    <dd>{channel.text}</dd>
                  </div>
                  {item.notes && (
                    <div className="wide">
                      <dt>Notes</dt>
                      <dd>{item.notes}</dd>
                    </div>
                  )}
                </dl>
              )}
            </section>

            <aside className="consignment-card consignment-item-card consignment-item-money">
              <h2>Money</h2>
              <dl>
                <div>
                  <dt>Price</dt>
                  <dd>{money(price)}</dd>
                </div>
                <div>
                  <dt>Consignor gets</dt>
                  <dd>{money(consignorShare)}</dd>
                </div>
                <div>
                  <dt>Store keeps</dt>
                  <dd>{money(price - consignorShare)}</dd>
                </div>
                <div>
                  <dt>Payout</dt>
                  <dd>
                    <span
                      className={`consignment-badge ${item.paidOut ? 'paid' : isSold ? 'unpaid' : 'returned'}`}
                    >
                      {item.paidOut ? 'Paid' : isSold ? 'Owed' : 'Not sold yet'}
                    </span>
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>

        {/* ---------------- SHOPIFY LISTING ---------------- */}
        <div
          role="tabpanel"
          hidden={tab !== 'shopify'}
          className="consignment-item-panel"
        >
          {tier2Enabled ? (
            <ShopifyProductSection
              embedded
              shopifyForm={shopifyForm}
              setShopifyForm={setShopifyForm}
              linkedProductId={item.shopifyProductId}
              linkedStatus={item.shopifyProductStatus}
              disabled={isSold}
              syncing={syncing}
              tier2Enabled={tier2Enabled}
              onSync={async () => {
                setSyncing(true);
                try {
                  await onSyncProduct(item.id, shopifyForm);
                } finally {
                  setSyncing(false);
                }
              }}
            />
          ) : (
            <LockedTab title="Shopify product" />
          )}
        </div>

        {/* ---------------- SOCIAL POST ---------------- */}
        <div
          role="tabpanel"
          hidden={tab !== 'social'}
          className="consignment-item-panel"
        >
          {tier2Enabled ? (
            <SocialPostPanel
              embedded
              item={{
                ...item,
                shopifyPhoto:
                  shopifyForm.media?.[0]?.url ||
                  shopifyForm.photo ||
                  item.shopifyPhoto ||
                  item.photo,
                shopifyMedia:
                  Array.isArray(shopifyForm.media) && shopifyForm.media.length
                    ? shopifyForm.media
                    : item.shopifyMedia || [],
              }}
              disabled={isSold}
            />
          ) : (
            <LockedTab title="Social post" />
          )}
        </div>
      </div>
    </div>
  );
}
