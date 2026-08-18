/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useState, useEffect } from 'react';
import {
  Search, Plus, ArrowLeft, Camera, X, ChevronRight, ChevronDown,
  Loader2, Tag, Check, Trash2, ShoppingBag, LayoutDashboard,
  Users, ReceiptText, WalletCards, PackageSearch, TrendingUp, CircleDollarSign,
  CalendarDays, FileUp, Download, List, Grid3X3, ArrowUp,
} from 'lucide-react';
import {
  createConsignor,
  createConsignmentItems,
  deleteConsignor,
  syncShopifyProduct,
  deleteConsignmentItem,
  getConsignmentData,
  recordConsignorPayout,
  searchShopifyCategories,
  updateConsignmentItem,
  updateConsignmentItemStatus,
  updateConsignor,
  importConsignmentData,
} from './consignmentApi';
import ReportsScreen from './reports';
import './styles/consignment-manager.css';
import './styles/consignment-shared-components.css';
import {
  CATEGORIES,
  CONDITIONS,
  money,
  productLabel,
  statusClass,
  statusLabel,
  productAdminUrl,
  parseCsv,
  downloadCsv,
  exportConsignors,
  exportItems,
} from './lib/consignmentHelpers';
import { Header, PhotoPicker, MetricCard } from './components/consignment/SharedPieces';
import AppNavigation from './components/consignment/AppNavigation';
import DashboardScreen from './pages/consignment/DashboardScreen';
import ConsignorsScreen from './pages/consignment/ConsignorsScreen';
import ConsignorsDashboard from './pages/consignment/ConsignorsDashboard';
import NewConsignorPage from './pages/consignment/NewConsignorPage';
import EditConsignorPage from './pages/consignment/EditConsignorPage';
import ItemsScreen from './pages/consignment/ItemsScreen';
import SalesScreen from './pages/consignment/SalesScreen';
import AddConsignorItem from './pages/consignment/AddConsignorItem';
import PayoutScreen from './pages/consignment/PayoutScreen';

/* ---------- shared components now live in their own files:
   AppNavigation      -> ./components/consignment/AppNavigation.jsx
   Header/PhotoPicker/MetricCard -> ./components/consignment/SharedPieces.jsx
   DashboardScreen       -> ./pages/consignment/DashboardScreen.jsx
   ConsignorsScreen      -> ./pages/consignment/ConsignorsScreen.jsx
   ConsignorsDashboard -> ./pages/consignment/ConsignorsDashboard.jsx
   NewConsignorPage     -> ./pages/consignment/NewConsignorPage.jsx
   EditConsignorPage    -> ./pages/consignment/EditConsignorPage.jsx
   ItemsScreen           -> ./pages/consignment/ItemsScreen.jsx
   SalesScreen           -> ./pages/consignment/SalesScreen.jsx
   CSS                -> ./styles/consignment-manager.css +
                          ./styles/consignment-shared-components.css
   ---------- */

