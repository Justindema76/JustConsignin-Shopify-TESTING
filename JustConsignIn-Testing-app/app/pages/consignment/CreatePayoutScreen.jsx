/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useState } from 'react';
import { CircleDollarSign, WalletCards } from 'lucide-react';
import Header from '../../components/consignment/Header';
import { money } from '../../lib/consignmentHelpers';

function formatPayoutSoldDate(value) {
  if (!value) return '—';
  const date = new Date(
    String(value).includes('T') ? value : `${value}T00:00:00`,
  );
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function CreatePayoutScreen({
  consignor,
  items,
  onBack,
  onRecordPayout,
}) {
  const eligible = items.filter(
    (item) =>
      item.consignorId === consignor.id &&
      (item.status === 'Sold' || item.dateSold) &&
      !item.paidOut,
  );

  const [selectedIds, setSelectedIds] = useState(() =>
    eligible.map((item) => item.id),
  );
  const [adjustment, setAdjustment] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('E-transfer');
  const [reference, setReference] = useState('');
  const [payoutDate, setPayoutDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);

  const selected = eligible.filter((item) => selectedIds.includes(item.id));

  const itemTotal = selected.reduce((sum, item) => {
    const salePrice = Number(item.salePrice ?? item.price ?? 0);
    const commissionRate = Number(
      item.commissionPct ?? consignor.commissionPct ?? 0,
    );

    return sum + (salePrice * commissionRate) / 100;
  }, 0);

  const payoutTotal = itemTotal + Number(adjustment || 0);

  function toggleItem(id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }

  async function recordPayout() {
    setSaving(true);

    try {
      await onRecordPayout({
        consignorId: consignor.id,
        itemIds: selectedIds,
        adjustment: Number(adjustment || 0),
        payoutDate,
        method,
        reference,
        note,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header
        eyebrow={`Consignor #${consignor.number}`}
        title="Create payout"
        onBack={onBack}
      />

      <div className="consignment-body">
        <div className="consignment-form-shell consignment-payout-shell">
          <section className="consignment-form-section consignment-payout-card">
            <div className="consignment-payout-summary-grid">
              <div className="consignment-payout-summary-cell">
                <span className="consignment-label">Consignor</span>
                <strong>
                  {consignor.firstName} {consignor.lastName}
                </strong>
                <small>Default commission: {consignor.commissionPct}%</small>
              </div>

              <div className="consignment-payout-summary-cell">
                <span className="consignment-label">Selected sales</span>
                <strong>{selected.length}</strong>
                <small>Consignor earnings: {money(itemTotal)}</small>
              </div>

              <div className="consignment-payout-summary-cell">
                <span className="consignment-label">Amount due</span>
                <strong className="consignment-payout-total-value">
                  {money(payoutTotal)}
                </strong>
                <small>Includes manual adjustment</small>
              </div>
            </div>

            <div className="consignment-payout-section">
              <div className="consignment-payout-section-head">
                <div>
                  <h2>Items in this payout</h2>
                  <p>Select the eligible sold items to include.</p>
                </div>

                <button
                  type="button"
                  className="consignment-link-button"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.length === eligible.length
                        ? []
                        : eligible.map((item) => item.id),
                    )
                  }
                >
                  {selectedIds.length === eligible.length
                    ? 'Exclude all'
                    : 'Select all'}
                </button>
              </div>

              <div className="consignment-payout-items">
                {eligible.length === 0 && (
                  <div className="consignment-empty-small">
                    This consignor has no eligible unpaid sales.
                  </div>
                )}

                {eligible.map((item) => {
                  const salePrice = Number(item.salePrice ?? item.price ?? 0);
                  const rate = Number(
                    item.commissionPct ?? consignor.commissionPct ?? 0,
                  );
                  const due = (salePrice * rate) / 100;

                  return (
                    <label
                      key={item.id}
                      className="consignment-payout-item-row"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                      />

                      <span className="consignment-payout-item-main">
                        <strong>{item.description || item.itemNumber}</strong>
                        <span>
                          {item.orderName || item.itemNumber} · Sale{' '}
                          {money(salePrice)} · Sold{' '}
                          {formatPayoutSoldDate(item.dateSold)}
                        </span>
                      </span>

                      <span className="consignment-payout-item-rate">
                        <span className="consignment-label">Rate</span>
                        <strong>{rate}%</strong>
                      </span>

                      <strong className="consignment-payout-item-due">
                        {money(due)}
                      </strong>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="consignment-payout-section">
              <div className="consignment-payout-section-head">
                <div>
                  <h2>Payment details</h2>
                  <p>Record how and when the consignor is being paid.</p>
                </div>
              </div>

              <div className="consignment-form-grid consignment-form-grid-3 consignment-payout-payment-grid">
                <div className="consignment-form-field">
                  <label className="consignment-label">Payment method</label>
                  <select
                    className="consignment-select"
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                  >
                    <option>E-transfer</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Store credit</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">Payout date</label>
                  <input
                    className="consignment-input"
                    type="date"
                    value={payoutDate}
                    onChange={(event) => setPayoutDate(event.target.value)}
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">Reference</label>
                  <input
                    className="consignment-input"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder={
                      method === 'Store credit'
                        ? 'Credit memo or note'
                        : 'Optional confirmation #'
                    }
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">Manual adjustment</label>
                  <input
                    className="consignment-input"
                    type="number"
                    inputMode="decimal"
                    value={adjustment}
                    onChange={(event) => setAdjustment(event.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="consignment-form-field consignment-payout-note-field">
                  <label className="consignment-label">Payout note</label>
                  <input
                    className="consignment-input"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional payment reference or note"
                  />
                </div>
              </div>

              {method === 'Store credit' && (
                <div className="consignment-form-help consignment-payout-store-credit-help">
                  <CircleDollarSign size={17} />
                  This records the amount as store credit in the payout ledger
                  and on each linked Shopify product.
                </div>
              )}
            </div>

            <div className="consignment-payout-footer">
              <div>
                <span className="consignment-label">Total payout</span>
                <strong>{money(payoutTotal)}</strong>
              </div>

              <button
                type="button"
                className="consignment-btn"
                disabled={!selected.length || saving}
                onClick={recordPayout}
              >
                <WalletCards size={17} />
                {saving ? 'Recording payout…' : 'Record payout'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
