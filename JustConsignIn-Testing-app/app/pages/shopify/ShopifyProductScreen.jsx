/* eslint-disable react/prop-types */
import { useState } from 'react';
import Header from '../../components/consignment/Header';
import ShopifyProductPanel from '../../components/consignment/ShopifyProductPanel';
import SocialPostPanel from '../../components/social/SocialPostPanel';
import MetaProductPostPanel from '../../components/social/MetaProductPostPanel';
import { createShopifyProduct } from '../../consignmentApi';

const EMPTY_PRODUCT = {
  photo: null,
  photoId: null,
  media: [],
  productType: '',
  collections: [],
  shopifyTitle: '',
  shopifyPrice: '',
  tags: '',
  vendor: '',
  productDescription: '',
  shopifyCategoryId: '',
  shopifyCategoryName: '',
  sku: '',
  weight: '',
  weightUnit: 'KILOGRAMS',
  shopifyHandle: '',
  seoTitle: '',
  seoDescription: '',
  publishToPos: true,
  publishOnline: false,
  publishMeta: false,
};

export default function ShopifyProductScreen({
  onBack,
  onCreated,
  tier2Enabled = false,
}) {
  const [shopifyForm, setShopifyForm] = useState(EMPTY_PRODUCT);
  const [syncing, setSyncing] = useState(false);
  const [linkedProduct, setLinkedProduct] = useState(null);
  const [error, setError] = useState('');

  async function createProduct() {
    setSyncing(true);
    setError('');
    try {
      const product = await createShopifyProduct(shopifyForm);
      setLinkedProduct(product);
      onCreated?.(product);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not create the Shopify product');
      throw value;
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <Header
        eyebrow="Direct to Shopify"
        title="Add Shopify Product"
        onBack={onBack}
      />

      <div className="consignment-body">
        <div className="consignment-form-shell">
          {error && (
            <div className="consignment-card" style={{ color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <ShopifyProductPanel
            shopifyForm={shopifyForm}
            setShopifyForm={setShopifyForm}
            linkedProductId={linkedProduct?.id || ''}
            linkedStatus={linkedProduct?.status || ''}
            tier2Enabled={tier2Enabled}
            syncing={syncing}
            onSync={linkedProduct ? null : createProduct}
            direct
          />

          <SocialPostPanel
            item={{
              id: linkedProduct?.id || 'new-shopify-product',
              shopifyProductId: linkedProduct?.id || '',
              description: shopifyForm.shopifyTitle,
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

          <MetaProductPostPanel
            item={{
              shopifyProductId: linkedProduct?.id || '',
              description: shopifyForm.shopifyTitle,
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