function PayoutsScreen({ items, consignors, onOpenConsignor, onStartPayout }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('amount');
  const [viewMode, setViewMode] = useState('list');
  const [tab, setTab] = useState('outstanding');
  const [expandedPayoutId, setExpandedPayoutId] = useState('');
  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));
  const unpaidSales = items.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut);
  const rows = consignors
    .map((consignor) => {
      const sales = unpaidSales.filter((item) => item.consignorId === consignor.id);
      const due = sales.reduce((sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100, 0);
      return { consignor, sales, due };
    })
    .filter((entry) => entry.sales.length > 0)
    .filter(({ consignor }) => {
      const q = query.trim().toLowerCase();
      return !q || `${consignor.firstName} ${consignor.lastName} ${consignor.number}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === 'name') return `${a.consignor.lastName} ${a.consignor.firstName}`.localeCompare(`${b.consignor.lastName} ${b.consignor.firstName}`);
      if (sort === 'oldest') return String(a.sales[0]?.dateSold || '').localeCompare(String(b.sales[0]?.dateSold || ''));
      return b.due - a.due;
    });
  const allConsignorRows = consignors
    .map((consignor) => {
      const sales = items.filter((item) => item.consignorId === consignor.id);
      const due = sales.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut).reduce((sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100, 0);
      return { consignor, sales, due };
    })
    .filter(({ consignor }) => {
      const q = query.trim().toLowerCase();
      return !q || `${consignor.firstName} ${consignor.lastName} ${consignor.number}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === 'amount') return b.due - a.due;
      return `${a.consignor.lastName} ${a.consignor.firstName}`.localeCompare(`${b.consignor.lastName} ${b.consignor.firstName}`);
    });
  const displayedRows = viewMode === 'list' ? rows : allConsignorRows;
  const totalDue = rows.reduce((sum, entry) => sum + entry.due, 0);
  const payoutHistory = Object.values(items.filter((item) => item.paidOut && item.payoutId).reduce((groups, item) => {
    if (!groups[item.payoutId]) groups[item.payoutId] = { ...item, items: [], amount: item.payoutTotal || 0 };
    groups[item.payoutId].items.push(item);
    return groups;
  }, {})).sort((a, b) => String(b.payoutDate || '').localeCompare(String(a.payoutDate || '')));

  return (
    <>
      <Header eyebrow="Payments" title="Payouts" />
      <div className="consignment-body consignment-payouts-page">
        <div className="consignment-status-row">
          <button type="button" className={`consignment-chip ${tab === 'outstanding' ? 'active' : ''}`} onClick={() => setTab('outstanding')}>Outstanding</button>
          <button type="button" className={`consignment-chip ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
            Payout history <span className="consignment-tab-count">{payoutHistory.length}</span>
          </button>
        </div>
        {tab === 'outstanding' && (
          <>
            <div className="consignment-payout-summary">
              <div className="consignment-summary-box"><span>Total due</span><strong>{money(totalDue)}</strong></div>
              <div className="consignment-summary-box"><span>Consignors to pay</span><strong>{rows.length}</strong></div>
            </div>
            <div className="consignment-items-toolbar">
              <details className="consignment-items-filter-details">
                <summary className="consignment-items-filter-summary"><span>Filters &amp; sorting</span><ChevronDown size={20} aria-hidden="true" /></summary>
                <div className="consignment-items-toolbar-top">
                  <label className="consignment-tool-field"><span>Sort</span>
                    <select className="consignment-select consignment-filter-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort payouts">
                      <option value="amount">Highest amount due</option>
                      <option value="name">Consignor name</option>
                      <option value="oldest">Oldest unpaid sale</option>
                    </select>
                  </label>
                </div>
              </details>
              <div className="consignment-items-toolbar-bottom">
                <div className="consignment-search">
                  <Search size={17} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search consignor or number" />
                </div>
                <div className="consignment-tool-view">
                  <span>View</span>
                  <div className="consignment-view-toggle consignment-finder-toggle" aria-label="Choose payout view">
                    <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}><List size={16} /> All payouts</button>
                    <button type="button" className={viewMode === 'grouped' ? 'active' : ''} onClick={() => setViewMode('grouped')} aria-pressed={viewMode === 'grouped'}><Users size={16} /> By consignor</button>
                    <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'}><Grid3X3 size={16} /> Grid</button>
                  </div>
                </div>
              </div>
            </div>
            {viewMode !== 'grid' && (
              <section className="consignment-card consignment-payout-list list">
                <div className="consignment-section-title">
                  <h2>{viewMode === 'grouped' ? 'All consignors' : 'Consignors with payouts due'}</h2>
                  <CalendarDays size={18} color="var(--muted)" />
                </div>
                {displayedRows.length === 0 && <div className="consignment-empty-small">{viewMode === 'grouped' ? 'No consignors match this search.' : 'There are no eligible unpaid sales.'}</div>}
                {viewMode === 'grouped' && displayedRows.map(({ consignor, sales, due }) => {
                  const availableCount = sales.filter((item) => item.status === 'Available' || item.status === 'Active').length;
                  const unpaidCount = sales.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut).length;
                  return (
                    <details className="consignment-payout-row consignment-payout-group" open={unpaidCount > 0} key={consignor.id}>
                      <summary className="consignment-payout-group-summary">
                        <ChevronRight size={16} className="consignment-payout-chev" aria-hidden="true" />
                        <span className="consignment-payout-person" role="button" tabIndex={0} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenConsignor(consignor.id); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); onOpenConsignor(consignor.id); } }}>
                          <span className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</span>
                          <span className="consignment-row-main">
                            <span className="consignment-row-name">{consignor.firstName} {consignor.lastName}</span>
                            <span className="consignment-row-sub">#{consignor.number} · {sales.length} item{sales.length === 1 ? '' : 's'}</span>
                          </span>
                        </span>
                        <span className="consignment-payout-group-stat"><strong>{availableCount}</strong><span>Available</span></span>
                        <span className="consignment-payout-group-stat"><strong>{unpaidCount}</strong><span>Unpaid</span></span>
                        <span className="consignment-payout-action">
                          <strong className="consignment-payout-amount">{money(due)}</strong>
                          <button type="button" className="consignment-btn" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onStartPayout(consignor.id); }}>Go to payout</button>
                        </span>
                      </summary>
                      {sales.length > 0 && (
                        <div className="consignment-payout-all-items">
                          {sales.map((item) => (
                            <div className="consignment-history-item" key={item.id}>
                              <span className="consignment-batch-thumb">{item.photo ? <img src={item.photo} alt="" /> : <Tag size={16} color="var(--green-dark)" />}</span>
                              <span className="consignment-history-item-copy"><strong>{item.description || item.itemNumber}</strong><span>SKU {item.itemNumber} · {item.status || 'Draft'} · {money(item.salePrice ?? item.price)}</span></span>
                              <span className={`consignment-badge ${item.paidOut ? 'paid' : ''}`}>{item.paidOut ? 'Paid' : ((item.status === 'Sold' || item.dateSold) ? 'Unpaid' : 'Not sold')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </details>
                  );
                })}
                {viewMode === 'list' && displayedRows.map(({ consignor, sales, due }) => (
                  <div key={consignor.id} className="consignment-payout-row">
                    <button type="button" className="consignment-payout-person" onClick={() => onOpenConsignor(consignor.id)}>
                      <div className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</div>
                      <div className="consignment-row-main">
                        <div className="consignment-row-name">{consignor.firstName} {consignor.lastName}</div>
                        <div className="consignment-row-sub">#{consignor.number} · {sales.length} eligible item{sales.length === 1 ? '' : 's'}</div>
                      </div>
                    </button>
                    <div className="consignment-payout-action">
                      <strong className="consignment-payout-amount">{money(due)}</strong>
                      {due > 0 && <button type="button" className="consignment-btn" onClick={() => onStartPayout(consignor.id)}>Review & pay</button>}
                    </div>
                  </div>
                ))}
              </section>
            )}
            {viewMode === 'grid' && (
              <>
                {displayedRows.length === 0 && <section className="consignment-card"><div className="consignment-empty-small">No consignors match this search.</div></section>}
                <div className="consignment-consignor-card-grid">
                  {displayedRows.map(({ consignor, sales, due }) => {
                    const availableCount = sales.filter((item) => item.status === 'Available' || item.status === 'Active').length;
                    const unpaidCount = sales.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut).length;
                    const paidCount = sales.filter((item) => item.paidOut).length;
                    return (
                      <article className="consignment-consignor-card" key={consignor.id}>
                        <div className="consignment-consignor-card-top">
                          <span className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</span>
                          <span className="consignment-consignor-card-name"><strong>{consignor.firstName} {consignor.lastName}</strong><small>#{consignor.number} · {sales.length} item{sales.length === 1 ? '' : 's'}</small></span>
                        </div>
                        <div className="consignment-consignor-card-stats stats-3">
                          <span><strong>{availableCount}</strong><small>Available</small></span>
                          <span><strong>{unpaidCount}</strong><small>Unpaid</small></span>
                          <span><strong>{paidCount}</strong><small>Paid</small></span>
                        </div>
                        <div className="consignment-consignor-card-due"><small>Total due</small><strong>{money(due)}</strong></div>
                        <button type="button" className="consignment-consignor-card-open" onClick={() => onStartPayout(consignor.id)}>Go to payout</button>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
        {tab === 'history' && (
          <section className="consignment-history-list">
            {payoutHistory.length === 0 && <div className="consignment-empty-small">Recorded payouts will appear here.</div>}
            {payoutHistory.map((payout) => {
              const consignor = consignorById[payout.consignorId];
              const consignorName = consignor ? `${consignor.firstName} ${consignor.lastName}` : 'Unknown consignor';
              const expanded = expandedPayoutId === payout.payoutId;
              return (
                <article className="consignment-history-card" key={payout.payoutId}>
                  <button type="button" className="consignment-history-card-summary" onClick={() => setExpandedPayoutId(expanded ? '' : payout.payoutId)} aria-expanded={expanded}>
                    <span className="consignment-avatar">{consignor?.firstName?.[0] || '?'}{consignor?.lastName?.[0] || ''}</span>
                    <span className="consignment-history-card-copy">
                      {consignor ? (
                        <span className="consignment-history-consignor-link" role="link" tabIndex={0} onClick={(event) => { event.stopPropagation(); onOpenConsignor(consignor.id); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onOpenConsignor(consignor.id); } }}>{consignorName} · #{consignor.number}</span>
                      ) : <strong>{consignorName}</strong>}
                      <span>{payout.payoutDate || 'Date not recorded'} · {payout.items.length} item{payout.items.length === 1 ? '' : 's'}</span>
                    </span>
                    <span className="consignment-history-card-amount"><strong>{money(payout.amount)}</strong><span>{payout.payoutMethod || 'Method not recorded'}</span></span>
                    <span className="consignment-badge paid">Paid</span>
                    <ChevronRight size={17} color="var(--muted)" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }} />
                  </button>
                  {expanded && (
                    <div className="consignment-history-card-details">
                      <div className="consignment-history-meta">
                        <div><span>Paid to</span><strong>{consignorName}</strong></div>
                        <div><span>Payment method</span><strong>{payout.payoutMethod || 'Not recorded'}</strong></div>
                        <div><span>Reference</span><strong>{payout.payoutReference || payout.payoutId}</strong></div>
                      </div>
                      {payout.items.map((item) => {
                        const salePrice = Number(item.salePrice ?? item.price ?? 0);
                        const rate = Number(item.commissionPct ?? consignor?.commissionPct ?? 0);
                        return (
                          <div className="consignment-history-item" key={item.id}>
                            <span className="consignment-batch-thumb">{item.photo ? <img src={item.photo} alt="" /> : <Tag size={16} color="var(--green-dark)" />}</span>
                            <span className="consignment-history-item-copy"><strong>{item.description || item.itemNumber}</strong><span>{item.itemNumber} · {item.orderName || 'No order reference'} · {money(salePrice)} × {rate}%</span></span>
                            <strong>{money(item.payoutAmount)}</strong>
                          </div>
                        );
                      })}
                      {Number(payout.payoutAdjustment || 0) !== 0 && <div className="consignment-history-note">Manual adjustment: {money(payout.payoutAdjustment)}</div>}
                      {payout.payoutNote && <div className="consignment-history-note">Note: {payout.payoutNote}</div>}
                      {payout.payoutMethod === 'Store credit' && <div className="consignment-history-note"><strong>Store credit recorded:</strong> {money(payout.amount)}</div>}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </>
  );
}

function CreatePayoutScreen({ consignor, items, onBack, onRecordPayout }) {
  const eligible = items.filter((item) => item.consignorId === consignor.id && (item.status === 'Sold' || item.dateSold) && !item.paidOut);
  const [selectedIds, setSelectedIds] = useState(() => eligible.map((item) => item.id));
  const [adjustment, setAdjustment] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('E-transfer');
  const [reference, setReference] = useState('');
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const selected = eligible.filter((item) => selectedIds.includes(item.id));
  const itemTotal = selected.reduce((sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100, 0);
  const payoutTotal = itemTotal + Number(adjustment || 0);

  function toggleItem(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  }

  return (
    <>
      <Header eyebrow={`Consignor #${consignor.number}`} title="Create payout" onBack={onBack} />
      <div className="consignment-body consignment-payout-create-body">
        <div className="consignment-section-grid">
          <section>
            <div className="consignment-card">
              <div className="consignment-section-title">
                <div><h2>{consignor.firstName} {consignor.lastName}</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>Default commission: {consignor.commissionPct}%</p></div>
                <div className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</div>
              </div>
            </div>
            <div className="consignment-card">
              <div className="consignment-section-title">
                <div><h2>Items in this payout</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>Select the eligible sales to include.</p></div>
                <button type="button" className="consignment-link-button" onClick={() => setSelectedIds(selectedIds.length === eligible.length ? [] : eligible.map((item) => item.id))}>{selectedIds.length === eligible.length ? 'Exclude all' : 'Select all'}</button>
              </div>
              {eligible.length === 0 && <div className="consignment-empty-small">This consignor has no eligible unpaid sales.</div>}
              {eligible.map((item) => {
                const salePrice = Number(item.salePrice ?? item.price ?? 0);
                const rate = Number(item.commissionPct ?? consignor.commissionPct ?? 0);
                const due = (salePrice * rate) / 100;
                return (
                  <label key={item.id} className="consignment-row-btn" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleItem(item.id)} style={{ width: 18, height: 18, accentColor: 'var(--green)' }} />
                    <span className="consignment-item-primary" style={{ flex: 1 }}>
                      <span className="consignment-batch-thumb">{item.photo ? <img src={item.photo} alt="" /> : <Tag size={16} color="var(--green-dark)" />}</span>
                      <span><strong>{item.description || item.itemNumber}</strong><span>{item.orderName || item.itemNumber} · {money(salePrice)} × {rate}%</span></span>
                    </span>
                    <strong>{money(due)}</strong>
                  </label>
                );
              })}
            </div>
          </section>
          <aside>
            <div className="consignment-card">
              <div className="consignment-section-title"><h2>Payout summary</h2></div>
              <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Selected sales</span><strong>{selected.length}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Consignor earnings</span><strong>{money(itemTotal)}</strong></div>
                <div className="consignment-field" style={{ margin: '4px 0 0' }}><label className="consignment-label">Manual adjustment</label><input className="consignment-input" type="number" inputMode="decimal" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} placeholder="0.00" /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 16 }}><strong>Amount due</strong><strong>{money(payoutTotal)}</strong></div>
              </div>
            </div>
            <div className="consignment-card">
              <div className="consignment-field"><label className="consignment-label">Payment method</label><select className="consignment-select" value={method} onChange={(event) => setMethod(event.target.value)}><option>E-transfer</option><option>Cash</option><option>Cheque</option><option>Store credit</option><option>Other</option></select></div>
              {method === 'Store credit' && <div className="consignment-store-credit-note"><CircleDollarSign size={17} /><span>This records the amount as store credit in the payout ledger and on each linked Shopify product.</span></div>}
              <div className="consignment-payout-fields">
                <div className="consignment-field"><label className="consignment-label">Payout date</label><input className="consignment-input" type="date" value={payoutDate} onChange={(event) => setPayoutDate(event.target.value)} /></div>
                <div className="consignment-field"><label className="consignment-label">Reference</label><input className="consignment-input" value={reference} onChange={(event) => setReference(event.target.value)} placeholder={method === 'Store credit' ? 'Credit memo or note' : 'Optional confirmation #'} /></div>
              </div>
              <label className="consignment-label">Payout note</label><textarea className="consignment-textarea" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional payment reference or note" />
            </div>
            <button type="button" className="consignment-btn" disabled={!selected.length || saving} onClick={async () => { setSaving(true); try { await onRecordPayout({ consignorId: consignor.id, itemIds: selectedIds, adjustment: Number(adjustment || 0), payoutDate, method, reference, note }); } finally { setSaving(false); } }}><WalletCards size={17} /> Record payout</button>
          </aside>
        </div>
      </div>
    </>
  );
}

