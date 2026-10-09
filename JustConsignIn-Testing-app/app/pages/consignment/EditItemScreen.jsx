/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import Header from '../../components/consignment/Header';
import ItemBarcode from '../../components/consignment/ItemBarcode';
import {
  ManualItemCore,
  ShopifyProductSection,
} from '../../components/consignment/ManualItemCore';
import ManualSaleStatus from '../../components/consignment/ManualSaleStatus';
import SocialPostPanel from '../../components/social/SocialPostPanel';
import { money } from '../../lib/consignmentHelpers';

export default function EditItemScreen({
  item,
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const isSold = item.status === 'Sold' || Boolean(item.dateSold);
  const canSave = form.description.trim() && form.price !== '';

  return (
    <>
      <Header
        eyebrow={`Item ${item.itemNumber}`}
        title="Item details"
        onBack={onBack}
      />

      <div className="consignment-body">
        <div className="consignment-form-shell">
          {tier2Enabled && (
            <ItemBarcode
              value={item.itemNumber}
              description={item.description || item.type || 'Consignment item'}
              priceLabel={money(item.price)}
            />
          )}

          <ManualSaleStatus
            item={item}
            allowManualSale={!tier2Enabled}
            onMarkSold={(itemId, details) =>
              onUpdateStatus(itemId, 'Sold', details)
            }
            money={money}
            onStartPayout={onStartPayout}
            onOpenPayoutReceipt={onOpenPayoutReceipt}
          />

          <details className="consignment-form-section">
            <summary className="consignment-form-section-head">
              <span className="consignment-form-section-marker" />
              <div>
                <h2>Product information</h2>
                <p>Item {item.itemNumber}</p>
              </div>
            </summary>

            <div className="consignment-form-section-body">
              <fieldset
                disabled={isSold}
                style={{
                  minWidth: 0,
                  margin: 0,
                  padding: 0,
                  border: 0,
                  opacity: isSold ? 0.45 : 1,
                }}
              >
                <ManualItemCore
                  form={form}
                  setForm={setForm}
                  onSave={() => onSave(item.id, form)}
                  saveDisabled={!canSave || isSold}
                  saveLabel="Save manual changes"
                  helperText="Updates only the consignment item metaobject. Shopify product data and media are handled separately below."
                />
              </fieldset>
            </div>
          </details>

          <ShopifyProductSection
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

          <SocialPostPanel
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

          {!confirmingDelete ? (
            <button
              className="consignment-btn secondary"
              style={{
                color: 'var(--danger)',
                borderColor: 'var(--danger-soft)',
              }}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 size={16} />
              Delete item
            </button>
          ) : (
            <div
              className="consignment-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13 }}>
                Delete {item.itemNumber} and its linked Shopify product?
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="consignment-btn secondary"
                  style={{ padding: '8px 14px' }}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </button>
                <button
                  className="consignment-btn danger"
                  style={{ padding: '8px 14px' }}
                  onClick={() => onDelete(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
