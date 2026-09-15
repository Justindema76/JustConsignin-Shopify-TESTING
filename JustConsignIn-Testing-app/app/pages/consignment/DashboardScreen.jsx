import { useState } from 'react';
import {
  ChevronRight,
  CircleDollarSign,
  Download,
  FileUp,
  PackageSearch,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react';

import { Header, MetricCard } from '../../components/consignment/SharedPieces';
import {
  EXPIRY_FILTERS,
  expiryFilterCount,
  money,
} from '../../lib/consignmentHelpers';
import '../../styles/consignment-dashboard.css';

const PERIODS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
];

function soldWithinPeriod(item, period, now = new Date()) {
  if (period === 'all') return true;
  if (!item.dateSold) return false;

  const soldDate = new Date(`${item.dateSold}T00:00:00`);
  if (Number.isNaN(soldDate.getTime())) return false;

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);

  if (period === 'week') start.setDate(start.getDate() - 6);
  if (period === 'month') start.setDate(start.getDate() - 29);
  if (period === 'year') start.setFullYear(start.getFullYear() - 1);

  return soldDate >= start && soldDate <= end;
}

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
  const [period, setPeriod] = useState('month');

  const soldItems = items.filter((item) => item.status === 'Sold' || item.dateSold);
  const periodSoldItems = soldItems.filter((item) => soldWithinPeriod(item, period));
  const activeItems = items.filter((item) => ['Available', 'Active'].includes(item.status));
  const totalSales = periodSoldItems.reduce(
    (sum, item) => sum + Number(item.salePrice ?? item.price ?? 0),
    0,
  );
  const unpaidSales = soldItems.filter((item) => !item.paidOut);
  const amountDue = unpaidSales.reduce(
    (sum, item) => sum +
      (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? 0)) / 100,
    0,
  );

  const consignorBalances = consignors
    .map((consignor) => {
      const sales = unpaidSales.filter((item) => item.consignorId === consignor.id);
      const due = sales.reduce(
        (sum, item) => sum +
          (Number(item.salePrice ?? item.price ?? 0) *
            Number(item.commissionPct ?? consignor.commissionPct ?? 0)) /
            100,
        0,
      );
      return { consignor, sales, due };
    })
    .filter((entry) => entry.due > 0)
    .sort((a, b) => b.due - a.due);

  const recentSales = [...periodSoldItems]
    .sort((a, b) => String(b.dateSold || '').localeCompare(String(a.dateSold || '')))
    .slice(0, 5);

  const expiryStats = [
    {
      label: '7 days',
      filter: EXPIRY_FILTERS.NEXT_7,
      count: expiryFilterCount(items, EXPIRY_FILTERS.NEXT_7),
    },
    {
      label: '30 days',
      filter: EXPIRY_FILTERS.NEXT_30,
      count: expiryFilterCount(items, EXPIRY_FILTERS.NEXT_30),
    },
    {
      label: 'Expired',
      filter: EXPIRY_FILTERS.EXPIRED,
      count: expiryFilterCount(items, EXPIRY_FILTERS.EXPIRED),
      alert: expiryFilterCount(items, EXPIRY_FILTERS.EXPIRED) > 0,
    },
  ];

  function navigateWithPageFilter(viewName, filters) {
    window.history.replaceState(
      { ...(window.history.state || {}), consignmentPageFilters: filters },
      '',
    );
    onNavigate(viewName);
  }

  return (
    <div className="consignment-dashboard-page">
      <Header
        eyebrow="Overview"
        title="Consignment dashboard"
        action={(
          <div className="consignment-dashboard-header-actions">
            <button type="button" className="consignment-btn" onClick={onNewConsignor}>
              <Plus size={16} /> Add consignor
            </button>
            <button type="button" className="consignment-btn secondary" onClick={onNewItem}>
              <Plus size={16} /> Add item
            </button>
            <button type="button" className="consignment-dashboard-data-btn" onClick={onImport}>
              <FileUp size={15} /> Import CSV
            </button>
            <button type="button" className="consignment-dashboard-data-btn" onClick={onExport}>
              <Download size={15} /> Export CSV
            </button>
          </div>
        )}
      />

      <div className="consignment-body consignment-dashboard-body">
        <div className="consignment-dashboard-context">
          <p>Live sales, inventory, and consignor balances from Shopify.</p>
          <div className="consignment-date-tabs" aria-label="Dashboard period">
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={period === option.value ? 'active' : ''}
                aria-pressed={period === option.value}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="consignment-dashboard-grid consignment-dashboard-metrics">
          <MetricCard icon={PackageSearch} label="Active items" value={activeItems.length} note={`${items.length} items total`} onClick={() => onNavigate('items')} />
          <MetricCard icon={Users} label="Consignors" value={consignors.length} note={`${consignorBalances.length} with payouts due`} onClick={() => onNavigate('home')} />
          <MetricCard icon={TrendingUp} label="Sales" value={money(totalSales)} note={`${periodSoldItems.length} sold items · ${PERIODS.find((entry) => entry.value === period)?.label}`} onClick={() => navigateWithPageFilter('sales', { period })} />
          <MetricCard icon={CircleDollarSign} label="Payouts due" value={money(amountDue)} note={`${unpaidSales.length} unpaid sales`} onClick={() => onNavigate('payouts')} />
        </div>

        <section className="consignment-card consignment-dashboard-expiry">
          <div className="consignment-section-title">
            <h2>Consignment expiry</h2>
          </div>
          <p className="consignment-dashboard-section-copy">
            Optional term tracking. Expired items stay in inventory until you choose an action.
          </p>
          <div className="consignment-dashboard-expiry-grid">
            {expiryStats.map((stat) => (
              <button
                type="button"
                className="consignment-expiry-stat"
                key={stat.label}
                onClick={() => navigateWithPageFilter('items', { expiry: stat.filter })}
              >
                <span className="consignment-dashboard-expiry-label">{stat.label}</span>
                <strong className={stat.alert ? 'alert' : ''}>{stat.count}</strong>
                <span className="consignment-link-button">View →</span>
              </button>
            ))}
          </div>
        </section>

        <div className="consignment-dashboard-lower-grid">
          <section className="consignment-card consignment-dashboard-compact-card">
            <div className="consignment-section-title">
              <h2>Payouts due</h2>
              <button type="button" className="consignment-link-button" onClick={() => onNavigate('payouts')}>View all</button>
            </div>
            {consignorBalances.length === 0 ? (
              <div className="consignment-empty-small">No unpaid consignment sales yet.</div>
            ) : consignorBalances.slice(0, 4).map(({ consignor, sales, due }) => (
              <button key={consignor.id} type="button" className="consignment-dashboard-summary-row" onClick={() => onOpenConsignor(consignor.id)}>
                <span>
                  <strong>{consignor.firstName} {consignor.lastName}</strong>
                  <small>#{consignor.number} · {sales.length} unpaid sale{sales.length === 1 ? '' : 's'}</small>
                </span>
                <strong>{money(due)}</strong>
                <ChevronRight size={16} />
              </button>
            ))}
          </section>

          <section className="consignment-card consignment-dashboard-compact-card">
            <div className="consignment-section-title">
              <h2>Recent sales</h2>
              <button type="button" className="consignment-link-button" onClick={() => navigateWithPageFilter('sales', { period })}>View all</button>
            </div>
            {recentSales.length === 0 ? (
              <div className="consignment-empty-small">No sales in the selected period.</div>
            ) : recentSales.map((item) => (
              <div key={item.id} className="consignment-dashboard-summary-row static">
                <span>
                  <strong>{item.description || item.itemNumber}</strong>
                  <small>{item.itemNumber} · {item.dateSold || 'Sold'}</small>
                </span>
                <strong>{money(item.salePrice ?? item.price)}</strong>
              </div>
            ))}
          </section>

          <section className="consignment-card consignment-dashboard-compact-card consignment-dashboard-reports-card">
            <div className="consignment-section-title">
              <h2>Reports</h2>
              <button type="button" className="consignment-link-button" onClick={() => onNavigate('reports')}>Open reports</button>
            </div>
            <button type="button" className="consignment-dashboard-report-link" onClick={() => onNavigate('reports')}>
              <span>
                <strong>Sales, payouts &amp; inventory</strong>
                <small>Open reporting and performance details</small>
              </span>
              <ChevronRight size={18} />
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
