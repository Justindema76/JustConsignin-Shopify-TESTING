/* eslint-disable react/prop-types */
import { useState } from 'react';
import { ChevronDown, Grid3X3, List, Mail, MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import Header from '../../components/consignment/Header';
import AllListView from '../../components/consignment/AllListView';
import ItemGridCardContainer from '../../components/consignment/ItemGridCardContainer';
import ConsignmentFilterBar from '../../components/consignment/ConsignmentFilterBar';
import { isSold, money } from '../../lib/consignmentHelpers';

export default function ConsignorDashboard({ consignor, items, onBack, onStartIntake, onOpenItem, onDeleteConsignor, onEditConsignor, onStartPayout }) {
  const [viewMode, setViewMode] = useState('grid');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Available');
  const [confirmingDeleteConsignor, setConfirmingDeleteConsignor] = useState(false);

  const consignorItems = items.filter((item) => item.consignorId === consignor.id);
  const soldItems = consignorItems.filter((item) => isSold(item));
  const availableItems = consignorItems.filter((item) => !isSold(item));
  const unpaidItems = soldItems.filter((item) => !item.paidOut);
  const paidItems = soldItems.filter((item) => item.paidOut);
  const totalSales = soldItems.reduce((sum, item) => sum + Number(item.salePrice ?? item.price ?? 0), 0);
  const amountDue = unpaidItems.reduce(
    (sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100,
    0,
  );

  const filteredItems = consignorItems.filter((item) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || `${item.description || ''} ${item.itemNumber || ''} ${item.type || ''} ${item.brand || ''}`
      .toLowerCase()
      .includes(q);
    const sold = isSold(item);
    const matchesStatus = statusFilter === 'All'
      || (statusFilter === 'Available' && !sold)
      || (statusFilter === 'SoldUnpaid' && sold && !item.paidOut)
      || (statusFilter === 'PaidArchived' && item.paidOut);
    return matchesQuery && matchesStatus;
  }).sort((a, b) => {
    const itemDate = (item) => String(
      item.dateSold
      || item.dateReceived
      || item.createdAt
      || item.created_at
      || '',
    );

    return itemDate(b).localeCompare(itemDate(a));
  });
  const fullAddress = [consignor.address, consignor.city, consignor.province, consignor.postalCode]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Header
        eyebrow={`Consignor #${consignor.number}`}
        title={`${consignor.firstName} ${consignor.lastName}`}
        onBack={onBack}
        action={(
          <div className="consignment-header-actions consignment-consignor-header-actions">
            <button className="consignment-btn consignment-consignor-add-items" onClick={onStartIntake}>
              <Plus size={17} /> Add items
            </button>
            <button className="consignment-btn secondary consignment-consignor-edit" onClick={onEditConsignor}>
              <Pencil size={17} /> Edit
            </button>
            <button
              className="consignment-btn danger consignment-consignor-delete"
              onClick={() => setConfirmingDeleteConsignor(true)}
            >
              <Trash2 size={17} /> Delete
            </button>
          </div>
        )}
      />
      <div className="consignment-body">
        <details className="consignment-card consignment-consignor-profile-details">
          <summary className="consignment-consignor-profile-summary">
            <span>Contact &amp; account details</span>
            <ChevronDown size={20} aria-hidden="true" />
          </summary>
          <section className="consignment-consignor-profile" aria-label="Consignor profile information">
            <div className="consignment-profile-row">
              <span className="consignment-profile-icon"><Phone size={17} /></span>
              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">Phone</span>
                {consignor.phone ? <a className="consignment-profile-value consignment-profile-link" href={`tel:${String(consignor.phone).replace(/[^\d+]/g, '')}`}>{consignor.phone}</a> : <span className="consignment-profile-value">—</span>}
              </span>
            </div>
            <div className="consignment-profile-row">
              <span className="consignment-profile-icon"><Mail size={17} /></span>
              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">Email</span>
                {consignor.email ? <a className="consignment-profile-value consignment-profile-link" href={`mailto:${consignor.email}`}>{consignor.email}</a> : <span className="consignment-profile-value">—</span>}
              </span>
            </div>
            <div className="consignment-profile-row">
              <span className="consignment-profile-icon"><MapPin size={17} /></span>
              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">Address</span>
                {fullAddress ? <a className="consignment-profile-value consignment-profile-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer">{fullAddress}</a> : <span className="consignment-profile-value">—</span>}
              </span>
            </div>
            <div className="consignment-profile-row detail"><span className="consignment-profile-copy"><span className="consignment-profile-label">Commission split</span><span className="consignment-profile-value">Consignor gets {consignor.commissionPct}%</span></span></div>
            <div className="consignment-profile-row detail"><span className="consignment-profile-copy"><span className="consignment-profile-label">Joined</span><span className="consignment-profile-value">{consignor.dateJoined || '—'}</span></span></div>
            <div className="consignment-profile-row detail"><span className="consignment-profile-copy"><span className="consignment-profile-label">Unsold items</span><span className="consignment-profile-value">{consignor.unsoldPreference || 'Please return'}</span></span></div>
          </section>
        </details>

        <div className="consignment-consignor-stats">
          <div className="consignment-consignor-stat"><span>Amount due</span><strong>{money(amountDue)}</strong></div>
          <div className="consignment-consignor-stat"><span>Total sales</span><strong>{money(totalSales)}</strong></div>
        </div>

        <div className="consignment-consignor-items-head">
          <h3>Items on file</h3>
          <nav className="consignment-consignor-status-tabs" aria-label="Filter consignor items by status">
            <button type="button" className={`consignment-consignor-status-tab${statusFilter === 'Available' ? ' active' : ''}`} onClick={() => setStatusFilter('Available')}>
              {availableItems.length} Available
            </button>
            <button type="button" className={`consignment-consignor-status-tab${statusFilter === 'SoldUnpaid' ? ' active' : ''}`} onClick={() => setStatusFilter('SoldUnpaid')}>
              {unpaidItems.length} Sold / Unpaid
            </button>
            <button type="button" className={`consignment-consignor-status-tab${statusFilter === 'PaidArchived' ? ' active' : ''}`} onClick={() => setStatusFilter('PaidArchived')}>
              {paidItems.length} Paid / Archived
            </button>
            <button type="button" className={`consignment-consignor-status-tab${statusFilter === 'All' ? ' active' : ''}`} onClick={() => setStatusFilter('All')}>
              {consignorItems.length} All
            </button>
          </nav>
        </div>

        <ConsignmentFilterBar
          search={{
            value: query,
            onChange: setQuery,
            placeholder: 'Search item, SKU, or brand',
          }}
          views={{
            value: viewMode,
            onChange: setViewMode,
            ariaLabel: 'Choose consignor item view',
            options: [
              { value: 'list', label: 'List', icon: List },
              { value: 'grid', label: 'Grid', icon: Grid3X3 },
            ],
          }}
        />

        {filteredItems.length === 0 && (
          <div className="consignment-empty">
            <h3>No items match these filters</h3>
            <p>Change the search or filter selections to see other items.</p>
          </div>
        )}

        {filteredItems.length > 0 && viewMode === 'list' && (
          <AllListView saleSourceMode items={filteredItems} consignors={[consignor]} onOpenItem={onOpenItem} onStartPayout={onStartPayout} />
        )}

        {filteredItems.length > 0 && viewMode === 'grid' && (
          <div className="consignment-readable-grid">
            {filteredItems.map((item) => (
              <ItemGridCardContainer saleSourceMode key={item.id} item={item} consignor={consignor} showConsignor={false} onOpenItem={onOpenItem} onStartPayout={onStartPayout} />
            ))}
          </div>
        )}

        {confirmingDeleteConsignor && (
          <div className="consignment-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>Delete {consignor.firstName} {consignor.lastName} for good?</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="consignment-btn secondary" style={{ padding: '8px 14px' }} onClick={() => setConfirmingDeleteConsignor(false)}>Cancel</button>
              <button className="consignment-btn danger" style={{ padding: '8px 14px' }} onClick={() => onDeleteConsignor(consignor.id)}>Delete</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
