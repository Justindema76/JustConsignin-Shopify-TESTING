/* eslint-disable react/prop-types */

import { useEffect, useState } from 'react';
import { Check, Loader2, PackageSearch, Search } from 'lucide-react';

import Header from '../../components/consignment/Header';
import MetaProductPostPanel from '../../components/social/MetaProductPostPanel';
import { searchShopifyProducts } from '../../consignmentApi';

export default function ExistingProductMetaPostScreen({ onBack }) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const results = await searchShopifyProducts(query);
        if (!cancelled) setProducts(results);
      } catch (value) {
        if (!cancelled) setError(value instanceof Error ? value.message : 'Could not load Shopify products.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query.trim() ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const metaItem = selected ? {
    id: selected.id,
    shopifyProductId: selected.id,
    description: selected.title,
    shopifyTitle: selected.title,
    shopifyPrice: selected.price,
    vendor: selected.vendor,
    productDescription: selected.description,
    tags: selected.tags,
    photo: selected.photo,
    shopifyPhoto: selected.photo,
    shopifyMedia: selected.media || [],
  } : null;

  return (
    <>
      <Header eyebrow="Meta product posting" title="Post Existing Shopify Product" onBack={onBack} />
      <div className="consignment-body">
        <div className="consignment-form-shell">
          <section className="consignment-form-section">
            <div className="consignment-form-section-body">
              <label className="consignment-label" htmlFor="existing-shopify-product-search">
                Select an existing Shopify product
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={17} style={{ position: 'absolute', left: 12, top: 13 }} />
                <input
                  id="existing-shopify-product-search"
                  className="consignment-input"
                  style={{ paddingLeft: 38 }}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products by title"
                />
              </div>

              {loading && <div className="social-post-state"><Loader2 className="consignment-spin" size={18} /> Loading Shopify products…</div>}
              {error && <div className="social-post-message error">{error}</div>}

              {!loading && !error && (
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  {products.map((product) => {
                    const active = selected?.id === product.id;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className={`social-post-channel ${active ? 'selected' : ''}`}
                        onClick={() => setSelected(product)}
                        style={{ width: '100%', textAlign: 'left' }}
                      >
                        {product.photo
                          ? <img src={product.photo} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                          : <PackageSearch size={20} />}
                        <span style={{ flex: 1 }}>
                          <strong>{product.title}</strong>
                          <small>{product.status}{product.price ? ` · $${product.price}` : ''}</small>
                        </span>
                        {active && <Check size={17} />}
                      </button>
                    );
                  })}
                  {!products.length && <p className="consignment-form-help">No Shopify products found.</p>}
                </div>
              )}
            </div>
          </section>

          {metaItem && <MetaProductPostPanel key={metaItem.shopifyProductId} item={metaItem} />}
        </div>
      </div>
    </>
  );
}