function ChooseConsignorScreen({ consignors, onBack, onChoose, onCreate }) {
  const [search, setSearch] = useState('');
  const filtered = consignors.filter((consignor) => {
    const query = search.trim().toLowerCase();
    return !query || `${consignor.firstName} ${consignor.lastName} ${consignor.number}`.toLowerCase().includes(query);
  });

  return (
    <>
      <Header eyebrow="New item" title="Choose consignor" onBack={onBack} />
      <div className="consignment-body">
        <button type="button" className="consignment-quick-action primary" onClick={onCreate} style={{ width: '100%', marginBottom: 14 }}>
          <span className="consignment-quick-action-icon"><Plus size={19} /></span>
          <span className="consignment-quick-action-copy"><strong>Create new consignor</strong><span>Add their details, then continue directly to the item</span></span>
        </button>
        <div className="consignment-search"><Search size={17} /><input placeholder="Search name or consignor number" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        {filtered.map((consignor) => (
          <button key={consignor.id} type="button" className="consignment-row-btn" onClick={() => onChoose(consignor.id)}>
            <div className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</div>
            <div className="consignment-row-main"><div className="consignment-row-name">{consignor.firstName} {consignor.lastName}</div><div className="consignment-row-sub">Consignor #{consignor.number}</div></div>
            <ChevronRight size={18} className="consignment-chev" />
          </button>
        ))}
        {filtered.length === 0 && <div className="consignment-empty"><h3>No matching consignor</h3><p>Create a new consignor to continue.</p></div>}
      </div>
    </>
  );
}

