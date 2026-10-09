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

export function buildShopifyAutoFill(item = {}, consignor = null) {
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
    tags: [
      ...new Set(
        [
          'Consignment',
          consignor?.number ? `Consignor ${consignor.number}` : '',
          category,
          type,
          brand,
          condition,
        ].filter(Boolean),
      ),
    ].join(', '),
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
