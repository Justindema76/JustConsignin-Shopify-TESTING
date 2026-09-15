/* eslint-disable react/prop-types */
import { useState } from 'react';
import { Grid3X3, List, Plus, Users } from 'lucide-react';

import Header from '../../components/consignment/Header';
import AllConsignorView from '../../components/consignment/AllConsignorView';
import AllListView from '../../components/consignment/AllListView';
import ItemGridCardContainer from '../../components/consignment/ItemGridCardContainer';
import ConsignmentFilterBar from '../../components/consignment/ConsignmentFilterBar';
import {
  EXPIRY_FILTERS,
  isSold,
  matchesExpiryFilter,
  productLabel,
  statusLabel,
} from '../../lib/consignmentHelpers';

const EXPIRY_OPTIONS = [
  { value: EXPIRY_FILTERS.ALL, label: 'All expiry dates' },
  { value: EXPIRY_FILTERS.NEXT_7, label: 'Next 7 days' },
  { value: EXPIRY_FILTERS.NEXT_30, label: 'Next 30 days' },
  { value: EXPIRY_FILTERS.EXPIRED, label: 'Expired' },
  { value: EXPIRY_FILTERS.NONE, label: 'No expiry date' },
];

function initialExpiryFilter() {
  if (typeof window === 'undefined') return EXPIRY_FILTERS.ALL;

  const state = window.history.state || {};
  const requested = state.consignmentPageFilters?.expiry;
  const validValues = new Set(Object.values(EXPIRY_FILTERS));
  const initial = validValues.has(requested) ? requested : EXPIRY_FILTERS.ALL;

  if (state.consignmentPageFilters) {
    const nextState = { ...state };
    delete nextState.consignmentPageFilters;
    window.history.replaceState(nextState, '');
  }

  return initial;
}