function ImportScreen({ kind, onBack, onImport, fixedConsignor = null }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [localError, setLocalError] = useState('');
  const [saving, setSaving] = useState(false);
  const isConsignors = kind === 'consignors';
  const required = isConsignors ? 'consignor_import_key, first_name, last_name; item_description and price when the row contains an item' : fixedConsignor ? 'item_description, price' : 'consignor_import_key (or email/phone), item_description, price';
  const templateConsignorNumber = fixedConsignor?.number || 1;
  const itemColumns = 'item_import_key,item_description,price,category,item_type,brand,size,condition,item_notes,status,date_received,consignment_term,expiry_action,create_shopify_product,shopify_title,shopify_price,shopify_description,shopify_vendor,shopify_tags,publish_to_pos,publish_online,seo_title,seo_description,sale_price,sale_date,payout_status';
  const template = isConsignors
    ? `consignor_import_key,first_name,last_name,phone,email,address,city,province,postal_code,date_joined,commission_pct,unsold_preference,consignor_notes,${itemColumns}\
jane-smith-9055550100,Jane,Smith,905-555-0100,jane@example.com,123 Main Street,Hamilton,Ontario,L8E 1A1,2026-07-30,50,Please return,,jane-001,Blue winter coat,45.00,Clothing,Jacket,Gap,Medium,Like new,,Available,2026-07-30,90,Please return,true,Blue winter coat,45.00,Warm blue winter coat,Gap,winter|coat,true,true,Blue winter coat,Warm blue winter coat for sale,,,`
    : fixedConsignor
      ? `${itemColumns},consignor_number\
item-001,Blue baby sweater,18.00,Clothing,Sweater,Gap,12M,Good,,Available,2026-07-30,60,Please return,true,Blue baby sweater,18.00,Soft blue baby sweater,Gap,baby|sweater,true,false,Blue baby sweater,Soft blue baby sweater,,,${templateConsignorNumber}`
      : `consignor_import_key,email,phone,${itemColumns}\
jane-smith-9055550100,jane@example.com,905-555-0100,jane-001,Blue winter coat,45.00,Clothing,Jacket,Gap,Medium,Like new,,Available,2026-07-30,90,Please return,true,Blue winter coat,45.00,Warm blue winter coat,Gap,winter|coat,true,true,Blue winter coat,Warm blue winter coat for sale,,,`;

  function downloadTemplate() {
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${kind}-import-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      let parsed = parseCsv(await file.text());
      if (!isConsignors && fixedConsignor) parsed = parsed.map((row) => ({ ...row, consignor_number: fixedConsignor.number }));
      setRows(parsed);
      setFileName(file.name);
      setLocalError('');
    } catch (error) {
      setRows([]);
      setFileName(file.name);
      setLocalError(error.message);
    }
  }

  return (
    <>
      <Header eyebrow="Data import" title={isConsignors ? 'Import consignors and items' : fixedConsignor ? `Import items for ${fixedConsignor.firstName} ${fixedConsignor.lastName}` : 'Import items'} onBack={onBack} />
      <div className="consignment-body">
        <div className="consignment-card"><strong style={{ fontSize: 14 }}>Start with the template</strong><p className="consignment-import-help">Required columns: {required}. The app assigns consignor and item numbers automatically. Keep the headings unchanged, fill in your rows, then save as CSV.{fixedConsignor && !isConsignors ? ` Every row will be assigned to consignor #${fixedConsignor.number}.` : ''}</p><button className="consignment-btn secondary" onClick={downloadTemplate}><Download size={16} /> Download template</button></div>
        <div className="consignment-import-drop"><label><FileUp size={24} /><span>{fileName || 'Choose CSV file'}</span><input type="file" accept=".csv,text/csv" onChange={chooseFile} /></label><div className="consignment-import-help">Nothing is imported until you review the count and press Import.</div></div>
        {localError && <div className="consignment-card" style={{ color: 'var(--danger)' }}>{localError}</div>}
        {rows.length > 0 && (
          <><div className="consignment-import-preview"><div><span>File</span><strong style={{ fontSize: 12 }}>{fileName}</strong></div><div><span>Rows ready</span><strong>{rows.length}</strong></div><div><span>Importing</span><strong style={{ fontSize: 13 }}>{isConsignors ? 'Consignors + items · Shopify supported' : 'Items · Shopify supported'}</strong></div></div><div className="consignment-import-actions"><button className="consignment-btn" disabled={saving} onClick={async () => { setSaving(true); try { await onImport(kind, rows); } finally { setSaving(false); } }}>{saving ? <Loader2 className="consignment-spin" size={16} /> : <FileUp size={16} />} Import {rows.length} row{rows.length === 1 ? '' : 's'}</button></div></>
        )}
      </div>
    </>
  );
}

