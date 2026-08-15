export const CATEGORIES = [
  'Clothing', 'Shoes', 'Jewellery', 'Handbags', 'Home Décor', 'Furniture',
  'Electronics', 'Appliances', 'Books', 'Movies & Music', 'Video Games',
  'Collectibles', 'Sporting Goods', 'Tools', 'Toys', 'Baby Gear',
  'Pet Supplies', 'Outdoor & Garden', 'Art', 'Automotive', 'Other',
];

export const CONDITIONS = ['New with tags', 'Like new', 'Good', 'Fair'];

export const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export function productLabel(item) {
  if (!item?.shopifyProductId) return { text: 'Manual', className: 'manual' };

  const productStatus = String(item.shopifyProductStatus || '').toUpperCase();
  if (productStatus && productStatus !== 'ACTIVE') {
    return { text: 'Shopify Draft', className: 'draft' };
  }

  return item.publishOnline
    ? { text: 'POS + Online', className: 'online' }
    : { text: 'POS', className: 'pos' };
}

export function saleSourceLabel(item) {
  if (!(item?.status === 'Sold' || item?.dateSold)) return null;

  const source = String(item.saleSource || '').trim().toLowerCase();
  if (source === 'pos' || source.includes('point of sale')) {
    return { text: 'Sold via POS', className: 'pos' };
  }
  if (source === 'online' || source === 'web' || source.includes('online')) {
    return { text: 'Sold Online', className: 'online' };
  }
  if (source === 'manual') {
    return { text: 'Manual Sale', className: 'manual' };
  }

  // Older sales recorded before sale-source tracking:
  // no Shopify order means it was marked sold manually in JustConsignIn.
  if (!item.orderId && !item.orderName) {
    return { text: 'Manual Sale', className: 'manual' };
  }

  return { text: 'Shopify Sale', className: 'draft' };
}

export function statusClass(status) {
  return String(status || 'Draft').toLowerCase();
}

// Display-only relabel: the stored status value stays "Draft" (so existing
// data and filters keep working) but manual items show "Available" instead.
export function statusLabel(status) {
  const value = status || 'Draft';
  return value === 'Draft' ? 'Available' : value;
}

export function productAdminUrl(productId) {
  const numericId = String(productId || '').split('/').pop();
  return `shopify://admin/products/${numericId}`;
}

export function resizeImage(file, maxWidth = 320, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result !== 'string') {
        reject(new Error('Could not read this image'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function handlePhotoFile(e, onChange) {
  const file = e.target.files?.[0];
  if (!file) return;
  const dataUrl = await resizeImage(file);
  onChange(dataUrl);
}

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim()); field = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('The CSV needs a header row and at least one data row.');
  const headers = rows[0].map((value) => value.toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

export function csvValue(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function downloadCsv(fileName, headers, rows) {
  const csv = [headers, ...rows]
    .map((row) => row.map(csvValue).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportConsignors(consignors) {
  const headers = ['number', 'first_name', 'last_name', 'phone', 'email', 'address', 'city', 'province', 'postal_code', 'date_joined', 'commission_pct', 'unsold_preference', 'notes'];
  const rows = consignors.map((c) => [
    c.number, c.firstName, c.lastName, c.phone, c.email, c.address, c.city,
    c.province, c.postalCode, c.dateJoined, c.commissionPct, c.unsoldPreference, c.notes,
  ]);
  downloadCsv(`consignors-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

export function exportItems(items, consignors) {
  const consignorById = Object.fromEntries(consignors.map((c) => [c.id, c]));
  const headers = [
    'item_number', 'consignor_number', 'description', 'price', 'category', 'type',
    'size', 'condition', 'status', 'date_received', 'commission_pct', 'notes',
    'tags', 'brand', 'vendor', 'product_description', 'sale_price', 'date_sold',
    'order_name', 'order_id', 'paid_out', 'payout_id', 'payout_date',
    'payout_method', 'payout_reference', 'payout_note', 'payout_amount',
    'payout_total', 'payout_adjustment', 'shopify_product_id',
  ];
  const rows = items.map((item) => [
    item.itemNumber, consignorById[item.consignorId]?.number || '', item.description,
    item.price, item.category, item.type, item.size, item.condition, item.status,
    item.dateReceived, item.commissionPct, item.notes,
    Array.isArray(item.tags) ? item.tags.join('|') : item.tags || '',
    item.brand, item.vendor, item.productDescription, item.salePrice, item.dateSold,
    item.orderName, item.orderId, item.paidOut ? 'true' : 'false', item.payoutId,
    item.payoutDate, item.payoutMethod, item.payoutReference, item.payoutNote,
    item.payoutAmount, item.payoutTotal, item.payoutAdjustment, item.shopifyProductId,
  ]);
  downloadCsv(`items-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}
