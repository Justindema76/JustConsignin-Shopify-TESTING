import { useState } from 'react';
import { ChevronDown, Download, Grid3X3, List, Users } from 'lucide-react';
import { Header } from '../../components/consignment/SharedPieces';
import { SummaryStatRow, PageToolbar, EntityCard } from '../../components/consignment/PageBuildingBlocks';
import ByConsignorContainer from '../../components/consignment/ByConsignorContainer';
import { money, downloadCsv } from '../../lib/consignmentHelpers';
import '../../styles/consignment-live-items-sales.css';

function saleSource(item) {
  if (!item.shopifyProductId && !item.shopifyProduct) return 'manual';
  if (item.publishOnline || item.publishToOnlineStore) return 'online';
  return 'pos';
}

function sourceLabel(item) {
  const source = saleSource(item);
  if (source === 'online') return { text: 'Online', className: 'online' };
  if (source === 'pos') return { text: 'POS', className: 'pos' };
  return { text: 'Manual', className: 'manual' };
}

function formatSaleDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SaleThumb({ item }) {
  const photo = item.shopifyPhoto || item.photo;
  if (!photo) return null;
  return <div className="consignment-grid-thumb"><img src={photo} alt="" /></div>;
}

export default function SalesScreen({ items, consignors, onStartPayout, onOpenConsignor, onOpenItem }) {
  const [query, setQuery] = useState('');
  const [payoutFilter, setPayoutFilter] = useState('all');
  const [consignorFilter, setConsignorFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortMode, setSortMode] = useState('newest');
  const [viewMode, setViewMode] = useState('grouped');
  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));
  const allSales = items.filter((item) => item.status === 'Sold' || item.dateSold || item.orderId);

  const filteredSales = allSales.filter((item) => {
    const consignor = consignorById[item.consignorId];
    const q = query.trim().toLowerCase();
    const searchable = `${item.description || ''} ${item.itemNumber || ''} ${item.orderName || ''} ${item.brand || ''} ${item.size || ''} ${consignor?.firstName || ''} ${consignor?.lastName || ''}`.toLowerCase();
    if (q && !searchable.includes(q)) return false;
    if (payoutFilter === 'paid' && !item.paidOut) return false;
    if (payoutFilter === 'unpaid' && item.paidOut) return false;
    if (consignorFilter !== 'all' && item.consignorId !== consignorFilter) return false;
    if (sourceFilter !== 'all' && saleSource(item) !== sourceFilter) return false;
    return true;
  }).sort((a, b) => {
    const aConsignor = consignorById[a.consignorId];
    const bConsignor = consignorById[b.consignorId];
    const aPrice = Number(a.salePrice ?? a.price ?? 0);
    const bPrice = Number(b.salePrice ?? b.price ?? 0);
    const aDue = (aPrice * Number(a.commissionPct ?? aConsignor?.commissionPct ?? 0)) / 100;
    const bDue = (bPrice * Number(b.commissionPct ?? bConsignor?.commissionPct ?? 0)) / 100;
    if (sortMode === 'oldest') return String(a.dateSold || '').localeCompare(String(b.dateSold || ''));
    if (sortMode === 'price') return bPrice - aPrice;
    if (sortMode === 'due') return bDue - aDue;
    if (sortMode === 'consignor') return `${aConsignor?.lastName || ''} ${aConsignor?.firstName || ''}`.localeCompare(`${bConsignor?.lastName || ''} ${bConsignor?.firstName || ''}`);
    if (sortMode === 'sku') return String(a.itemNumber || '').localeCompare(String(b.itemNumber || ''), undefined, { numeric: true });
    return String(b.dateSold || '').localeCompare(String(a.dateSold || ''));
  });

  const groupedSales = Object.values(filteredSales.reduce((groups, item) => {
    const key = item.consignorId || 'unknown';
    if (!groups[key]) groups[key] = { key, consignor: consignorById[item.consignorId], sales: [] };
    groups[key].sales.push(item);
    return groups;
  }, {})).sort((a, b) => `${a.consignor?.lastName || ''} ${a.consignor?.firstName || ''}`.localeCompare(`${b.consignor?.lastName || ''} ${b.consignor?.firstName || ''}`));

  const totalSales = allSales.reduce((sum, item) => sum + Number(item.salePrice ?? item.price ?? 0), 0);
  const totalUnpaid = allSales.filter((item) => !item.paidOut).reduce((sum, item) => {
    const consignor = consignorById[item.consignorId];
    const salePrice = Number(item.salePrice ?? item.price ?? 0);
    return sum + (salePrice * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
  }, 0);
  const unpaidCount = allSales.filter((item) => !item.paidOut).length;
  const paidCount = allSales.filter((item) => item.paidOut).length;

  function exportSales() {
    const headers = ['SKU', 'Item', 'Consignor', 'Source', 'Sale price', 'Consignor due', 'Payout status', 'Date sold', 'Order'];
    const rows = filteredSales.map((item) => {
      const consignor = consignorById[item.consignorId];
      const price = Number(item.salePrice ?? item.price ?? 0);
      const due = (price * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
      return [item.itemNumber || '', item.description || '', consignor ? `${consignor.firstName} ${consignor.lastName}` : '', sourceLabel(item).text, price, due, item.paidOut ? 'Archived' : 'Unpaid', item.dateSold || '', item.orderName || ''];
    });
    downloadCsv(`sales-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  function saleAction(item, consignor, { grouped = false } = {}) {
    if (item.paidOut) return <span className="consignment-archive-note">Archived</span>;
    if (!grouped && consignor) return <button type="button" className="consignment-sales-pay-btn" onClick={() => onStartPayout(consignor.id)}>Review &amp; pay</button>;
    return null;
  }

  function saleCard(item, showConsignor) {
    const consignor = consignorById[item.consignorId];
    const salePrice = Number(item.salePrice ?? item.price ?? 0);
    const due = (salePrice * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
    const source = sourceLabel(item);
    return <EntityCard key={item.id} photo={item.shopifyPhoto || item.photo} title={item.description || item.itemNumber} subtitle={`#${item.itemNumber || '—'}${item.size ? ` · ${item.size}` : ''}${item.brand ? ` · ${item.brand}` : ''}`} onOpen={() => onOpenItem?.(item.id)} topBadge={source} consignor={showConsignor ? (consignor || null) : undefined} onOpenConsignor={onOpenConsignor} metrics={[{ label: 'Sale price', value: money(salePrice) }, { label: 'Consignor due', value: money(due) }]} detailLabel="Sale date" detailValue={formatSaleDate(item.dateSold)} detailBadge={{ text: item.paidOut ? 'Archived' : 'Unpaid', className: item.paidOut ? 'paid' : 'unpaid' }} footNote={item.orderName || (source.text === 'Manual' ? 'Manual sale' : 'Shopify order')} action={saleAction(item, consignor)} />;
  }

  function saleCell(item) {
    return <div className="consignment-live-item-cell"><SaleThumb item={item} /><div className="consignment-live-item-copy"><button className="consignment-title-link" type="button" onClick={() => onOpenItem?.(item.id)}>{item.description || item.itemNumber}</button><small>#{item.itemNumber || '—'}{item.size ? ` · ${item.size}` : ''}{item.brand ? ` · ${item.brand}` : ''}</small>{item.orderName && <small>{item.orderName}</small>}</div></div>;
  }

  function allSalesView() {
    return <div className="consignment-live-list consignment-sales-all-view"><div className="consignment-live-list-head consignment-sales-live-columns"><span>Item</span><span>Consignor</span><span>Sale price</span><span>Consignor due</span><span>Source</span><span>Payout</span><span>Sold</span><span>Action</span></div>{filteredSales.map((item) => {
      const consignor = consignorById[item.consignorId];
      const salePrice = Number(item.salePrice ?? item.price ?? 0);
      const due = (salePrice * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
      const source = sourceLabel(item);
      return <div className="consignment-live-list-row consignment-sales-live-columns" key={item.id}>{saleCell(item)}<div>{consignor ? <button className="consignment-consignor-link" type="button" onClick={() => onOpenConsignor?.(consignor.id)}>{consignor.firstName} {consignor.lastName}</button> : 'Unknown'}</div><strong className="consignment-money">{money(salePrice)}</strong><strong className="consignment-money">{money(due)}</strong><span><span className={`consignment-product-badge ${source.className}`}>{source.text}</span></span><span><span className={`consignment-badge ${item.paidOut ? 'paid' : 'unpaid'}`}>{item.paidOut ? 'Archived' : 'Unpaid'}</span></span><span>{formatSaleDate(item.dateSold)}</span><span>{saleAction(item, consignor)}</span></div>;
    })}</div>;
  }

  function groupedView() {
    return <div className="consignment-item-groups">{groupedSales.map(({ key, consignor, sales }) => {
      const summaryItems = items.filter((item) => item.consignorId === key);
      return <ByConsignorContainer key={key} consignor={consignor} summaryItems={summaryItems} onOpenConsignor={onOpenConsignor} onStartPayout={onStartPayout}>
        <div className="consignment-live-list-head consignment-sales-grouped-live-columns"><span>Item</span><span>Sale price</span><span>Due</span><span>Source</span><span>Payout</span><span>Sold</span><span>Action</span></div>
        {sales.map((item) => {
          const salePrice = Number(item.salePrice ?? item.price ?? 0);
          const itemDue = (salePrice * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
          const source = sourceLabel(item);
          return <div className="consignment-live-list-row consignment-sales-grouped-live-columns" key={item.id}>{saleCell(item)}<strong className="consignment-money">{money(salePrice)}</strong><strong className="consignment-money">{money(itemDue)}</strong><span><span className={`consignment-product-badge ${source.className}`}>{source.text}</span></span><span><span className={`consignment-badge ${item.paidOut ? 'paid' : 'unpaid'}`}>{item.paidOut ? 'Archived' : 'Unpaid'}</span></span><span>{formatSaleDate(item.dateSold)}</span><span>{saleAction(item, consignor, { grouped: true })}</span></div>;
        })}
      </ByConsignorContainer>;
    })}</div>;
  }

  const filtersSlot = <details className="consignment-items-filter-details"><summary className="consignment-items-filter-summary"><span>Filters &amp; sorting</span><ChevronDown size={20} /></summary><div className="consignment-items-toolbar-top"><label className="consignment-tool-field"><span>Payout status</span><select className="consignment-select consignment-filter-select" value={payoutFilter} onChange={(event) => setPayoutFilter(event.target.value)}><option value="all">All payout statuses</option><option value="unpaid">Unpaid</option><option value="paid">Archived</option></select></label><label className="consignment-tool-field"><span>Consignor</span><select className="consignment-select consignment-filter-select" value={consignorFilter} onChange={(event) => setConsignorFilter(event.target.value)}><option value="all">All consignors</option>{consignors.slice().sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)).map((consignor) => <option key={consignor.id} value={consignor.id}>{consignor.firstName} {consignor.lastName}</option>)}</select></label><label className="consignment-tool-field"><span>Sale source</span><select className="consignment-select consignment-filter-select" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">All sale sources</option><option value="manual">Manual</option><option value="pos">POS</option><option value="online">Online</option></select></label><label className="consignment-tool-field"><span>Sort</span><select className="consignment-select consignment-filter-select" value={sortMode} onChange={(event) => setSortMode(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="price">Highest sale price</option><option value="due">Highest consignor due</option><option value="consignor">Consignor name</option><option value="sku">SKU</option></select></label></div></details>;

  return <><Header eyebrow="Sales ledger" title="Sales" action={<button type="button" className="consignment-btn secondary" onClick={exportSales}><Download size={16} /> Export</button>} /><div className="consignment-body consignment-online-layout consignment-sales-page"><SummaryStatRow stats={[{ label: 'Total sales', value: money(totalSales) }, { label: 'Unpaid to consignors', value: money(totalUnpaid) }, { label: 'Unpaid sales', value: unpaidCount }, { label: 'Archived sales', value: paidCount }]} /><PageToolbar query={query} onQueryChange={setQuery} placeholder="Search name, SKU, brand, or consignor" filtersSlot={filtersSlot} viewOptions={[{ key: 'all', label: 'All sales', icon: List }, { key: 'grouped', label: 'By consignor', icon: Users }, { key: 'grid', label: 'Grid', icon: Grid3X3 }]} activeView={viewMode} onViewChange={setViewMode} />{filteredSales.length === 0 && <div className="consignment-empty-small">No sales match the selected filters.</div>}{viewMode === 'all' && filteredSales.length > 0 && allSalesView()}{viewMode === 'grouped' && filteredSales.length > 0 && groupedView()}{viewMode === 'grid' && filteredSales.length > 0 && <div className="consignment-readable-grid">{filteredSales.map((item) => saleCard(item, true))}</div>}</div></>;
}
