import { useEffect, useState } from 'react';
import { getConsignmentData } from './consignmentApi';

function getProductLabel(item) {
  if (!item?.shopifyProductId) return { text: 'Manual', className: 'manual' };

  const productStatus = String(item.shopifyProductStatus || item.productStatus || '').toUpperCase();
  if (productStatus && productStatus !== 'ACTIVE') {
    return { text: 'Shopify Draft', className: 'draft' };
  }

  const online = Boolean(
    item.publishOnline ||
    item.onlineStorePublished ||
    item.salesChannel === 'online' ||
    item.salesChannel === 'pos_online'
  );

  return online
    ? { text: 'POS + Online', className: 'online' }
    : { text: 'POS', className: 'pos' };
}

function findItemNumber(row) {
  const match = String(row.textContent || '').match(/\b\d+-\d{3}\b/);
  return match?.[0] || '';
}

export default function TierOneProductLabels({ children }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadItems() {
      try {
        const data = await getConsignmentData();
        if (active) setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (active) setItems([]);
      }
    }

    loadItems();
    const timer = window.setInterval(loadItems, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function applyLabels() {
      const rows = [...document.querySelectorAll('.cm-list-row')];
      if (!rows.length) return;

      const header = rows.find((row) => /\bITEM\b/i.test(row.textContent || '') && /\bSTATUS\b/i.test(row.textContent || ''));
      if (!header) return;

      header.querySelectorAll('.tier1-product-heading').forEach((node) => node.remove());
      const heading = document.createElement('span');
      heading.className = 'tier1-product-heading';
      heading.textContent = 'Product';
      header.insertBefore(heading, header.lastElementChild);

      rows.filter((row) => row !== header).forEach((row) => {
        row.querySelectorAll('.tier1-product-label, .tier1-product-channel').forEach((node) => node.remove());

        const itemNumber = findItemNumber(row);
        if (!itemNumber) return;

        const item = items.find((entry) => String(entry.itemNumber || '').trim() === itemNumber);
        if (!item) return;

        const product = getProductLabel(item);
        const label = document.createElement('span');
        label.className = `tier1-product-label ${product.className}`;
        label.textContent = product.text;
        row.insertBefore(label, row.lastElementChild);
      });
    }

    applyLabels();
    const observer = new MutationObserver(applyLabels);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [items]);

  return (
    <>
      <style>{`
        .cm-list-row {
          grid-template-columns: minmax(220px, 2fr) minmax(150px, 1fr) 105px 110px 125px 105px !important;
        }
        .tier1-product-heading {
          color: inherit;
          font: inherit;
        }
        .tier1-product-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          justify-self: start;
          min-width: 82px;
          width: fit-content;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .tier1-product-label.manual { background: #F1F2F3; color: #5C5F62; }
        .tier1-product-label.draft { background: #FFF4D6; color: #8A5D14; }
        .tier1-product-label.pos { background: #E4EEF9; color: #143F73; }
        .tier1-product-label.online { background: #DFF5E7; color: #17663A; }

        @media (max-width: 900px) {
          .cm-list-row {
            grid-template-columns: minmax(180px, 2fr) minmax(120px, 1fr) 90px 115px 100px !important;
          }
          .cm-list-row > :nth-child(4) { display: none; }
        }

        @media (max-width: 640px) {
          .cm-list-row {
            grid-template-columns: minmax(0, 1fr) auto !important;
          }
          .cm-list-row > :not(.cm-item-primary):not(.tier1-product-label):last-child {
            display: none;
          }
          .tier1-product-label { justify-self: end; }
        }
      `}</style>
      {children}
    </>
  );
}
