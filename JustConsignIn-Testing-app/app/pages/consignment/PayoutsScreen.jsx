/* eslint-disable react/prop-types */
import { useState } from 'react';
import { ChevronDown, Clock, Grid3X3, List, Users } from 'lucide-react';
import Header from '../../components/consignment/Header';
import AllConsignorView from '../../components/consignment/AllConsignorView';
import AllListView from '../../components/consignment/AllListView';
import ItemGridCardContainer from '../../components/consignment/ItemGridCardContainer';
import ConsignmentFilterBar from '../../components/consignment/ConsignmentFilterBar';
import { money, recordedPayoutGroups, saleSourceMatches } from '../../lib/consignmentHelpers';
import '../../styles/consignment-payouts.css';

const SOURCE_OPTIONS = [
  { value: 'All', label: 'All sale sources' },
  { value: 'POS', label: 'POS' },
  { value: 'Online', label: 'Online' },
];

function OwedTab({ items, consignors, onOpenItem, onOpenConsignor, onStartPayout, tier2Enabled }) {
  const [query, setQuery] = useState('');
  const [consignorFilter, setConsignorFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState(() => tier2Enabled ? 'All' : 'Manual');
  const [sort, setSort] = useState('amount');
  const [viewMode, setViewMode] = useState('list');
  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));
  const owed = items.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut);
  const owedConsignorIds = new Set(owed.map((item) => item.consignorId));
  const consignorsOwed = consignors.filter((consignor) => owedConsignorIds.has(consignor.id));
  const dueForItem = (item) => {
    const consignor = consignorById[item.consignorId];
    return (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
  };
  const filtered = owed.filter((item) => {
    const q = query.trim().toLowerCase();
    const consignor = consignorById[item.consignorId];
    const matchesQuery = !q || `${item.description} ${item.itemNumber} ${item.type} ${item.brand || ''} ${consignor?.firstName || ''} ${consignor?.lastName || ''} ${consignor?.number || ''}`.toLowerCase().includes(q);
    const matchesConsignor = consignorFilter === 'All' || item.consignorId === consignorFilter;
    const matchesSource = saleSourceMatches(item, sourceFilter);
    return matchesQuery && matchesConsignor && matchesSource;
  }).sort((a, b) => {
    const aConsignor = consignorById[a.consignorId]; const bConsignor = consignorById[b.consignorId];
    if (sort === 'name') return `${aConsignor?.lastName || ''} ${aConsignor?.firstName || ''}`.localeCompare(`${bConsignor?.lastName || ''} ${bConsignor?.firstName || ''}`);
    if (sort === 'oldest') return String(a.dateSold || '').localeCompare(String(b.dateSold || ''));
    return dueForItem(b) - dueForItem(a);
  });
  const grouped = filtered.reduce((groups, item) => { const key = item.consignorId || 'unassigned'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); return groups; }, new Map());
  const dueForGroup = (groupItems) => groupItems.reduce((sum, item) => sum + dueForItem(item), 0);
  const groupedEntries = Array.from(grouped.entries()).sort(([aId, aItems], [bId, bItems]) => {
    if (sort === 'name') { const a = consignorById[aId]; const b = consignorById[bId]; return `${a?.lastName || ''} ${a?.firstName || ''}`.localeCompare(`${b?.lastName || ''} ${b?.firstName || ''}`); }
    if (sort === 'oldest') return filtered.indexOf(aItems[0]) - filtered.indexOf(bItems[0]);
    return dueForGroup(bItems) - dueForGroup(aItems);
  });
  const totalDue = filtered.reduce((sum, item) => sum + dueForItem(item), 0);
  const filters = [
    { key: 'consignor', label: 'Consignor', value: consignorFilter, onChange: setConsignorFilter, ariaLabel: 'Filter by consignor', options: [{ value: 'All', label: 'All consignors owed' }, ...consignorsOwed.map((c) => ({ value: c.id, label: `#${c.number} · ${c.firstName} ${c.lastName}` }))] },
    { key: 'sort', label: 'Sort', value: sort, onChange: setSort, ariaLabel: 'Sort payouts', options: [{ value: 'amount', label: 'Highest amount due' }, { value: 'name', label: 'Consignor name' }, { value: 'oldest', label: 'Oldest unpaid sale' }] },
    ...(tier2Enabled ? [{ key: 'source', label: 'Sale source', value: sourceFilter, onChange: setSourceFilter, ariaLabel: 'Filter by sale source', options: SOURCE_OPTIONS }] : []),
  ];
  return <>
    <div className="consignment-payouts-summary-grid"><div className="consignment-card consignment-payouts-summary-card"><span>Total due</span><strong>{money(totalDue)}</strong></div><div className="consignment-card consignment-payouts-summary-card"><span>Consignors to pay</span><strong>{groupedEntries.length}</strong></div></div>
    <ConsignmentFilterBar search={{ value: query, onChange: setQuery, placeholder: 'Search item, SKU, or consignor' }} filters={filters} views={{ value: viewMode, onChange: setViewMode, ariaLabel: 'Choose payouts view', options: [{ value: 'list', label: 'All items', icon: List }, { value: 'grouped', label: 'By consignor', icon: Users }, { value: 'grid', label: 'Grid', icon: Grid3X3 }] }} />
    {filtered.length === 0 && <section className="consignment-card"><div className="consignment-empty-small">Nothing outstanding — every sale is paid out.</div></section>}
    {viewMode === 'list' && filtered.length > 0 && <AllListView saleSourceMode items={filtered} consignors={consignors} onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} onStartPayout={onStartPayout} />}
    {viewMode === 'grouped' && <div className="consignment-item-groups">{groupedEntries.map(([consignorId, consignorItems]) => <AllConsignorView saleSourceMode key={consignorId} consignor={consignorById[consignorId]} items={consignorItems} itemLabel="unpaid sale" onOpenConsignor={onOpenConsignor} onOpenItem={onOpenItem} onStartPayout={onStartPayout} />)}</div>}
    {viewMode === 'grid' && filtered.length > 0 && <div className="consignment-readable-grid">{filtered.map((item) => <ItemGridCardContainer saleSourceMode key={item.id} item={item} consignor={consignorById[item.consignorId]} showConsignor onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} onStartPayout={onStartPayout} />)}</div>}
  </>;
}