function ShopifyProductFields({ form, setForm }) {
  const [categorySearch, setCategorySearch] = useState(form.shopifyCategoryName || '');
  const [categoryResults, setCategoryResults] = useState([]);
  const [searchingCategories, setSearchingCategories] = useState(false);
  useEffect(() => {
    const query = categorySearch.trim();
    if (query.length < 2 || query === form.shopifyCategoryName) { setCategoryResults([]); return undefined; }
    const timer = setTimeout(() => { setSearchingCategories(true); searchShopifyCategories(query).then(setCategoryResults).catch(() => setCategoryResults([])).finally(() => setSearchingCategories(false)); }, 350);
    return () => clearTimeout(timer);
  }, [categorySearch, form.shopifyCategoryName]);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  return <div className="consignment-shopify-fields"><div className="consignment-detail-grid"><div className="consignment-field wide"><label className="consignment-label">Shopify title *</label><input className="consignment-input" value={form.shopifyTitle || ''} onChange={set('shopifyTitle')} placeholder="Required Shopify product title" /></div><div className="consignment-field"><label className="consignment-label">Shopify price</label><input className="consignment-input" type="number" inputMode="decimal" min="0" step="0.01" value={form.shopifyPrice ?? ''} onChange={set('shopifyPrice')} placeholder="Defaults to the manual item price" /></div><div className="consignment-field"><label className="consignment-label">Vendor</label><input className="consignment-input" value={form.vendor} onChange={set('vendor')} placeholder="Defaults to store name" /></div><div className="consignment-field"><label className="consignment-label">Tags</label><input className="consignment-input" value={form.tags} onChange={set('tags')} placeholder="summer, baby" /></div><div className="consignment-field wide"><label className="consignment-label">Shopify product category</label><input className="consignment-input" value={categorySearch} onChange={(event) => { setCategorySearch(event.target.value); if (event.target.value !== form.shopifyCategoryName) setForm((current) => ({ ...current, shopifyCategoryId: '', shopifyCategoryName: '' })); }} placeholder="Search Shopify categories" />{searchingCategories && <div className="consignment-row-sub" style={{ marginTop: 6 }}>Searching Shopify…</div>}{categoryResults.length > 0 && <div className="consignment-category-results">{categoryResults.map((category) => <button key={category.id} type="button" className="consignment-category-result" onClick={() => { setForm((current) => ({ ...current, shopifyCategoryId: category.id, shopifyCategoryName: category.name })); setCategorySearch(category.name); setCategoryResults([]); }}>{category.name}</button>)}</div>}{form.shopifyCategoryId && <div className="consignment-selected-category"><span>{form.shopifyCategoryName}</span><button type="button" className="consignment-batch-remove" aria-label="Remove Shopify category" onClick={() => { setForm((current) => ({ ...current, shopifyCategoryId: '', shopifyCategoryName: '' })); setCategorySearch(''); }}><X size={13} /></button></div>}</div><div className="consignment-field wide"><label className="consignment-label">Product description</label><textarea className="consignment-textarea" rows={3} value={form.productDescription} onChange={set('productDescription')} placeholder="Shown to customers on Shopify" /></div><div className="consignment-field"><label className="consignment-label">SEO title</label><input className="consignment-input" value={form.seoTitle} onChange={set('seoTitle')} placeholder="Defaults to item title" /></div><div className="consignment-field"><label className="consignment-label">SEO description</label><textarea className="consignment-textarea" rows={2} value={form.seoDescription} onChange={set('seoDescription')} placeholder="Optional search description" /></div></div></div>;
}

