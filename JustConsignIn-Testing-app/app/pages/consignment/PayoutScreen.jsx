import { useState } from 'react';
import { ChevronDown, ChevronRight, Grid3X3, List, Tag, Users } from 'lucide-react';
import { Header } from '../../components/consignment/SharedPieces';
import { SummaryStatRow, PageToolbar, EntityCard } from '../../components/consignment/PageBuildingBlocks';
import { money } from '../../lib/consignmentHelpers';

export default function PayoutScreen({ items, consignors, onOpenConsignor, onStartPayout }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('amount');
  const [viewMode, setViewMode] = useState('all');
  const [tab, setTab] = useState('outstanding');
  const [expandedPayoutId, setExpandedPayoutId] = useState('');

  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));
  const unpaidSales = items.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut);

  const outstandingRows = consignors
    .map((consignor) => {
      const sales = unpaidSales.filter((item) => item.consignorId === consignor.id);
      const due = sales.reduce(
        (sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100,
        0,
      );
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
      const due = sales
        .filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut)
        .reduce(
          (sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100,
          0,
        );
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

  const totalDue = outstandingRows.reduce((sum, entry) => sum + entry.due, 0);

  const payoutHistory = Object.values(
    items
      .filter((item) => item.paidOut && item.payoutId)
      .reduce((groups, item) => {
        if (!groups[item.payoutId]) groups[item.payoutId] = { ...item, items: [], amount: item.payoutTotal || 0 };
        groups[item.payoutId].items.push(item);
        return groups;
      }, {}),
  ).sort((a, b) => String(b.payoutDate || '').localeCompare(String(a.payoutDate || '')));

  const filtersSlot = (
    <details className="consignment-items-filter-details">
      <summary className="consignment-items-filter-summary">
        <span>Filters &amp; sorting</span>
        <ChevronDown size={20} aria-hidden="true" />
      </summary>
      <div className="consignment-items-toolbar-top">
        <label className="consignment-tool-field">
          <span>Sort</span>
          <select className="consignment-select consignment-filter-select" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="amount">Highest amount due</option>
            <option value="name">Consignor name</option>
            <option value="oldest">Oldest unpaid sale</option>
          </select>
        </label>
      </div>
    </details>
  );

  function payoutCard({ consignor, sales, due }) {
    const availableCount = sales.filter((item) => item.status === 'Available' || item.status === 'Active').length;
    const unpaidCount = sales.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut).length;
    const paidCount = sales.filter((item) => item.paidOut).length;

    return (
      <EntityCard
        key={consignor.id}
        title={`${consignor.firstName} ${consignor.lastName}`}
        subtitle={`Consignor #${consignor.number} · ${sales.length} item${sales.length === 1 ? '' : 's'}`}
        subtitleLabel={null}
        onOpen={() => onOpenConsignor(consignor.id)}
        metrics={[
          { label: 'Available', value: availableCount },
          { label: 'Unpaid', value: unpaidCount },
        ]}
        detailLabel="Paid items"
        detailValue={String(paidCount)}
        action={
          due > 0 ? (
            <button type="button" className="consignment-list-action" onClick={() => onStartPayout(consignor.id)}>
              Review &amp; pay
            </button>
          ) : paidCount > 0 ? (
            <span className="consignment-archive-note">Archived</span>
          ) : null
        }
        footNote={`Total due ${money(due)}`}
      />
    );
  }

  return (
    <>
      <Header eyebrow="Payments" title="Payouts" />
      <div className="consignment-body consignment-online-layout">
        <div className="consignment-status-row">
          <button type="button" className={`consignment-chip ${tab === 'outstanding' ? 'active' : ''}`} onClick={() => setTab('outstanding')}>
            Outstanding
          </button>
          <button type="button" className={`consignment-chip ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
            Payout history <span className="consignment-tab-count">{payoutHistory.length}</span>
          </button>
        </div>

        {tab === 'outstanding' && (
          <>
            <SummaryStatRow
              stats={[
                { label: 'Total due', value: money(totalDue) },
                { label: 'Consignors to pay', value: outstandingRows.length },
                { label: 'Unpaid sales', value: unpaidSales.length },
                { label: 'Recorded payouts', value: payoutHistory.length },
              ]}
            />

            <PageToolbar
              query={query}
              onQueryChange={setQuery}
              placeholder="Search consignor or number"
              filtersSlot={filtersSlot}
              viewOptions={[
                { key: 'all', label: 'All payouts', icon: List },
                { key: 'grouped', label: 'By consignor', icon: Users },
                { key: 'grid', label: 'Grid', icon: Grid3X3 },
              ]}
              activeView={viewMode}
              onViewChange={setViewMode}
            />

            {viewMode === 'all' && (
              <section className="consignment-list-table-wrap">
                <table className="consignment-list-table">
                  <thead>
                    <tr>
                      <th>Consignor</th>
                      <th>Eligible sales</th>
                      <th>Amount due</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingRows.map(({ consignor, sales, due }) => (
                      <tr key={consignor.id}>
                        <td>
                          <button type="button" className="consignment-consignor-link" onClick={() => onOpenConsignor(consignor.id)}>
                            {consignor.firstName} {consignor.lastName}
                          </button>
                          <small>Consignor #{consignor.number}</small>
                        </td>
                        <td>{sales.length}</td>
                        <td className="consignment-money">{money(due)}</td>
                        <td>
                          <button type="button" className="consignment-list-action" onClick={() => onStartPayout(consignor.id)}>
                            Review &amp; pay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {viewMode === 'grouped' && (
              <div>
                {allConsignorRows.map(({ consignor, sales, due }) => {
                  const unpaidCount = sales.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut).length;
                  const availableCount = sales.filter((item) => item.status === 'Available' || item.status === 'Active').length;
                  return (
                    <section className="consignment-list-group" key={consignor.id}>
                      <button type="button" className="consignment-list-group-head" onClick={() => onOpenConsignor(consignor.id)}>
                        <span className="consignment-list-chevron"><ChevronRight size={15} /></span>
                        <span className="consignment-list-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</span>
                        <span className="consignment-list-person">
                          <span>{consignor.firstName} {consignor.lastName}</span>
                          <small>Consignor #{consignor.number}</small>
                        </span>
                        <span className="consignment-list-stat"><strong>{availableCount}</strong><small>Available</small></span>
                        <span className="consignment-list-stat"><strong>{unpaidCount}</strong><small>Unpaid</small></span>
                        <span className="consignment-list-stat"><strong>{money(due)}</strong><small>Due</small></span>
                      </button>
                      {unpaidCount > 0 && (
                        <div className="consignment-list-group-body">
                          <div className="consignment-list-labels consignment-sales-columns">
                            <span>Item</span><span>Sale price</span><span>Due</span><span>Source</span><span>Payout</span><span>Action</span>
                          </div>
                          {sales.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut).map((item) => {
                            const salePrice = Number(item.salePrice ?? item.price ?? 0);
                            const itemDue = (salePrice * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100;
                            return (
                              <div className="consignment-list-row consignment-sales-columns" key={item.id}>
                                <div className="consignment-list-item-main"><strong>{item.description || item.itemNumber}</strong><small>#{item.itemNumber || '—'} · {item.dateSold || 'Sold'}</small></div>
                                <strong className="consignment-money">{money(salePrice)}</strong>
                                <strong className="consignment-money">{money(itemDue)}</strong>
                                <span><span className="consignment-badge manual">Manual</span></span>
                                <span><span className="consignment-badge unpaid">Unpaid</span></span>
                                <span><button type="button" className="consignment-list-action" onClick={() => onStartPayout(consignor.id)}>Review &amp; pay</button></span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}

            {viewMode === 'grid' && (
              <div className="consignment-readable-grid">
                {allConsignorRows.map(payoutCard)}
              </div>
            )}

            {outstandingRows.length === 0 && <div className="consignment-empty-small">There are no eligible unpaid sales.</div>}
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
                      <strong>{consignorName}</strong>
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

                      {payout.items.map((item) => (
                        <div className="consignment-history-item" key={item.id}>
                          <span className="consignment-batch-thumb">{item.photo ? <img src={item.photo} alt="" /> : <Tag size={16} color="var(--green-dark)" />}</span>
                          <span className="consignment-history-item-copy"><strong>{item.description || item.itemNumber}</strong><span>{item.itemNumber} · {item.orderName || 'No order reference'}</span></span>
                          <strong>{money(item.payoutAmount)}</strong>
                        </div>
                      ))}
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
