/* eslint-disable react/prop-types */
import { useState } from 'react';
import { Download, Grid3X3, List, Users } from 'lucide-react';
import Header from '../../components/consignment/Header';
import AllConsignorView from '../../components/consignment/AllConsignorView';
import AllListView from '../../components/consignment/AllListView';
import ItemGridCardContainer from '../../components/consignment/ItemGridCardContainer';
import ConsignmentFilterBar from '../../components/consignment/ConsignmentFilterBar';
import { downloadCsv, saleSourceLabel, saleSourceMatches } from '../../lib/consignmentHelpers';
import '../../styles/consignment-sales.css';

export default function SalesScreen({ items, consignors, onOpenItem, onOpenConsignor, onStartPayout, tier2Enabled = false }) {
  const [query, setQuery] = useState('');
  const [payoutFilter, setPayoutFilter] = useState('Unpaid');
  const [consignorFilter, setConsignorFilter] = useState('All');
  const [productFilter, setProductFilter] = useState(() => tier2Enabled ? 'All' : 'Manual');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState('list');
  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));

  const sales = items.filter((item) => item.status === 'Sold' || item.dateSold || item.orderId);
  const unpaidCount = sales.filter((item) => !item.paidOut).length;
  const paidCount = sales.filter((item) => item.paidOut).length;

  const filtered = sales.filter((item) => {
    const q = query.trim().toLowerCase();
    const consignor = consignorById[item.consignorId];
    const matchesQuery = !q || `${item.description} ${item.itemNumber} ${item.type} ${item.brand || ''} ${consignor?.firstName || ''} ${consignor?.lastName || ''} ${consignor?.number || ''}`.toLowerCase().includes(q);
    const matchesConsignor = consignorFilter === 'All' || item.consignorId === consignorFilter;
    const matchesProduct = saleSourceMatches(item, productFilter);
    const matchesPayout = payoutFilter === 'All' || (payoutFilter === 'Paid' && item.paidOut) || (payoutFilter === 'Unpaid' && !item.paidOut);
    return matchesQuery && matchesConsignor && matchesProduct && matchesPayout;
  }).sort((a, b) => {
    const aConsignor = consignorById[a.consignorId];
    const bConsignor = consignorById[b.consignorId];
    const aPrice = Number(a.salePrice ?? a.price ?? 0);
    const bPrice = Number(b.salePrice ?? b.price ?? 0);
    const aDue = (aPrice * Number(a.commissionPct ?? aConsignor?.commissionPct ?? 0)) / 100;
    const bDue = (bPrice * Number(b.commissionPct ?? bConsignor?.commissionPct ?? 0)) / 100;
    if (sort === 'oldest') return String(a.dateSold || '').localeCompare(String(b.dateSold || ''));
    if (sort === 'price') return bPrice - aPrice;
    if (sort === 'due') return bDue - aDue;
    if (sort === 'consignor') return `${aConsignor?.lastName || ''} ${aConsignor?.firstName || ''}`.localeCompare(`${bConsignor?.lastName || ''} ${bConsignor?.firstName || ''}`);
    if (sort === 'sku') return String(a.itemNumber || '').localeCompare(String(b.itemNumber || ''), undefined, { numeric: true });
    return String(b.dateSold || '').localeCompare(String(a.dateSold || ''));
  });

  const grouped = filtered.reduce((groups, item) => {
    const key = item.consignorId || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());

  const groupedEntries = Array.from(grouped.entries()).sort(([aId, aItems], [bId, bItems]) => {
    if (sort !== 'consignor') return filtered.indexOf(aItems[0]) - filtered.indexOf(bItems[0]);
    const a = consignorById[aId]; const b = consignorById[bId];
    return `${a?.lastName || ''} ${a?.firstName || ''}`.localeCompare(`${b?.lastName || ''} ${b?.firstName || ''}`);
  });

  const totalSales = sales.reduce((sum, item) => sum + Number(item.salePrice ?? item.price ?? 0), 0);
  const totalUnpaid = sales.filter((item) => !item.paidOut).reduce((sum, item) => {
    const consignor = consignorById[item.consignorId];
    const salePrice = Number(item.salePrice ?? item.price ?? 0);
    return sum + (salePrice * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
  }, 0);

  function exportSales() {
    const headers = ['SKU', 'Item', 'Consignor', 'Source', 'Sale price', 'Consignor due', 'Payout status', 'Date sold', 'Order'];
    const rows = filtered.map((item) => {
      const consignor = consignorById[item.consignorId];
      const price = Number(item.salePrice ?? item.price ?? 0);
      const due = (price * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
      return [item.itemNumber || '', item.description || '', consignor ? `${consignor.firstName} ${consignor.lastName}` : '', saleSourceLabel(item.saleSource).text, price, due, item.paidOut ? 'Paid' : 'Unpaid', item.dateSold || '', item.orderName || ''];
    });
    downloadCsv(`sales-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  const filters = [
    { key: 'consignor', label: 'Consignor', value: consignorFilter, onChange: setConsignorFilter, ariaLabel: 'Filter by consignor', options: [{ value: 'All', label: 'All consignors' }, ...consignors.map((c) => ({ value: c.id, label: `#${c.number} · ${c.firstName} ${c.lastName}` }))] },
    { key: 'sort', label: 'Sort', value: sort, onChange: setSort, ariaLabel: 'Sort sales', options: [{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'price', label: 'Highest sale price' }, { value: 'due', label: 'Highest consignor due' }, { value: 'consignor', label: 'Consignor name' }, { value: 'sku', label: 'SKU / item number' }] },
    ...(tier2Enabled ? [{ key: 'source', label: 'Sale source', value: productFilter, onChange: setProductFilter, ariaLabel: 'Filter by sale source', options: [{ value: 'All', label: 'All sale sources' }, { value: 'POS', label: 'POS' }, { value: 'Online', label: 'Online' }] }] : []),
    { key: 'payoutStatus', label: 'Payout status', value: payoutFilter, onChange: setPayoutFilter, ariaLabel: 'Filter by payout status', options: [{ value: 'All', label: `All payout statuses (${sales.length})` }, { value: 'Unpaid', label: `Unpaid (${unpaidCount})` }, { value: 'Paid', label: `Paid (${paidCount})` }] },
  ];

  return (
    <>
      <Header eyebrow="Sales ledger" title="Sales" action={<button className="consignment-btn secondary" type="button" onClick={exportSales}><Download size={16} /> Export</button>} />
      <div className="consignment-body">
        <div className="consignment-sales-summary-grid">
          <div className="consignment-card consignment-sales-summary-card"><span>Total sales</span><strong>${totalSales.toFixed(2)}</strong></div>
          <div className="consignment-card consignment-sales-summary-card"><span>Unpaid to consignors</span><strong>${totalUnpaid.toFixed(2)}</strong></div>
          <div className="consignment-card consignment-sales-summary-card"><span>Unpaid sales</span><strong>{unpaidCount}</strong></div>
          <div className="consignment-card consignment-sales-summary-card"><span>Paid sales</span><strong>{paidCount}</strong></div>
        </div>
        <ConsignmentFilterBar search={{ value: query, onChange: setQuery, placeholder: 'Search name, SKU, brand, or consignor' }} filters={filters} views={{ value: viewMode, onChange: setViewMode, ariaLabel: 'Choose sales view', options: [{ value: 'list', label: 'All items', icon: List }, { value: 'grouped', label: 'By consignor', icon: Users }, { value: 'grid', label: 'Grid', icon: Grid3X3 }] }} />
        {filtered.length === 0 && <section className="consignment-card"><div className="consignment-empty-small">No sales match these filters.</div></section>}
        {viewMode === 'list' && filtered.length > 0 && <AllListView saleSourceMode items={filtered} consignors={consignors} onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} onStartPayout={onStartPayout} />}
        {viewMode === 'grouped' && <div className="consignment-item-groups">{groupedEntries.map(([consignorId, consignorItems]) => <AllConsignorView saleSourceMode key={consignorId} consignor={consignorById[consignorId]} items={consignorItems} itemLabel="sale" onOpenConsignor={onOpenConsignor} onOpenItem={onOpenItem} onStartPayout={onStartPayout} />)}</div>}
        {viewMode === 'grid' && filtered.length > 0 && <div className="consignment-readable-grid">{filtered.map((item) => <ItemGridCardContainer saleSourceMode key={item.id} item={item} consignor={consignorById[item.consignorId]} showConsignor onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} onStartPayout={onStartPayout} />)}</div>}
      </div>
    </>
  );
}
