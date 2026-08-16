import {
  ChevronRight, Users, PackageSearch, TrendingUp, CircleDollarSign, FileUp, Download, Plus,
} from 'lucide-react';
import { Header, MetricCard } from '../../components/consignment/SharedPieces';
import { money } from '../../lib/consignmentHelpers';

export default function DashboardScreen({
  consignors,
  items,
  onOpenConsignor,
  onNavigate,
  onNewConsignor,
  onNewItem,
  onImport,
  onExport,
}) {
  const soldItems = items.filter((item) => item.status === 'Sold' || item.dateSold);
  const activeItems = items.filter((item) => ['Available', 'Active'].includes(item.status));
  const totalSales = soldItems.reduce((sum, item) => sum + Number(item.salePrice ?? item.price ?? 0), 0);
  const unpaidSales = soldItems.filter((item) => !item.paidOut);
  const amountDue = unpaidSales.reduce(
    (sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? 0)) / 100,
    0,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  const itemsWithExpiry = items.filter(
    (item) => item.expiryDate && !item.paidOut && (item.status === 'Available' || item.status === 'Active'),
  );
  const expiredItems = itemsWithExpiry.filter((item) => new Date(`${item.expiryDate}T00:00:00`) < today);
  const expiring7Items = itemsWithExpiry.filter((item) => {
    const d = new Date(`${item.expiryDate}T00:00:00`);
    return d >= today && d <= in7;
  });
  const expiring30Items = itemsWithExpiry.filter((item) => {
    const d = new Date(`${item.expiryDate}T00:00:00`);
    return d >= today && d <= in30;
  });

  const consignorBalances = consignors
    .map((consignor) => {
      const sales = unpaidSales.filter((item) => item.consignorId === consignor.id);
      const due = sales.reduce(
        (sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100,
        0,
      );
      return { consignor, sales, due };
    })
    .filter((entry) => entry.due > 0)
    .sort((a, b) => b.due - a.due);

  const recentSales = [...soldItems]
    .sort((a, b) => String(b.dateSold || '').localeCompare(String(a.dateSold || '')))
    .slice(0, 5);

  return (
    <>
      <Header
        eyebrow="Overview"
        title="Consignment dashboard"
        action={(
          <div className="consignment-header-actions">
            <button type="button" className="consignment-btn" onClick={onNewConsignor}>
              <Plus size={16} /> Add consignor
            </button>
            <button type="button" className="consignment-btn secondary" onClick={onNewItem}>
              <Plus size={16} /> Add item
            </button>
            <details className="consignment-data-menu">
              <summary className="consignment-btn secondary"><FileUp size={16} /> Import / Export</summary>
              <div className="consignment-data-menu-popover">
                <button type="button" onClick={onImport}><FileUp size={15} /> Import CSV</button>
                <button type="button" onClick={onExport}><Download size={15} /> Export CSV</button>
              </div>
            </details>
          </div>
        )}
      />
      <div className="consignment-body">
        <div className="consignment-toolbar" style={{ justifyContent: 'space-between' }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
            Live sales, inventory, and consignor balances from Shopify.
          </p>
          <div className="consignment-date-tabs" aria-label="Dashboard period">
            <button type="button">Week</button>
            <button type="button" className="active">Month</button>
            <button type="button">Year</button>
            <button type="button">All time</button>
          </div>
        </div>

        <div className="consignment-dashboard-grid">
          <MetricCard icon={PackageSearch} label="Active items" value={activeItems.length} note={`${items.length} items total`} onClick={() => onNavigate('items')} />
          <MetricCard icon={Users} label="Consignors" value={consignors.length} note={`${consignorBalances.length} with payouts due`} onClick={() => onNavigate('home')} />
          <MetricCard icon={TrendingUp} label="Consignment sales" value={money(totalSales)} note={`${soldItems.length} sold items`} onClick={() => onNavigate('sales')} />
          <MetricCard icon={CircleDollarSign} label="Payouts due" value={money(amountDue)} note={`${unpaidSales.length} unpaid sales`} onClick={() => onNavigate('payouts')} />
        </div>

        <section className="consignment-card" style={{ marginBottom: 20 }}>
          <div className="consignment-section-title">
            <h2>Consignment Expiry</h2>
          </div>
          <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 13 }}>
            Optional term tracking. Expired items stay in inventory until you choose an action.
          </p>
          <div className="consignment-dashboard-grid">
            <button type="button" className="consignment-expiry-stat" onClick={() => onNavigate('items')} style={{ textAlign: 'left', background: 'var(--card-bg, #fff)', border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px', cursor: 'pointer' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Expiring in 7 days</div>
              <div style={{ fontSize: 28, fontWeight: 700, margin: '6px 0' }}>{expiring7Items.length}</div>
              <span className="consignment-link-button">View items →</span>
            </button>
            <button type="button" className="consignment-expiry-stat" onClick={() => onNavigate('items')} style={{ textAlign: 'left', background: 'var(--card-bg, #fff)', border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px', cursor: 'pointer' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Expiring in 30 days</div>
              <div style={{ fontSize: 28, fontWeight: 700, margin: '6px 0' }}>{expiring30Items.length}</div>
              <span className="consignment-link-button">View items →</span>
            </button>
            <button type="button" className="consignment-expiry-stat" onClick={() => onNavigate('items')} style={{ textAlign: 'left', background: 'var(--card-bg, #fff)', border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px', cursor: 'pointer' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Expired</div>
              <div style={{ fontSize: 28, fontWeight: 700, margin: '6px 0', color: expiredItems.length > 0 ? '#c0392b' : undefined }}>{expiredItems.length}</div>
              <span className="consignment-link-button">{expiredItems.length > 0 ? 'Action required →' : 'View items →'}</span>
            </button>
          </div>
        </section>

        <div className="consignment-section-grid">
          <section className="consignment-card">
            <div className="consignment-section-title">
              <h2>Consignors with payouts due</h2>
              <button type="button" className="consignment-link-button" onClick={() => onNavigate('payouts')}>View payouts</button>
            </div>
            {consignorBalances.length === 0 ? (
              <div className="consignment-empty-small">No unpaid consignment sales yet.</div>
            ) : consignorBalances.slice(0, 6).map(({ consignor, sales, due }) => (
              <button key={consignor.id} type="button" className="consignment-row-btn" onClick={() => onOpenConsignor(consignor.id)}>
                <div className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</div>
                <div className="consignment-row-main">
                  <div className="consignment-row-name">{consignor.firstName} {consignor.lastName}</div>
                  <div className="consignment-row-sub">#{consignor.number} · {sales.length} unpaid sale{sales.length === 1 ? '' : 's'}</div>
                </div>
                <strong>{money(due)}</strong>
                <ChevronRight size={18} className="consignment-chev" />
              </button>
            ))}
          </section>

          <section className="consignment-card">
            <div className="consignment-section-title">
              <h2>Recent sales</h2>
              <button type="button" className="consignment-link-button" onClick={() => onNavigate('sales')}>View all</button>
            </div>
            {recentSales.length === 0 ? (
              <div className="consignment-empty-small">Paid Shopify orders will appear here automatically.</div>
            ) : recentSales.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: 13 }}>{item.description || item.itemNumber}</strong>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>{item.itemNumber} · {item.dateSold || 'Sold'}</span>
                </div>
                <strong style={{ fontSize: 13 }}>{money(item.salePrice ?? item.price)}</strong>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}