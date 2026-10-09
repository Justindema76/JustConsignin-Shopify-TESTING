/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useState, useEffect } from 'react';
import Header from '../../components/consignment/Header';
import { ManualItemCore } from '../../components/consignment/ManualItemCore';
import ShopifyProductPanel from '../../components/consignment/ShopifyProductPanel';
import SocialPostPanel from '../../components/social/SocialPostPanel';
import { buildShopifyAutoFill } from '../../lib/itemFields';

export default function IntakeScreen({
  consignor,
  items,
  onBack,
  onSaveBatch,
  onSaveAndSync,
  tier2Enabled = false,
}) {
  const emptyForm = {
    category: 'Clothing',
    type: '',
    description: '',
    size: '',
    condition: 'Good',
    price: '',
    brand: '',
    notes: '',
    consignmentTerm: '',
  };

  const emptyShopifyForm = {
    sku: undefined,
    weight: '',
    weightUnit: 'KILOGRAMS',
    shopifyHandle: '',
    photo: null,
    photoId: null,
    media: [],
    productType: '',
    collections: ['Consignment'],
    shopifyTitle: '',
    shopifyPrice: '',
    tags: '',
    vendor: '',
    productDescription: '',
    shopifyCategoryId: '',
    shopifyCategoryName: '',
    seoTitle: '',
    seoDescription: '',
    publishToPos: true,
    publishOnline: false,
    publishMeta: false,
  };

  const [form, setForm] = useState(emptyForm);
  const [shopifyForm, setShopifyForm] = useState(emptyShopifyForm);
  const [syncing, setSyncing] = useState(false);

  const canSave = Boolean(form.description.trim() && form.price !== '');

  const savedSequence = items
    .filter(
      (item) =>
        item.consignorId === consignor.id &&
        item.itemNumber.startsWith(`${consignor.number}-`),
    )
    .reduce(
      (maximum, item) =>
        Math.max(maximum, Number(item.itemNumber.split('-').pop()) || 0),
      0,
    );

  const nextItemNumber = `${consignor.number}-${String(savedSequence + 1).padStart(3, '0')}`;

  useEffect(() => {
    const auto = buildShopifyAutoFill(form, consignor);

    setShopifyForm((current) => ({
      ...current,
      ...auto,
      sku: current.sku ?? nextItemNumber,
      seoTitle: current.seoTitle || auto.seoTitle,
      seoDescription: current.seoDescription || auto.seoDescription,
      shopifyCategoryId: current.shopifyCategoryId,
      shopifyCategoryName: current.shopifyCategoryName,
      photo: current.photo,
      photoId: current.photoId,
      media: current.media || [],
      productType: current.productType || auto.productType,
      collections: current.collections,
      publishToPos: current.publishToPos,
      publishOnline: current.publishOnline,
    }));
  }, [
    form.description,
    form.price,
    form.brand,
    form.size,
    form.condition,
    form.category,
    form.type,
    consignor.number,
    nextItemNumber,
  ]);

  async function saveShopifyProduct() {
    setSyncing(true);

    try {
      /*
       * Shopify saving still receives an empty batch.
       * It saves this manual item first and then creates
       * the linked Shopify product.
       */
      await onSaveAndSync(form, [], shopifyForm);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <Header
        eyebrow={`For ${consignor.firstName} ${consignor.lastName} · #${consignor.number}`}
        title="Add item"
        onBack={onBack}
      />

      <div className="consignment-body">
        <div className="consignment-form-shell">
          <section className="consignment-form-section">
            <div className="consignment-form-section-head">
              <span
                className="consignment-form-section-marker"
                aria-hidden="true"
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <h2>Manual consignment item</h2>

                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--green-dark)',
                  }}
                >
                  Item {nextItemNumber}
                </span>
              </div>
            </div>

            <div className="consignment-form-section-body">
              <ManualItemCore
                form={form}
                setForm={setForm}
                onSave={() => onSaveBatch([form])}
                saveDisabled={!canSave}
                saveLabel="Save manual item"
              />

              {/*
                ADD ANOTHER MANUAL ITEM IS INTENTIONALLY HIDDEN.

                Do not comment out IntakeScreen.
                If the button is needed again, put the button here.
              */}
            </div>
          </section>

          <ShopifyProductPanel
            shopifyForm={shopifyForm}
            setShopifyForm={setShopifyForm}
            tier2Enabled={tier2Enabled}
            syncing={syncing}
            onSync={canSave ? saveShopifyProduct : null}
          />

          <SocialPostPanel
            item={{
              id: `new-${nextItemNumber}`,
              description: form.description,
              brand: form.brand,
              size: form.size,
              condition: form.condition,
              price: form.price,
              shopifyTitle: shopifyForm.shopifyTitle,
              shopifyPrice: shopifyForm.shopifyPrice,
              vendor: shopifyForm.vendor,
              productDescription: shopifyForm.productDescription,
              tags: shopifyForm.tags,
              photo: shopifyForm.media?.[0]?.url || shopifyForm.photo,
              shopifyPhoto: shopifyForm.media?.[0]?.url || shopifyForm.photo,
              shopifyMedia: shopifyForm.media || [],
            }}
          />
        </div>
      </div>
    </>
  );
}
