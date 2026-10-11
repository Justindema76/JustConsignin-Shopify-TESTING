export const CATEGORIES = [
  'Clothing',
  'Shoes',
  'Jewellery',
  'Handbags & Accessories',
  'Baby & Kids',
  'Toys & Games',
  'Bicycles & Cycling',
  'Sporting Goods',
  'Outdoor & Camping',
  'Home Decor',
  'Furniture',
  'Kitchen & Housewares',
  'Electronics',
  'Appliances',
  'Books & Media',
  'Video Games',
  'Collectibles',
  'Tools',
  'Automotive',
  'Pet Supplies',
  'Art',
  'Other',
];

export const CONDITIONS = ['New with tags', 'Like new', 'Good', 'Fair'];

export function buildShopifyAutoFill(item = {}) {
  const description = String(item.description || '').trim();
  const brand = String(item.brand || '').trim();
  const size = String(item.size || '').trim();
  const condition = String(item.condition || '').trim();
  const category = String(item.category || '').trim();
  const type = String(item.type || '').trim();

  return {
    shopifyTitle: description,
    shopifyPrice: item.price ?? '',
    vendor: brand,
    // Only the tag the Consignment collection needs. Brand, type, condition
    // and consignor already live in their own fields, and a tag per value
    // floods the store's tag list.
    tags: 'Consignment',
    productDescription: [
      description,
      brand ? `Brand: ${brand}` : '',
      size ? `Size: ${size}` : '',
      condition ? `Condition: ${condition}` : '',
      category ? `Category: ${category}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    productType: type || category,
    seoTitle: '',
    seoDescription: '',
  };
}
