import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Users, Grid3X3 } from 'lucide-react';
import { Header } from '../../components/consignment/SharedPieces';
import { SummaryStatRow, PageToolbar, EntityCard } from '../../components/consignment/PageBuildingBlocks';
import { money, productLabel, statusClass, statusLabel } from '../../lib/consignmentHelpers';

export default function ItemsScreen({ items, consignors, onOpenItem, onOpenConsignor, onMarkSold, onNewItem }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Current');
  const [consignorFilter, setConsignorFilter] = useState('All');
  const [productFilter, setProductFilter] = useState('All');
  const [sort, setSort] = useState('consignor');
  const [viewMode, setViewMode] = useState('all');
  const [sellingItemId, setSellingItemId] = useState(null);
  const statuses = ['Current', 'Draft', 'Available', 'Sold', 'Archived', 'Returned', 'Donated'];
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
      return aName.localeCompare(bName) || a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true });
    }
    if (sort === 'ticket') return a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true });
    if (sort === 'priceHigh') return Number(b.price || 0) - Number(a.price || 0);
    if (sort === 'priceLow') return Number(a.price || 0) - Number(b.price || 0);
    return String(b.dateReceived || '').localeCompare(String(a.dateReceived || '')) || b.itemNumber.localeCompare(a.itemNumber, undefined, { numeric: true });
  });

  const grouped = filtered.reduce((groups, item) => {
    const key = item.consignorId || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
  const groupedEntries = Array.from(grouped.entries()).sort(([aId], [bId]) => {
    const a = consignorById[aId];
    const b = consignorById[bId];
    return `${a?.lastName || ''} ${a?.firstName || ''}`.localeCompare(`${b?.lastName || ''} ${b?.firstName || ''}`);
  });

  const activeCount = items.filter((item) => !item.paidOut).length;
  const availableCount = items.filter((item) => item.status === 'Available' || item.status === 'Active').length;
  const soldCount = items.filter((item) => item.status === 'Sold' || item.dateSold).length;

  async function quickMarkSold(item) {
    if (sellingItemId) return;
    const amount = window.prompt(`Sale price for ${item.description || item.itemNumber}`, String(item.price ?? ''));
    if (amount === null) return;
    const salePrice = Number(amount);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      window.alert('Enter a valid sale price.');
      return;
    }
    setSellingItemId(item.id);
    try {
      await onMarkSold(item.id, { salePrice, dateSold: new Date().toISOString().slice(0, 10) });
    } finally {
      setSellingItemId(null);
    }
  }

  function ItemAction({ item, product }) {
    const isManualAvailable = product.className === 'manual' && (item.status === 'Available' || item.status === 'Active') && !item.paidOut;
    if (isManualAvailable) {
      return (
        <button type="button" className="consignment-quick-sold-btn" disabled={sellingItemId === item.id} onClick={() => quickMarkSold(item)}>
          {sellingItemId === item.id ? 'Saving…' : 'Mark sold'}
        </button>
      );
    }
    return (
      <button type="button" className="consignment-grid-open-btn" onClick={() => onOpenItem(item.id)}>
        Open item
      </button>
    );
  }

  function itemCard(item, showConsignor) {
    const consignor = consignorById[item.consignorId];
    const product = productLabel(item);
    return (
      <EntityCard
        key={item.id}
        photo={item.shopifyPhoto || item.photo}
        title={item.description || item.type || 'Consignment item'}
        subtitle={`${item.itemNumber}${item.size ? ` · ${item.size}` : ''}${item.brand ? ` · ${item.brand}` : ''}`}
        topBadge={product}
        consignor={showConsignor ? (consignor || null) : undefined}
        onOpenConsignor={onOpenConsignor}
        metrics={[
          { label: 'Price', value: money(item.price) },
          { label: 'Commission', value: `${item.commissionPct}%` },
        ]}
        detailLabel="Status"
        detailBadge={{
          text: item.paidOut ? 'Paid · archived' : statusLabel(item.status),
          className: item.paidOut ? 'sold' : statusClass(item.status),
        }}
        action={<ItemAction item={item} product={product} />}
      />
    );
  }

  const filtersSlot = (
    <details className="consignment-items-filter-details">
      <summary className="consignment-items-filter-summary">
        <span>Filters &amp; sorting</span>
        <ChevronDown size={20} aria-hidden="true" />
      </summary>
      <div className="consignment-items-toolbar-top">
        <label className="consignment-tool-field"><span>Consignor</span><select className="consignment-select consignment-filter-select" value={consignorFilter} onChange={(event) => setConsignorFilter(event.target.value)}>
          <option value="All">All consignors</option>
          {consignors.map((consignor) => <option key={consignor.id} value={consignor.id}>#{consignor.number} · {consignor.firstName} {consignor.lastName}</option>)}
        </select></label>
        <label className="consignment-tool-field"><span>Sort</span><select className="consignment-select consignment-filter-select" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="consignor">Consignor name</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="ticket">SKU / item number</option><option value="priceHigh">Price high to low</option><option value="priceLow">Price low to high</option>
        </select></label>
        <label className="consignment-tool-field"><span>Product type</span><select className="consignment-select consignment-filter-select" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
          <option value="All">All product types</option><option value="Manual">Manual</option><option value="POS">POS</option><option value="Online">Online</option><option value="POS + Online">POS + Online</option>
        </select></label>
        <label className="consignment-tool-field"><span>Status</span><select className="consignment-select consignment-filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}>
          {statuses.map((status) => {
            const count = status === 'Current' ? items.filter((item) => !item.paidOut).length : status === 'Archived' ? items.filter((item) => item.paidOut).length : items.filter((item) => item.status === status && !item.paidOut).length;
            return <option key={status} value={status}>{statusLabel(status)} ({count})</option>;
          })}
        </select></label>
      </div>
    </details>
  );

  return (
    <>
      <Header
        eyebrow="Inventory"
        title="Items"
        action={(
          <button className="consignment-btn" type="button" onClick={onNewItem}>
            <Plus size={17} /> Add new item
          </button>
        )}
      />
      <div className="consignment-body">
        <SummaryStatRow stats={[
          { label: 'Active items', value: activeCount },
          { label: 'Available', value: availableCount },
          { label: 'Sold', value: soldCount },
          { label: 'Total items', value: items.length },
        ]}
        />

        <PageToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search name, SKU, brand, or consignor"
          filtersSlot={filtersSlot}
          viewOptions={[
            { key: 'all', label: 'All items', icon: Grid3X3 },
            { key: 'grouped', label: 'By consignor', icon: Users },
          ]}
          activeView={viewMode}
          onViewChange={setViewMode}
        />

        {filtered.length === 0 && <div className="consignment-empty-small">No items match these filters.</div>}

        {viewMode === 'all' && filtered.length > 0 && (
          <div className="consignment-entity-grid">
            {filtered.map((item) => itemCard(item, true))}
          </div>
        )}

        {viewMode === 'grouped' && groupedEntries.map(([consignorId, consignorItems]) => {
          const consignor = consignorById[consignorId];
          return (
            <section key={consignorId} style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <ChevronRight size={16} color="var(--muted)" />
                <strong style={{ fontSize: 14 }}>{consignor ? `${consignor.firstName} ${consignor.lastName}` : 'Unassigned'}</strong>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>#{consignor?.number || '—'} · {consignorItems.length} item{consignorItems.length === 1 ? '' : 's'}</span>
              </div>
              <div className="consignment-entity-grid">
                {consignorItems.map((item) => itemCard(item, false))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