function ManualItemCore({ form, setForm, onSave, saveLabel = 'Save manual item', saveDisabled = false, helperText = 'Saves only the consignment metaobject record. No Shopify product is created.' }) {
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setCategory = (category) => setForm((current) => ({ ...current, category, type: '' }));
  return <div className="consignment-card"><div className="consignment-intake-primary-fields"><div className="consignment-field"><label className="consignment-label">Item description *</label><input className="consignment-input" value={form.description} onChange={set('description')} placeholder="What is it?" /></div><div className="consignment-field"><label className="consignment-label">Price *</label><input className="consignment-input" type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={set('price')} placeholder="0.00" /></div></div><div style={{ height: 1, background: 'var(--line)', margin: '18px 0' }} /><div className="consignment-section-heading"><label className="consignment-label">Consignment item information</label><span className="consignment-row-sub">Manual metaobject record</span></div><div className="consignment-detail-grid"><div className="consignment-field"><label className="consignment-label">Category</label><select className="consignment-select" value={form.category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></div><div className="consignment-field"><label className="consignment-label">Brand</label><input className="consignment-input" value={form.brand} onChange={set('brand')} placeholder="e.g. Gap" /></div><div className="consignment-field"><label className="consignment-label">Size</label><input className="consignment-input" value={form.size} onChange={set('size')} placeholder="Optional" /></div><div className="consignment-field"><label className="consignment-label">Condition</label><select className="consignment-select" value={form.condition} onChange={set('condition')}>{CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</select></div><div className="consignment-field"><label className="consignment-label">Consignment term</label><select className="consignment-select" value={form.consignmentTerm || ''} onChange={set('consignmentTerm')}><option value="">No term</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></div><div className="consignment-field wide"><label className="consignment-label">Internal notes</label><textarea className="consignment-textarea" rows={2} value={form.notes} onChange={set('notes')} placeholder="Notes about this consigned item" /></div></div><div style={{ height: 1, background: 'var(--line)', margin: '18px 0' }} /><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}><div><strong style={{ display: 'block', fontSize: 14 }}>Manual consignment record</strong><span className="consignment-row-sub" style={{ display: 'block', marginTop: 3 }}>{helperText}</span></div><button className="consignment-btn" disabled={saveDisabled} onClick={onSave}><Check size={18} /> {saveLabel}</button></div></div>;
}

function ShopifyProductSection({ shopifyForm, setShopifyForm, linkedProductId = '', linkedStatus = '', disabled = false, onSync = null, syncing = false, tier2Enabled = true }) {
  const canSync = Boolean(onSync) && tier2Enabled;
  return <details className="consignment-card consignment-shopify-section" open={Boolean(linkedProductId)}><summary className="consignment-shopify-summary"><span><ShoppingBag size={17} /><strong>Shopify product</strong></span><span className="consignment-row-sub">{!tier2Enabled ? 'Requires Manual + Shopify Sync plan' : linkedProductId ? 'Connected' : 'Separate optional workflow'}</span></summary><div className="consignment-shopify-content">{!tier2Enabled && <div className="consignment-shopify-upsell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-muted, #f5f5f5)', border: '1px solid var(--border, #e2e2e2)' }}><span style={{ fontSize: 13 }}>Creating and syncing Shopify products is part of the <strong>Manual + Shopify Sync</strong> plan.</span><a className="consignment-btn" style={{ flexShrink: 0 }} href="/app/plans" target="_top">Upgrade plan</a></div>}<p className="consignment-shopify-help">This section only controls the linked Shopify product. Manual item saving never creates or updates a Shopify product.</p><div className="consignment-shopify-photo-row"><PhotoPicker value={shopifyForm.photo} onChange={(value) => setShopifyForm((current) => ({ ...current, photo: value }))} /><ShopifyProductFields form={shopifyForm} setForm={setShopifyForm} /></div><label className="consignment-product-choice"><input type="checkbox" checked={shopifyForm.publishToPos !== false} onChange={(event) => setShopifyForm((current) => ({ ...current, publishToPos: event.target.checked }))} /><span><strong>Create Shopify product</strong><span>Creates or updates an Active product with inventory of one and publishes it to Point of Sale.</span></span></label><label className="consignment-product-choice online"><input type="checkbox" checked={shopifyForm.publishOnline === true} onChange={(event) => setShopifyForm((current) => ({ ...current, publishOnline: event.target.checked }))} /><span><strong>Also publish to Online Store</strong><span>Publishes the same synced product to the Online Store.</span></span></label>{linkedProductId && <p style={{ margin: '12px 0 0', color: 'var(--green-dark)', fontSize: 12 }}><Check size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Linked Shopify product · {linkedStatus || 'Connected'}</p>}{!linkedProductId ? <button className="consignment-btn" style={{ marginTop: 14 }} disabled={!canSync || disabled || syncing || shopifyForm.publishToPos === false || !String(shopifyForm.shopifyTitle || '').trim()} onClick={onSync}>{syncing ? <Loader2 className="consignment-spin" size={16} /> : <ShoppingBag size={16} />}Create Shopify product</button> : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}><button className="consignment-btn" disabled={!canSync || disabled || syncing || shopifyForm.publishToPos === false || !String(shopifyForm.shopifyTitle || '').trim()} onClick={onSync}>{syncing ? <Loader2 className="consignment-spin" size={16} /> : <Check size={16} />}Update Shopify product</button><a className="consignment-btn secondary" href={productAdminUrl(linkedProductId)} target="_top"><span aria-hidden="true">↗</span> Edit in Shopify</a></div>}{linkedProductId && <div className="consignment-row-sub" style={{ marginTop: 8 }}>Changes made in Shopify are loaded back into this section whenever the app refreshes. Changes made here are sent to Shopify with “Update Shopify product”.</div>}{tier2Enabled && !canSync && <div className="consignment-row-sub" style={{ marginTop: 8 }}>Fill in the item description and price above — the manual record saves automatically when you create the Shopify product here.</div>}</div></details>;
}

function IntakeScreen({ consignor, items, onBack, onSaveBatch, onSaveAndSync, tier2Enabled = false }) {
  const emptyForm = { category: 'Clothing', type: '', description: '', size: '', condition: 'Good', price: '', brand: '', notes: '', consignmentTerm: '' };
  const emptyShopifyForm = { photo: null, shopifyTitle: '', shopifyPrice: '', tags: '', vendor: '', productDescription: '', shopifyCategoryId: '', shopifyCategoryName: '', seoTitle: '', seoDescription: '', publishToPos: true, publishOnline: false };
  const [form, setForm] = useState(emptyForm);
  const [shopifyForm, setShopifyForm] = useState(emptyShopifyForm);
  const [batch, setBatch] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const canAdd = form.description.trim() && form.price !== '';
  const saveCount = batch.length + (canAdd ? 1 : 0);
  const savedSequence = items.filter((item) => item.consignorId === consignor.id && item.itemNumber.startsWith(`${consignor.number}-`)).reduce((max, item) => Math.max(max, Number(item.itemNumber.split('-').pop()) || 0), 0);
  const nextItemNumber = `${consignor.number}-${String(savedSequence + batch.length + 1).padStart(3, '0')}`;
  function addToBatch() { if (!canAdd) return; setBatch((current) => [...current, form]); setForm({ ...emptyForm, category: form.category, brand: form.brand }); }
  return <><Header eyebrow={`For ${consignor.firstName} ${consignor.lastName} · #${consignor.number}`} title="Add items" onBack={onBack} /><div className="consignment-body">{batch.length > 0 && <div style={{ marginBottom: 18 }}><label className="consignment-label">Manual items ready to save ({batch.length})</label>{batch.map((entry, index) => <div key={`${entry.description}-${index}`} className="consignment-batch-item"><div className="consignment-batch-thumb"><Tag size={16} color="var(--green-dark)" /></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{entry.description}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{entry.category} · {money(entry.price)}</div></div><button className="consignment-batch-remove" onClick={() => setBatch((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove"><X size={14} /></button></div>)}</div>}<div className="consignment-section-heading"><label className="consignment-label">{batch.length > 0 ? 'Next manual item' : 'Manual consignment item'}</label><span className="consignment-item-number">{nextItemNumber}</span></div><ManualItemCore form={form} setForm={setForm} onSave={() => onSaveBatch(canAdd ? [...batch, form] : batch)} saveDisabled={saveCount === 0} saveLabel={saveCount === 1 ? 'Save manual item' : `Save ${saveCount} manual items`} /><button className="consignment-btn secondary consignment-add-another" disabled={!canAdd} onClick={addToBatch}><Plus size={16} /> Add another manual item</button><ShopifyProductSection shopifyForm={shopifyForm} setShopifyForm={setShopifyForm} tier2Enabled={tier2Enabled} syncing={syncing} onSync={canAdd ? async () => { setSyncing(true); try { await onSaveAndSync(form, batch, shopifyForm); } finally { setSyncing(false); } } : null} /></div></>;
}

function EditItemScreen({ item, onBack, onSave, onDelete, onSyncProduct, onUpdateStatus, tier2Enabled = false }) {
  const [form, setForm] = useState({ category: item.category || 'Other', type: '', description: item.description || '', size: item.size || '', condition: item.condition || 'Good', price: item.price ?? '', brand: item.brand || '', notes: item.notes || '', consignmentTerm: item.consignmentTerm || '' });
  const [shopifyForm, setShopifyForm] = useState({ photo: item.shopifyPhoto || item.photo || null, shopifyTitle: item.shopifyTitle || '', shopifyPrice: item.shopifyPrice ?? item.price ?? '', tags: Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || ''), vendor: item.vendor || '', productDescription: item.productDescription || '', shopifyCategoryId: item.shopifyCategoryId || '', shopifyCategoryName: item.shopifyCategoryName || '', seoTitle: item.seoTitle || '', seoDescription: item.seoDescription || '', publishToPos: true, publishOnline: item.publishOnline === true });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [salePrice, setSalePrice] = useState(item.salePrice ?? item.price ?? '');
  const [dateSold] = useState(item.dateSold || new Date().toISOString().slice(0, 10));
  const isSold = item.status === 'Sold' || Boolean(item.dateSold);
  const isPaid = item.paidOut === true;
  const canSave = form.description.trim() && form.price !== '';
  return <><Header eyebrow={`Item ${item.itemNumber}`} title="Edit item" onBack={onBack} /><div className="consignment-body"><div className="consignment-section-heading"><label className="consignment-label">Manual consignment item</label><span className="consignment-item-number">{item.itemNumber}</span></div><ManualItemCore form={form} setForm={setForm} onSave={() => onSave(item.id, form)} saveDisabled={!canSave || isSold} saveLabel="Save manual changes" helperText="Updates only the consignment item metaobject. Shopify product data and media are handled separately below." /><div className="consignment-status-card">{!isSold && <div className="consignment-manual-sale"><div className="consignment-manual-sale-copy"><strong>Manual sale</strong><span>Only use for a sale outside Shopify.</span></div><div className="consignment-manual-sale-controls"><div className="consignment-field"><label className="consignment-label">Sale price</label><input className="consignment-input" type="number" inputMode="decimal" min="0" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} /></div><button className="consignment-btn consignment-sold-btn" disabled={statusSaving || salePrice === ''} onClick={async () => { setStatusSaving(true); try { await onUpdateStatus(item.id, 'Sold', { salePrice, dateSold }); } finally { setStatusSaving(false); } }}>Sold</button></div></div>}{isSold && !isPaid && <div className="consignment-sold-status"><span className="consignment-badge unpaid">Sold · unpaid</span><span className="consignment-row-sub">Waiting in Payouts for payment.</span></div>}{isPaid && <div className="consignment-status-actions"><span className="consignment-badge paid">Paid</span><span className="consignment-paid-detail">{item.payoutDate || ''} · {item.payoutMethod || 'Payment recorded'} · {money(item.payoutAmount)}</span></div>}</div><ShopifyProductSection shopifyForm={shopifyForm} setShopifyForm={setShopifyForm} linkedProductId={item.shopifyProductId} linkedStatus={item.shopifyProductStatus} disabled={isSold} syncing={syncing} tier2Enabled={tier2Enabled} onSync={async () => { setSyncing(true); try { await onSyncProduct(item.id, shopifyForm); } finally { setSyncing(false); } }} />{!confirmingDelete ? <button className="consignment-btn secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger-soft)' }} onClick={() => setConfirmingDelete(true)}><Trash2 size={16} /> Delete item</button> : <div className="consignment-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 13 }}>Delete {item.itemNumber} and its linked Shopify product?</span><div style={{ display: 'flex', gap: 8 }}><button className="consignment-btn secondary" style={{ padding: '8px 14px' }} onClick={() => setConfirmingDelete(false)}>Cancel</button><button className="consignment-btn danger" style={{ padding: '8px 14px' }} onClick={() => onDelete(item.id)}>Delete</button></div></div>}</div></>;
}

export default function ConsignmentIntakeApp({ activePlan = null }) {
  const tier2Enabled = activePlan === 'TIER2';
  const [ready, setReady] = useState(false);
  const [consignors, setConsignors] = useState([]);
  const [items, setItems] = useState([]);
  const [view, setView] = useState('dashboard');
  const [activeId, setActiveId] = useState(null);
  const [activeItemId, setActiveItemId] = useState(null);
  const [query, setQuery] = useState('');
  const [newConsignorNext, setNewConsignorNext] = useState('consignor');
  const [newConsignorBack, setNewConsignorBack] = useState('home');
  const [importKind, setImportKind] = useState('consignors');
  const [importBack, setImportBack] = useState('home');
  const [importConsignorId, setImportConsignorId] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);

  function errorMessage(value, fallback) { return value instanceof Error ? value.message : fallback; }
  async function refreshData() { const data = await getConsignmentData(); setConsignors(data.consignors); setItems(data.items); return data; }
  useEffect(() => { refreshData().catch((e) => setError(errorMessage(e, 'Could not load Shopify data'))).finally(() => setReady(true)); }, []);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); document.querySelector('.consignment-body')?.scrollTo({ top: 0, left: 0, behavior: 'auto' }); setShowBackToTop(false); }, [view]);
  useEffect(() => { if (!ready) return undefined; const body = document.querySelector('.consignment-body'); const updateBackToTop = () => setShowBackToTop(window.scrollY > 280 || (body?.scrollTop || 0) > 280); updateBackToTop(); window.addEventListener('scroll', updateBackToTop, { passive: true }); body?.addEventListener('scroll', updateBackToTop, { passive: true }); return () => { window.removeEventListener('scroll', updateBackToTop); body?.removeEventListener('scroll', updateBackToTop); }; }, [ready, view]);
  function scrollToTop() { window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }); document.querySelector('.consignment-body')?.scrollTo({ top: 0, left: 0, behavior: 'smooth' }); }
  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2000); }
  async function handleNewConsignor(form) { try { setError(''); const consignor = await createConsignor(form); await refreshData(); flash(`Consignor #${consignor.number} added`); setActiveId(consignor.id); setView(newConsignorNext); } catch (e) { setError(errorMessage(e, 'Could not save consignor')); } }
  async function handleImport(kind, rows) { try { setError(''); const result = await importConsignmentData(kind, rows); await refreshData(); if (kind === 'consignors') flash(`${result.consignorsCreated || 0} created, ${result.consignorsUpdated || 0} matched/updated, ${result.itemsImported || 0} items imported, ${result.shopifyProductsCreated || 0} Shopify products created`); else { const importedCount = result.itemsImported ?? result.imported; flash(`${importedCount} item${importedCount === 1 ? '' : 's'} imported, ${result.shopifyProductsCreated || 0} Shopify products created`); } setView(importBack); } catch (e) { setError(errorMessage(e, 'Could not import this CSV')); throw e; } }
  function startImport(kind, backView, consignorId = null) { setImportKind(kind); setImportBack(backView); setImportConsignorId(consignorId); setView('import'); }
  async function handleSaveBatch(batch) { try { setError(''); const saved = await createConsignmentItems(activeId, batch); await refreshData(); flash(`${saved.length} item${saved.length === 1 ? '' : 's'} saved`); setView('consignor'); } catch (e) { setError(errorMessage(e, 'Could not save items')); } }
  async function handleSaveAndSync(currentEntry, queuedBatch, shopifyForm) { try { setError(''); const saved = await createConsignmentItems(activeId, [...queuedBatch, currentEntry]); const newItem = saved[saved.length - 1]; await syncShopifyProduct(newItem.id, shopifyForm); await refreshData(); flash(`${saved.length} item${saved.length === 1 ? '' : 's'} saved · Shopify product created`); setView('consignor'); } catch (e) { setError(errorMessage(e, 'Could not save the item and create the Shopify product')); throw e; } }
  async function handleUpdateConsignor(consignorId, form) { try { setError(''); await updateConsignor(consignorId, form); await refreshData(); flash('Consignor updated'); setView('consignor'); } catch (e) { setError(errorMessage(e, 'Could not update consignor')); } }
  async function handleDeleteConsignor(consignorId) { try { setError(''); await deleteConsignor(consignorId); await refreshData(); setActiveId(null); setView('home'); flash('Consignor deleted'); } catch (e) { setError(errorMessage(e, 'Could not delete consignor')); } }
  async function handleDeleteItem(itemId) { try { setError(''); await deleteConsignmentItem(itemId); await refreshData(); flash('Item deleted'); } catch (e) { setError(errorMessage(e, 'Could not delete item')); } }
  async function handleUpdateItem(itemId, form) { try { setError(''); await updateConsignmentItem(itemId, form); await refreshData(); flash('Item updated'); setView('consignor'); } catch (e) { setError(errorMessage(e, 'Could not update item')); } }
  async function handleUpdateItemStatus(itemId, status, details = {}) { try { setError(''); await updateConsignmentItemStatus(itemId, status, details); await refreshData(); flash(status === 'Paid' ? 'Item marked paid' : status === 'Sold' ? 'Item marked sold · unpaid' : 'Item returned to available'); } catch (e) { setError(errorMessage(e, 'Could not update item status')); throw e; } }
  async function handleSyncProduct(itemId, shopifyForm) { try { setError(''); await syncShopifyProduct(itemId, shopifyForm); await refreshData(); flash('Shopify product synced'); } catch (e) { setError(errorMessage(e, 'Could not sync the Shopify product')); throw e; } }
  async function handleRecordPayout(payout) { try { setError(''); const result = await recordConsignorPayout(payout); await refreshData(); flash(`Payout of ${money(result.payout.total)} recorded`); setView('payouts'); } catch (e) { setError(errorMessage(e, 'Could not record payout')); throw e; } }
  async function handleDeleteItemFromEdit(itemId) { await handleDeleteItem(itemId); setView('consignor'); }

  const activeConsignor = consignors.find((c) => c.id === activeId);
  const activeItem = items.find((i) => i.id === activeItemId);
  const nextConsignorNumber = Math.max(0, ...consignors.map((consignor) => Number(consignor.number) || 0)) + 1;
  const navigationView = ['newConsignor', 'chooseConsignor', 'consignor', 'intake', 'editConsignor'].includes(view) ? 'home' : view === 'editItem' ? 'items' : view === 'createPayout' ? 'payouts' : view;
  function navigate(viewName) { setError(''); setView(viewName); }
  function openConsignor(id) { setActiveId(id); setView('consignor'); }
  function openItem(id) { const item = items.find((entry) => entry.id === id); setActiveItemId(id); if (item?.consignorId) setActiveId(item.consignorId); setView('editItem'); }
  function startNewConsignor(nextView = 'consignor', backView = 'home') { setNewConsignorNext(nextView); setNewConsignorBack(backView); setView('newConsignor'); }
  function startNewItem() { if (!consignors.length) { startNewConsignor('intake', 'dashboard'); return; } setView('chooseConsignor'); }

  return (
    <div className="consignment">
      {ready && <AppNavigation view={navigationView} onNavigate={navigate} />}
      {toast && <div className="consignment-toast"><Check size={14} /> {toast}</div>}
      {error && <div className="consignment-toast" style={{ background: 'var(--danger)', top: 12 }}><X size={14} /> {error}</div>}
      {!ready && <div className="consignment-loading"><Loader2 className="consignment-spin" size={22} /></div>}
      {ready && view === 'dashboard' && <DashboardScreen consignors={consignors} items={items} onOpenConsignor={openConsignor} onNavigate={navigate} onNewConsignor={() => startNewConsignor('consignor', 'dashboard')} onNewItem={startNewItem} onImport={() => startImport('consignors', 'dashboard')} onExport={() => exportConsignors(consignors)} />}
      {ready && view === 'home' && <ConsignorsScreen consignors={consignors} items={items} query={query} setQuery={setQuery} onOpenConsignor={openConsignor} onOpenItem={openItem} onMarkSold={(itemId, details) => handleUpdateItemStatus(itemId, 'Sold', details)} onNewConsignor={() => startNewConsignor('consignor', 'home')} onNewItem={startNewItem} onImport={() => startImport('consignors', 'home')} onExport={() => exportConsignors(consignors)} />}
      {ready && view === 'items' && <ItemsScreen items={items} consignors={consignors} onOpenItem={openItem} onOpenConsignor={openConsignor} onMarkSold={(itemId, details) => handleUpdateItemStatus(itemId, 'Sold', details)} onStartPayout={(consignorId) => { setActiveId(consignorId); setView('createPayout'); }} onNewItem={startNewItem} />}
      {ready && view === 'sales' && <SalesScreen items={items} consignors={consignors} onOpenConsignor={openConsignor} onStartPayout={(consignorId) => { setActiveId(consignorId); setView('createPayout'); }} />}
      {ready && view === 'payouts' && (
        <PayoutScreen
          items={items}
          consignors={consignors}
          onOpenConsignor={openConsignor}
          onOpenItem={openItem}
          onStartPayout={(consignorId) => {
            setActiveId(consignorId);
            setView('createPayout');
          }}
        />
      )}
      {ready && view === 'reports' && <ReportsScreen items={items} consignors={consignors} onOpenConsignor={openConsignor} onStartPayout={(consignorId) => { setActiveId(consignorId); setView('createPayout'); }} />}
      {ready && view === 'createPayout' && activeConsignor && <CreatePayoutScreen consignor={activeConsignor} items={items} onBack={() => setView('payouts')} onRecordPayout={handleRecordPayout} />}
      {ready && view === 'import' && <ImportScreen kind={importKind} fixedConsignor={consignors.find((entry) => entry.id === importConsignorId) || null} onBack={() => setView(importBack)} onImport={handleImport} />}
      {ready && view === 'newConsignor' && <NewConsignorPage onBack={() => setView(newConsignorBack)} onSave={handleNewConsignor} nextNumber={nextConsignorNumber} />}
      {ready && view === 'chooseConsignor' && <ChooseConsignorScreen consignors={consignors} onBack={() => setView('dashboard')} onChoose={(consignorId) => { setActiveId(consignorId); setView('intake'); }} onCreate={() => startNewConsignor('intake', 'chooseConsignor')} />}
      {ready && view === 'consignor' && activeConsignor && <ConsignorsDashboard consignor={activeConsignor} items={items} onBack={() => setView('home')} onStartIntake={() => setView('intake')} onOpenItem={openItem} onDeleteConsignor={handleDeleteConsignor} onEditConsignor={() => setView('editConsignor')} onStartPayout={(consignorId) => { setActiveId(consignorId); setView('createPayout'); }} />}
      {ready && view === 'editConsignor' && activeConsignor && <EditConsignorPage consignor={activeConsignor} onBack={() => setView('consignor')} onSave={handleUpdateConsignor} />}
      {ready && view === 'intake' && activeConsignor && <IntakeScreen consignor={activeConsignor} items={items} onBack={() => setView('consignor')} onSaveBatch={handleSaveBatch} onSaveAndSync={handleSaveAndSync} tier2Enabled={tier2Enabled} />}
      {ready && view === 'editItem' && activeItem && <EditItemScreen item={activeItem} onBack={() => setView('consignor')} onSave={handleUpdateItem} onDelete={handleDeleteItemFromEdit} onSyncProduct={handleSyncProduct} onUpdateStatus={handleUpdateItemStatus} tier2Enabled={tier2Enabled} />}
      {ready && showBackToTop && <button className="consignment-back-to-top" type="button" onClick={scrollToTop} aria-label="Back to top" title="Back to top"><ArrowUp size={20} aria-hidden="true" /></button>}
    </div>
  );
}