export default function ItemsScreen({
  items,
  consignors,
  onOpenItem,
  onOpenConsignor,
  onMarkSold,
  onStartPayout,
  onNewItem,
  tier2Enabled = false,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Available');
  const [consignorFilter, setConsignorFilter] = useState('All');
  const [productFilter, setProductFilter] = useState(() => tier2Enabled ? 'All' : 'Manual');
  const [expiryFilter, setExpiryFilter] = useState(initialExpiryFilter);
  const [sort, setSort] = useState('consignor');
  const [viewMode, setViewMode] = useState('list');

  const statuses = [
    { value: 'Available', label: 'Available' },
    { value: 'SoldUnpaid', label: 'Sold / Unpaid' },
    { value: 'PaidArchived', label: 'Paid / Archived' },
    { value: 'Returned', label: 'Returned' },
    { value: 'Donated', label: 'Donated' },
  ];

  const statusCount = (statusValue) => {
    if (statusValue === 'PaidArchived') return items.filter((item) => item.paidOut).length;
    if (statusValue === 'Available') {
      return items.filter((item) => !item.paidOut && !isSold(item) && ['Draft', 'Available', 'Active'].includes(item.status)).length;
    }
    if (statusValue === 'SoldUnpaid') return items.filter((item) => !item.paidOut && isSold(item)).length;
    return items.filter((item) => item.status === statusValue && !item.paidOut).length;
  };

  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));

  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    const consignor = consignorById[item.consignorId];
    const matchesQuery = !q || `${item.description} ${item.itemNumber} ${item.type} ${item.brand || ''} ${consignor?.firstName || ''} ${consignor?.lastName || ''} ${consignor?.number || ''}`.toLowerCase().includes(q);
    const matchesConsignor = consignorFilter === 'All' || item.consignorId === consignorFilter;
    const product = productLabel(item);
    const matchesProduct = productFilter === 'All'
      || (productFilter === 'Manual' && product.className === 'manual')
      || (productFilter === 'POS' && product.text === 'POS')
      || (productFilter === 'Online' && product.text === 'Online')
      || (productFilter === 'POS + Online' && product.text === 'POS + Online');
    const matchesStatus = filter === 'PaidArchived'
      ? item.paidOut
      : filter === 'Available'
        ? !item.paidOut && !isSold(item) && ['Draft', 'Available', 'Active'].includes(item.status)
        : filter === 'SoldUnpaid'
          ? !item.paidOut && isSold(item)
          : item.status === filter && !item.paidOut;
    const matchesExpiry = matchesExpiryFilter(item, expiryFilter);
    return matchesQuery && matchesConsignor && matchesProduct && matchesStatus && matchesExpiry;
  }).sort((a, b) => {
    if (sort === 'oldest') return String(a.dateReceived || '').localeCompare(String(b.dateReceived || ''));
    if (sort === 'consignor') {
      const aName = `${consignorById[a.consignorId]?.lastName || ''} ${consignorById[a.consignorId]?.firstName || ''}`;
      const bName = `${consignorById[b.consignorId]?.lastName || ''} ${consignorById[b.consignorId]?.firstName || ''}`;
      return aName.localeCompare(bName) || String(a.itemNumber || '').localeCompare(String(b.itemNumber || ''), undefined, { numeric: true });
    }
    if (sort === 'ticket') return String(a.itemNumber || '').localeCompare(String(b.itemNumber || ''), undefined, { numeric: true });
    if (sort === 'priceHigh') return Number(b.price || 0) - Number(a.price || 0);
    if (sort === 'priceLow') return Number(a.price || 0) - Number(b.price || 0);
    return String(b.dateReceived || '').localeCompare(String(a.dateReceived || '')) || String(b.itemNumber || '').localeCompare(String(a.itemNumber || ''), undefined, { numeric: true });
  });

  const grouped = filtered.reduce((groups, item) => {
    const key = item.consignorId || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());

  const groupedEntries = Array.from(grouped.entries()).sort(([aId, aItems], [bId, bItems]) => {
    if (sort !== 'consignor') return filtered.indexOf(aItems[0]) - filtered.indexOf(bItems[0]);
    const a = consignorById[aId];
    const b = consignorById[bId];
    return `${a?.lastName || ''} ${a?.firstName || ''}`.localeCompare(`${b?.lastName || ''} ${b?.firstName || ''}`);
  });

  const filters = [
    {
      key: 'consignor', label: 'Consignor', value: consignorFilter, onChange: setConsignorFilter,
      ariaLabel: 'Filter by consignor',
      options: [{ value: 'All', label: 'All consignors' }, ...consignors.map((c) => ({ value: c.id, label: `#${c.number} · ${c.firstName} ${c.lastName}` }))],
    },
    {
      key: 'expiry', label: 'Expiry', value: expiryFilter, onChange: setExpiryFilter,
      ariaLabel: 'Filter by expiry date', options: EXPIRY_OPTIONS,
    },
    {
      key: 'sort', label: 'Sort', value: sort, onChange: setSort, ariaLabel: 'Sort items',
      options: [
        { value: 'consignor', label: 'Consignor name' }, { value: 'newest', label: 'Newest first' },
        { value: 'oldest', label: 'Oldest first' }, { value: 'ticket', label: 'SKU / item number' },
        { value: 'priceHigh', label: 'Price high to low' }, { value: 'priceLow', label: 'Price low to high' },
      ],
    },
    ...(tier2Enabled ? [{
      key: 'product', label: 'Product type', value: productFilter, onChange: setProductFilter,
      ariaLabel: 'Filter by product type',
      options: [
        { value: 'All', label: 'All product types' }, { value: 'POS', label: 'POS' },
        { value: 'Online', label: 'Online' }, { value: 'POS + Online', label: 'POS + Online' },
      ],
    }] : []),
    {
      key: 'status', label: 'Status', value: filter, onChange: setFilter, ariaLabel: 'Filter by status',
      options: statuses.map((status) => ({
        value: status.value,
        label: `${status.value === 'Returned' || status.value === 'Donated' ? statusLabel(status.value) : status.label} (${statusCount(status.value)})`,
      })),
    },
  ];

  return (
    <>
      <Header eyebrow="Inventory" title="Items" action={<button className="consignment-btn" type="button" onClick={onNewItem}><Plus size={17} /> Add new item</button>} />
      <div className="consignment-body">
        <ConsignmentFilterBar
          search={{ value: query, onChange: setQuery, placeholder: 'Search name, SKU, brand, or consignor' }}
          filters={filters}
          views={{
            value: viewMode, onChange: setViewMode, ariaLabel: 'Choose item view',
            options: [
              { value: 'list', label: 'All items', icon: List },
              { value: 'grouped', label: 'By consignor', icon: Users },
              { value: 'grid', label: 'Grid', icon: Grid3X3 },
            ],
          }}
        />
        {filtered.length === 0 && <section className="consignment-card"><div className="consignment-empty-small">No items match these filters.</div></section>}
        {viewMode === 'list' && filtered.length > 0 && <AllListView items={filtered} consignors={consignors} onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} onMarkSold={onMarkSold} onStartPayout={onStartPayout} />}
        {viewMode === 'grouped' && <div className="consignment-item-groups">{groupedEntries.map(([consignorId, consignorItems]) => <AllConsignorView key={consignorId} consignor={consignorById[consignorId]} items={consignorItems} onOpenConsignor={onOpenConsignor} onOpenItem={onOpenItem} onMarkSold={onMarkSold} onStartPayout={onStartPayout} />)}</div>}
        {viewMode === 'grid' && <div className="consignment-readable-grid">{filtered.map((item) => <ItemGridCardContainer key={item.id} item={item} consignor={consignorById[item.consignorId]} onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} onMarkSold={onMarkSold} onStartPayout={onStartPayout} />)}</div>}
      </div>
    </>
  );
}
