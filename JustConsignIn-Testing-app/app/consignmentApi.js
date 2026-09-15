const API_URL = '/api/consignment';
const IMAGE_API_URL = '/api/consignment-image';

async function request(method = 'GET', body) {
  const response = await fetch(API_URL, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Shopify request failed (${response.status})`);
  }

  return payload;
}

export function getConsignmentData() {
  return request();
}

export async function searchShopifyCategories(search) {
  const response = await fetch(`${API_URL}?taxonomy=${encodeURIComponent(search.trim())}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Could not search Shopify categories (${response.status})`);
  }
  return payload.categories || [];
}

export async function searchShopifyFiles(search) {
  const query = search ? `&filesQuery=${encodeURIComponent(search.trim())}` : '';
  const response = await fetch(`${API_URL}?files=1${query}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Could not load Shopify files (${response.status})`);
  }
  return payload.files || [];
}

export function createConsignor(consignor) {
  return request('POST', { operation: 'createConsignor', consignor });
}

export function updateConsignor(consignorId, consignor) {
  return request('PATCH', { operation: 'updateConsignor', consignorId, consignor });
}

export function deleteConsignor(consignorId) {
  return request('DELETE', { operation: 'deleteConsignor', consignorId });
}

function dataUrlToImageBlob(dataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!match) {
    throw new Error('The selected photo could not be prepared. Please take the photo again.');
  }

  const mimeType = match[1].toLowerCase();
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

async function uploadImage(dataUrl, alt) {
  if (!dataUrl?.startsWith('data:image/')) return null;

  const imageBlob = dataUrlToImageBlob(dataUrl);
  const formData = new FormData();
  const extension = imageBlob.type === 'image/png' ? 'png' : 'jpg';
  formData.append('image', imageBlob, `consignment-${Date.now()}.${extension}`);
  formData.append('alt', alt || 'Consignment item');

  const response = await fetch(IMAGE_API_URL, {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Image upload failed (${response.status})`);
  }
  return payload;
}

async function prepareItemPhoto(item) {
  const uploaded = await uploadImage(item.photo, item.description);
  if (!uploaded) return item;
  return {
    ...item,
    photoId: uploaded.id,
    photo: uploaded.url || item.photo,
  };
}


export function createConsignmentItems(consignorId, items) {
  const manualItems = items.map((item) => ({
    category: item.category,
    type: '',
    description: item.description,
    size: item.size,
    condition: item.condition,
    price: item.price,
    brand: item.brand,
    notes: item.notes,
    consignmentTerm: item.consignmentTerm,
  }));
  return request('POST', { operation: 'createItems', consignorId, items: manualItems });
}

export function updateConsignmentItem(itemId, item) {
  return request('PATCH', {
    operation: 'updateItem',
    itemId,
    item: {
      category: item.category,
      type: '',
      description: item.description,
      size: item.size,
      condition: item.condition,
      price: item.price,
      brand: item.brand,
      notes: item.notes,
      consignmentTerm: item.consignmentTerm,
    },
  });
}

export function deleteConsignmentItem(itemId) {
  return request('DELETE', { operation: 'deleteItem', itemId });
}

export async function syncShopifyProduct(itemId, product) {
  const preparedProduct = await prepareItemPhoto(product);
  return request('POST', { operation: 'syncProduct', itemId, product: preparedProduct });
}

export function updateConsignmentItemStatus(itemId, status, details = {}) {
  return request('POST', { operation: 'updateItemStatus', itemId, status, ...details });
}

export function recordConsignorPayout(payout) {
  return request('POST', { operation: 'recordPayout', ...payout });
}

export function importConsignmentData(kind, rows) {
  return request('POST', { operation: 'importData', kind, rows });
}
