import { useState } from 'react';
import { ChevronDown, Download, Grid3X3, List, Users } from 'lucide-react';
import { Header } from '../../components/consignment/SharedPieces';
import { SummaryStatRow, PageToolbar } from '../../components/consignment/PageBuildingBlocks';
import ByConsignorContainer from '../../components/consignment/ByConsignorContainer';
import ItemGridCardContainer from '../../components/consignment/ItemGridCardContainer';
import AllListContainer from '../../components/consignment/AllListContainer';
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

  function groupedView() {
    return (
      <div className="consignment-item-groups">
        {groupedSales.map(({ key, consignor, sales }) => (
          <ByConsignorContainer
            key={key}
            consignor={consignor}
            items={sales}
            itemLabel={`sale${sales.length === 1 ? '' : 's'}`}
            onOpenConsignor={onOpenConsignor}
            onOpenItem={onOpenItem}
            onStartPayout={onStartPayout}
          />
        ))}
      </div>
    );
  }

  const filtersSlot = <details className="consignment-items-filter-details"><summary className="consignment-items-filter-summary"><span>Filters &amp; sorting</span><ChevronDown size={20} /></summary><div className="consignment-items-toolbar-top"><label className="consignment-tool-field"><span>Payout status</span><select className="consignment-select consignment-filter-select" value={payoutFilter} onChange={(event) => setPayoutFilter(event.target.value)}><option value="all">All payout statuses</option><option value="unpaid">Unpaid</option><option value="paid">Archived</option></select></label><label className="consignment-tool-field"><span>Consignor</span><select className="consignment-select consignment-filter-select" value={consignorFilter} onChange={(event) => setConsignorFilter(event.target.value)}><option value="all">All consignors</option>{consignors.slice().sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)).map((consignor) => <option key={consignor.id} value={consignor.id}>{consignor.firstName} {consignor.lastName}</option>)}</select></label><label className="consignment-tool-field"><span>Sale source</span><select className="consignment-select consignment-filter-select" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">All sale sources</option><option value="manual">Manual</option><option value="pos">POS</option><option value="online">Online</option></select></label><label className="consignment-tool-field"><span>Sort</span><select className="consignment-select consignment-filter-select" value={sortMode} onChange={(event) => setSortMode(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="price">Highest sale price</option><option value="due">Highest consignor due</option><option value="consignor">Consignor name</option><option value="sku">SKU</option></select></label></div></details>;

  return <><Header eyebrow="Sales ledger" title="Sales" action={<button type="button" className="consignment-btn secondary" onClick={exportSales}><Download size={16} /> Export</button>} /><div className="consignment-body consignment-online-layout consignment-sales-page"><SummaryStatRow stats={[{ label: 'Total sales', value: money(totalSales) }, { label: 'Unpaid to consignors', value: money(totalUnpaid) }, { label: 'Unpaid sales', value: unpaidCount }, { label: 'Archived sales', value: paidCount }]} /><PageToolbar query={query} onQueryChange={setQuery} placeholder="Search name, SKU, brand, or consignor" filtersSlot={filtersSlot} viewOptions={[{ key: 'all', label: 'All sales', icon: List }, { key: 'grouped', label: 'By consignor', icon: Users }, { key: 'grid', label: 'Grid', icon: Grid3X3 }]} activeView={viewMode} onViewChange={setViewMode} />{filteredSales.length === 0 && <div className="consignment-empty-small">No sales match the selected filters.</div>}{viewMode === 'all' && filteredSales.length > 0 && (
    <AllListContainer items={filteredSales} consignorById={consignorById} mode="sales" onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} onStartPayout={onStartPayout} />
  )}{viewMode === 'grouped' && filteredSales.length > 0 && groupedView()}{viewMode === 'grid' && filteredSales.length > 0 && (
    <div className="consignment-readable-grid">
      {filteredSales.map((item) => (
        <ItemGridCardContainer key={item.id} item={item} consignor={consignorById[item.consignorId]} onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} onStartPayout={onStartPayout} />
      ))}
    </div>
  )}</div></>;
}
