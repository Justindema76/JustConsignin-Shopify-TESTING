import {
  LayoutDashboard, Users, PackageSearch, ReceiptText, WalletCards, TrendingUp, Tag,
} from 'lucide-react';

export default function AppNavigation({ view, onNavigate }) {
  const entries = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['home', 'Consignors', Users],
    ['items', 'Items', PackageSearch],
    ['sales', 'Sales', ReceiptText],
    ['payouts', 'Payouts', WalletCards],
    ['reports', 'Reports', TrendingUp],
  ];

  return (
    <nav className="consignment-main-nav" aria-label="Consignment manager">
      <div className="consignment-brand">
        <span className="consignment-brand-mark"><Tag size={18} /></span>
        JustConsignIn
      </div>
      {entries.map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          className={`consignment-nav-button ${view === key ? 'active' : ''}`}
          onClick={() => onNavigate(key)}
        >
          <Icon size={17} />
          {label}
        </button>
      ))}
    </nav>
  );
}