function HistoryTab({
  items,
  consignors,
  onOpenItem,
  onOpenConsignor,
  tier2Enabled,}) {  
    const [query, setQuery] = useState('');
    const [consignorFilter, setConsignorFilter] = useState('All');
    const [sourceFilter, setSourceFilter] = useState(() => tier2Enabled ? 'All' : 'Manual');
    const [sort, setSort] = useState('newest');
    const [expanded, setExpanded] = useState(() => new Set());
    const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));
    const groups = recordedPayoutGroups(items).map((group) => { const consignor = consignorById[group.consignorId] || consignorById[group.items[0]?.consignorId]; const total = group.payoutTotal || group.items.reduce((sum, item) => sum + Number(item.payoutAmount || 0), 0); return { ...group, consignor, total }; });
    const filtered = groups.filter((group) => {
    const q = query.trim().toLowerCase();
    const name = group.consignor ? `${group.consignor.firstName} ${group.consignor.lastName} #${group.consignor.number}` : '';
    const matchesQuery = !q || `${name} ${group.payoutMethod} ${group.payoutReference}`.toLowerCase().includes(q);
    const matchesConsignor = consignorFilter === 'All' || group.consignorId === consignorFilter;
    const matchesSource = sourceFilter === 'All' || group.items.some((item) => saleSourceMatches(item, sourceFilter));
    return matchesQuery && matchesConsignor && matchesSource;
  }).sort((a, b) => { if (sort === 'oldest') return String(a.payoutDate || '').localeCompare(String(b.payoutDate || '')); if (sort === 'amount') return b.total - a.total; return String(b.payoutDate || '').localeCompare(String(a.payoutDate || '')); });
  const totalPaid = groups.reduce((sum, group) => sum + group.total, 0);
  function toggle(payoutId) { setExpanded((current) => { const next = new Set(current); if (next.has(payoutId)) next.delete(payoutId); else next.add(payoutId); return next; }); }
  const filters = [
    { key: 'consignor', label: 'Consignor', value: consignorFilter, onChange: setConsignorFilter, ariaLabel: 'Filter by consignor', options: [{ value: 'All', label: 'All consignors paid' }, ...consignors.map((c) => ({ value: c.id, label: `#${c.number} · ${c.firstName} ${c.lastName}` }))] },
    { key: 'sort', label: 'Sort', value: sort, onChange: setSort, ariaLabel: 'Sort payout history', options: [{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'amount', label: 'Highest amount' }] },
    ...(tier2Enabled ? [{ key: 'source', label: 'Sale source', value: sourceFilter, onChange: setSourceFilter, ariaLabel: 'Filter by sale source', options: SOURCE_OPTIONS }] : []),
    { key: 'payoutStatus', label: 'Payout status', value: 'Paid', onChange: () => {}, disabled: true, ariaLabel: 'Payout status', options: [{ value: 'Paid', label: 'Paid (recorded)' }] },
  ];
  return <>
    <div className="consignment-payouts-summary-grid"><div className="consignment-card consignment-payouts-summary-card"><span>Total paid out</span><strong>{money(totalPaid)}</strong></div><div className="consignment-card consignment-payouts-summary-card"><span>Payouts recorded</span><strong>{groups.length}</strong></div></div>
    <ConsignmentFilterBar search={{ value: query, onChange: setQuery, placeholder: 'Search consignor, method, or reference' }} filters={filters} />
    {filtered.length === 0 && <section className="consignment-card"><div className="consignment-empty-small">No payouts recorded yet.</div></section>}
{filtered.length > 0 && (
  <div className="consignment-payouts-history-list">
    {filtered.map((group) => {
      const isOpen = expanded.has(group.payoutId);

      return (
        <div
          key={group.payoutId}
          className="consignment-payouts-history-card"
        >
          <button
            type="button"
            className="consignment-payouts-history-summary"
            onClick={() => toggle(group.payoutId)}
            aria-expanded={isOpen}
          >
            <span className="consignment-payouts-history-who">
              {group.consignor ? (
                <>
                  <strong>
                    {group.consignor.firstName} {group.consignor.lastName}
                  </strong>
                  <span>#{group.consignor.number}</span>
                </>
              ) : (
                <strong>Unknown consignor</strong>
              )}
            </span>

            <span className="consignment-payouts-history-meta">
              <strong>{group.payoutDate || '-'}</strong>
              <span>
                {group.payoutMethod || 'Method not recorded'}
                {group.payoutReference
                  ? ` - ${group.payoutReference}`
                  : ''}
              </span>
            </span>

            <span className="consignment-payouts-history-amount">
              <strong>{money(group.total)}</strong>
              <span>
                {group.items.length} item
                {group.items.length === 1 ? '' : 's'}
              </span>
            </span>

            <ChevronDown
              size={18}
              className={`consignment-payouts-history-chevron ${
                isOpen ? 'open' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {isOpen && (
            <div className="consignment-payouts-history-items">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="consignment-payouts-history-item"
                >
                  <span className="consignment-payouts-history-item-main">
                    <strong
                      className="consignment-link-button"
                      role="link"
                      tabIndex={0}
                      onClick={() => onOpenItem?.(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          onOpenItem?.(item.id);
                        }
                      }}
                    >
                      {item.description || item.itemNumber}
                    </strong>

                    <span>{item.itemNumber}</span>
                  </span>

                  <span className="consignment-payouts-history-item-sale">
                    {money(item.salePrice ?? item.price)}
                  </span>

                  <span className="consignment-payouts-history-item-earned">
                    {money(item.payoutAmount)}
                  </span>
                </div>
              ))}

              {Boolean(group.payoutAdjustment) && (
                <div className="consignment-payouts-history-if-adjustment">
                  <span>Manual adjustment</span>
                  <span>{money(group.payoutAdjustment)}</span>
                </div>
              )}

              {group.consignor && (
                <div style={{ padding: '10px 0 12px' }}>
                  <button
                    type="button"
                    className="consignment-link-button"
                    onClick={() =>
                      onOpenConsignor?.(group.consignor.id)
                    }
                  >
                    View consignor
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      );
    })}
  </div>
)}  </>;
}

export default function PayoutsScreen({ items, consignors, onOpenItem, onOpenConsignor, onStartPayout, tier2Enabled = false }) {
  const [tab, setTab] = useState('owed');
  return <><Header eyebrow="Payments" title="Payouts" /><div className="consignment-body"><div className="consignment-payouts-tabs" role="tablist" aria-label="Payouts view"><button type="button" role="tab" aria-selected={tab === 'owed'} className={`consignment-payouts-tab ${tab === 'owed' ? 'active' : ''}`} onClick={() => setTab('owed')}><Users size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Outstanding</button><button type="button" role="tab" aria-selected={tab === 'history'} className={`consignment-payouts-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}><Clock size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Payout History</button></div>{tab === 'owed' && <OwedTab items={items} consignors={consignors} onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} onStartPayout={onStartPayout} tier2Enabled={tier2Enabled} />}{tab === 'history' && <HistoryTab items={items} consignors={consignors} onOpenItem={onOpenItem} onOpenConsignor={onOpenConsignor} tier2Enabled={tier2Enabled} />}</div></>;
}
