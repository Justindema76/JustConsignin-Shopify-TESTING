import { useState } from 'react';
import { ChevronDown, Grid3X3, List, Plus, Users } from 'lucide-react';
import { Header } from '../../components/consignment/SharedPieces';
import { SummaryStatRow, PageToolbar } from '../../components/consignment/PageBuildingBlocks';
import ByConsignorContainer from '../../components/consignment/ByConsignorContainer';
import ItemGridCardContainer from '../../components/consignment/ItemGridCardContainer';
import AllListContainer from '../../components/consignment/AllListContainer';
import { productLabel, statusLabel } from '../../lib/consignmentHelpers';
import '../../styles/consignment-live-items-sales.css';

export default function ItemsScreen({ items, consignors, onOpenItem, onOpenConsignor, onMarkSold, onStartPayout, onNewItem }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Current');
  const [consignorFilter, setConsignorFilter] = useState('All');
  const [productFilter, setProductFilter] = useState('All');
  const [sort, setSort] = useState('consignor');
  const [viewMode, setViewMode] = useState('grouped');
  const statuses = ['Current', 'Draft', 'Available', 'Sold', 'Archived', 'Returned', 'Donated'];
  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));

  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    const consignor = consignorById[item.consignorId];
    const product = productLabel(item);
    const matchesQuery = !q || `${item.description || ''} ${item.itemNumber || ''} ${item.type || ''} ${item.brand || ''} ${item.size || ''} ${consignor?.firstName || ''} ${consignor?.lastName || ''} ${consignor?.number || ''}`.toLowerCase().includes(q);
    const matchesConsignor = consignorFilter === 'All' || item.consignorId === consignorFilter;
    const matchesProduct = productFilter === 'All'
      || (productFilter === 'Manual' && product.className === 'manual')
      || (productFilter === 'POS' && product.text === 'POS')
      || (productFilter === 'Online' && product.text === 'Online')
      || (productFilter === 'POS + Online' && product.text === 'POS + Online');
    const matchesStatus = filter === 'Current'
      ? !item.paidOut
      : filter === 'Archived'
        ? item.paidOut
        : filter === 'Available'
          ? item.status === 'Available' || item.status === 'Active'
          : item.status === filter && !item.paidOut;
    return matchesQuery && matchesConsignor && matchesProduct && matchesStatus;
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
    return String(b.dateReceived || '').localeCompare(String(a.dateReceived || ''));
  });

  const groupedEntries = Array.from(filtered.reduce((groups, item) => {
    const key = item.consignorId || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map()).entries()).sort(([aId], [bId]) => {
    const a = consignorById[aId];
    const b = consignorById[bId];
    return `${a?.lastName || ''} ${a?.firstName || ''}`.localeCompare(`${b?.lastName || ''} ${b?.firstName || ''}`);
  });

  const activeCount = items.filter((item) => !item.paidOut).length;
  const availableCount = items.filter((item) => item.status === 'Available' || item.status === 'Active').length;
  const soldCount = items.filter((item) => item.status === 'Sold' || item.dateSold).length;

  function groupedView() {
    return (
      <div className="consignment-item-groups">
        {groupedEntries.map(([consignorId, consignorItems]) => (
          <ByConsignorContainer
            key={consignorId}
            consignor={consignorById[consignorId]}
            items={consignorItems}
            onOpenConsignor={onOpenConsignor}
            onOpenItem={onOpenItem}
            onMarkSold={onMarkSold}
            onStartPayout={onStartPayout}
          />
        ))}
      </div>
    );
  }

  const filtersSlot = <details className="consignment-items-filter-details"><summary className="consignment-items-filter-summary"><span>Filters &amp; sorting</span><ChevronDown size={20} /></summary><div className="consignment-items-toolbar-top"><label className="consignment-tool-field"><span>Consignor</span><select className="consignment-select consignment-filter-select" value={consignorFilter} onChange={(event) => setConsignorFilter(event.target.value)}><option value="All">All consignors</option>{consignors.map((consignor) => <option key={consignor.id} value={consignor.id}>#{consignor.number} · {consignor.firstName} {consignor.lastName}</option>)}</select></label><label className="consignment-tool-field"><span>Sort</span><select className="consignment-select consignment-filter-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="consignor">Consignor name</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="ticket">SKU / item number</option><option value="priceHigh">Price high to low</option><option value="priceLow">Price low to high</option></select></label><label className="consignment-tool-field"><span>Product type</span><select className="consignment-select consignment-filter-select" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="All">All product types</option><option value="Manual">Manual</option><option value="POS">POS</option><option value="Online">Online</option><option value="POS + Online">POS + Online</option></select></label><label className="consignment-tool-field"><span>Status</span><select className="consignment-select consignment-filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label></div></details>;

  return <><Header eyebrow="Inventory" title="Items" action={<button className="consignment-btn" type="button" onClick={onNewItem}><Plus size={17} /> Add new item</button>} /><div className="consignment-body consignment-online-layout consignment-items-page"><SummaryStatRow stats={[{ label: 'Active items', value: activeCount }, { label: 'Available', value: availableCount }, { label: 'Sold', value: soldCount }, { label: 'Total items', value: items.length }]} /><PageToolbar query={query} onQueryChange={setQuery} placeholder="Search name, SKU, brand, or consignor" filtersSlot={filtersSlot} viewOptions={[{ key: 'all', label: 'All items', icon: List }, { key: 'grouped', label: 'By consignor', icon: Users }, { key: 'grid', label: 'Grid', icon: Grid3X3 }]} activeView={viewMode} onViewChange={setViewMode} />{filtered.length === 0 && <div className="consignment-empty-small">No items match these filters.</div>}{viewMode === 'all' && filtered.length > 0 && (
    <AllListContainer items={filtered} consignorById={consignorById} mode="items" onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} onMarkSold={onMarkSold} onStartPayout={onStartPayout} />
  )}{viewMode === 'grouped' && filtered.length > 0 && groupedView()}{viewMode === 'grid' && filtered.length > 0 && (
    <div className="consignment-readable-grid">
      {filtered.map((item) => (
        <ItemGridCardContainer key={item.id} item={item} consignor={consignorById[item.consignorId]} onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} onMarkSold={onMarkSold} onStartPayout={onStartPayout} />
      ))}
    </div>
  )}</div></>;
}
