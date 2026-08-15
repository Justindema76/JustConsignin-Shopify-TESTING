/* eslint-disable react/prop-types */
import { Download } from 'lucide-react';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function csvValue(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(fileName, rows) {
  const csv = rows.map((row) => row.map(csvValue).join(',')).join('\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function saleAmount(item) {
  return Number(item.salePrice ?? item.price ?? 0);
}

function commissionRate(item, consignor) {
  return Number(item.commissionPct ?? consignor?.commissionPct ?? 0);
}

function consignorEarning(item, consignor) {
  return (saleAmount(item) * commissionRate(item, consignor)) / 100;
}

function isSold(item) {
  return item.status === 'Sold' || Boolean(item.dateSold) || Boolean(item.orderId);
}

function recordedPayoutGroups(items) {
  const groups = new Map();

  items
    .filter((item) => item.paidOut && item.payoutId)
    .forEach((item) => {
      if (!groups.has(item.payoutId)) {
        groups.set(item.payoutId, {
          payoutId: item.payoutId,
          payoutDate: item.payoutDate || '',
          payoutMethod: item.payoutMethod || '',
          payoutReference: item.payoutReference || '',
          payoutTotal: Number(item.payoutTotal || 0),
          payoutAdjustment: Number(item.payoutAdjustment || 0),
          items: [],
        });
      }
      groups.get(item.payoutId).items.push(item);
    });

  return [...groups.values()];
}

function ReportsStyle() {
  return (
    <style>{`
      .consignment-reports-page { padding-top: 16px; }
      .consignment-reports-header {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: 18px; margin-bottom: 18px;
      }
      .consignment-reports-eyebrow {
        margin: 0 0 4px; color: var(--green); font-size: 11px; font-weight: 800;
        letter-spacing: .08em; text-transform: uppercase;
      }
      .consignment-reports-title {
        margin: 0; font-family: 'Fraunces', serif; font-size: 28px; line-height: 1.1;
      }
      .consignment-reports-subtitle {
        margin: 5px 0 0; color: var(--muted); font-size: 13px;
      }
      .consignment-reports-downloads {
        display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px;
      }
      .consignment-reports-download {
        display: inline-flex; align-items: center; justify-content: center; gap: 7px;
        min-height: 38px; padding: 8px 12px; border: 1px solid var(--line);
        border-radius: 9px; background: var(--surface); color: var(--green-dark);
        font-size: 12px; font-weight: 750;
      }
      .consignment-reports-download.primary {
        border-color: var(--green); background: var(--green); color: #fff;
      }
      .consignment-reports-metrics {
        display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px; margin-bottom: 14px;
      }
      .consignment-reports-metric {
        min-width: 0; padding: 15px 16px; border: 1px solid var(--line);
        border-radius: 12px; background: var(--surface);
      }
      .consignment-reports-metric span {
        display: block; color: var(--muted); font-size: 10px; font-weight: 800;
        letter-spacing: .03em; text-transform: uppercase;
      }
      .consignment-reports-metric strong {
        display: block; margin-top: 5px; font-size: 22px; line-height: 1.05;
      }
      .consignment-reports-pair {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px; margin-bottom: 18px;
      }
      .consignment-reports-card {
        border: 1px solid var(--line); border-radius: 12px; background: var(--surface);
        overflow: hidden;
      }
      .consignment-reports-card-body { padding: 16px; }
      .consignment-reports-card h2 {
        margin: 0 0 10px; font-size: 16px;
      }
      .consignment-reports-line {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; min-height: 28px; font-size: 12px;
      }
      .consignment-reports-line.total {
        margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--line);
        font-size: 13px;
      }
      .consignment-reports-section { margin-bottom: 16px; }
      .consignment-reports-section-head {
        padding: 14px 16px 10px; border-bottom: 1px solid var(--line);
      }
      .consignment-reports-section-head h2 {
        margin: 0; font-size: 16px;
      }
      .consignment-reports-section-head p {
        margin: 4px 0 0; color: var(--muted); font-size: 11px;
      }
      .consignment-reports-table { width: 100%; overflow-x: auto; }
      .consignment-reports-row {
        display: grid; gap: 12px; align-items: center;
        min-width: 850px; padding: 11px 14px; border-bottom: 1px solid var(--line);
        font-size: 12px;
      }
      .consignment-reports-row:last-child { border-bottom: 0; }
      .consignment-reports-row.reconciliation {
        grid-template-columns: minmax(190px, 1.35fr) 90px 105px 125px 90px 90px 105px;
      }
      .consignment-reports-row.liability {
        grid-template-columns: minmax(210px, 1.4fr) minmax(160px, 1fr) 100px 95px 90px 100px 120px;
      }
      .consignment-reports-row.head {
        background: #FAFBFB; color: var(--muted); font-size: 10px;
        font-weight: 800; letter-spacing: .03em; text-transform: uppercase;
      }
      .consignment-reports-cell-center { text-align: center; }
      .consignment-reports-cell-right { text-align: right; }
      .consignment-reports-consignor {
        border: 0; padding: 0; background: transparent; color: var(--green-dark);
        font: inherit; font-weight: 800; text-align: left;
      }
      .consignment-reports-consignor:hover { text-decoration: underline; }
      .consignment-reports-consignor small {
        display: block; margin-top: 2px; color: var(--muted); font-size: 9px; font-weight: 500;
      }
      .consignment-reports-pay {
        min-height: 34px; padding: 7px 10px; border: 0; border-radius: 8px;
        background: var(--green); color: white; font-size: 11px; font-weight: 750;
        white-space: nowrap;
      }
      .consignment-reports-empty {
        padding: 24px 16px; color: var(--muted); font-size: 12px; text-align: center;
      }
      @media (max-width: 900px) {
        .consignment-reports-header { flex-direction: column; }
        .consignment-reports-downloads { justify-content: flex-start; }
        .consignment-reports-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        .consignment-reports-metrics, .consignment-reports-pair { grid-template-columns: 1fr 1fr; gap: 8px; }
        .consignment-reports-card-body { padding: 13px; }
        .consignment-reports-title { font-size: 24px; }
        .consignment-reports-downloads { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
        .consignment-reports-download.primary { grid-column: 1 / -1; }
      }
    `}</style>
  );
}

export default function ReportsScreen({
  items,
  consignors,
  onOpenConsignor,
  onStartPayout,
}) {
  const consignorById = Object.fromEntries(consignors.map((consignor) => [consignor.id, consignor]));
  const soldItems = items.filter(isSold);

  const grossSales = soldItems.reduce((sum, item) => sum + saleAmount(item), 0);
  const totalConsignorEarnings = soldItems.reduce(
    (sum, item) => sum + consignorEarning(item, consignorById[item.consignorId]),
    0,
  );
  const outstandingItems = soldItems.filter((item) => !item.paidOut);
  const outstandingDue = outstandingItems.reduce(
    (sum, item) => sum + consignorEarning(item, consignorById[item.consignorId]),
    0,
  );
  const storeShare = grossSales - totalConsignorEarnings;
  const paidSales = soldItems.filter((item) => item.paidOut);
  const averageSale = soldItems.length ? grossSales / soldItems.length : 0;

  const payoutGroups = recordedPayoutGroups(items);
  const recordedPayouts = payoutGroups.reduce((sum, payout) => {
    if (payout.payoutTotal) return sum + payout.payoutTotal;
    return sum + payout.items.reduce((itemSum, item) => itemSum + Number(item.payoutAmount || 0), 0);
  }, 0);
  const manualAdjustments = payoutGroups.reduce(
    (sum, payout) => sum + Number(payout.payoutAdjustment || 0),
    0,
  );

  const reconciliation = consignors
    .map((consignor) => {
      const sales = soldItems.filter((item) => item.consignorId === consignor.id);
      const gross = sales.reduce((sum, item) => sum + saleAmount(item), 0);
      const earnings = sales.reduce((sum, item) => sum + consignorEarning(item, consignor), 0);
      const paidOut = sales
        .filter((item) => item.paidOut)
        .reduce((sum, item) => {
          const explicit = Number(item.payoutAmount || 0);
          return sum + (explicit || consignorEarning(item, consignor));
        }, 0);
      const due = sales
        .filter((item) => !item.paidOut)
        .reduce((sum, item) => sum + consignorEarning(item, consignor), 0);
      return {
        consignor,
        soldCount: sales.length,
        gross,
        earnings,
        paidOut,
        due,
        storeShare: gross - earnings,
      };
    })
    .filter((entry) => entry.soldCount > 0)
    .sort((a, b) => Number(a.consignor.number || 0) - Number(b.consignor.number || 0));

  const liabilityRows = outstandingItems
    .map((item) => {
      const consignor = consignorById[item.consignorId];
      return {
        item,
        consignor,
        amountDue: consignorEarning(item, consignor),
      };
    })
    .sort((a, b) => String(a.item.dateSold || '').localeCompare(String(b.item.dateSold || '')));

  function exportSalesLedger() {
    downloadCsv(
      `sales-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['SKU', 'Item', 'Consignor', 'Sale date', 'Sale price', 'Commission %', 'Consignor earnings', 'Store share', 'Payout status', 'Order'],
        ...soldItems.map((item) => {
          const consignor = consignorById[item.consignorId];
          const earnings = consignorEarning(item, consignor);
          const sale = saleAmount(item);
          return [
            item.itemNumber || '',
            item.description || '',
            consignor ? `${consignor.firstName} ${consignor.lastName}` : '',
            item.dateSold || '',
            sale,
            commissionRate(item, consignor),
            earnings,
            sale - earnings,
            item.paidOut ? 'Paid' : 'Unpaid',
            item.orderName || '',
          ];
        }),
      ],
    );
  }

  function exportPayoutLedger() {
    downloadCsv(
      `payout-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Payout ID', 'Date', 'Method', 'Reference', 'Items', 'Recorded payout', 'Manual adjustment'],
        ...payoutGroups.map((payout) => [
          payout.payoutId,
          payout.payoutDate,
          payout.payoutMethod,
          payout.payoutReference,
          payout.items.length,
          payout.payoutTotal || payout.items.reduce((sum, item) => sum + Number(item.payoutAmount || 0), 0),
          payout.payoutAdjustment,
        ]),
      ],
    );
  }

  function exportAccountingSummary() {
    downloadCsv(
      `accounting-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Accounting summary'],
        ['Gross sales', grossSales],
        ['Consignor earnings', totalConsignorEarnings],
        ['Outstanding due', outstandingDue],
        ['Store share', storeShare],
        ['Recorded payouts', recordedPayouts],
        ['Manual adjustments', manualAdjustments],
        ['Sold items', soldItems.length],
        ['Paid sales', paidSales.length],
        ['Sales to be paid', outstandingItems.length],
        ['Average sale', averageSale],
        [],
        ['Consignor reconciliation'],
        ['Consignor #', 'Consignor', 'Sold items', 'Gross sales', 'Consignor earnings', 'Paid out', 'Due', 'Store share'],
        ...reconciliation.map((entry) => [
          entry.consignor.number,
          `${entry.consignor.firstName} ${entry.consignor.lastName}`,
          entry.soldCount,
          entry.gross,
          entry.earnings,
          entry.paidOut,
          entry.due,
          entry.storeShare,
        ]),
      ],
    );
  }

  return (
    <>
      <ReportsStyle />
      <div className="consignment-body consignment-reports-page">
        <div className="consignment-reports-header">
          <div>
            <p className="consignment-reports-eyebrow">Accounting</p>
            <h1 className="consignment-reports-title">Reports</h1>
            <p className="consignment-reports-subtitle">Sales, consignor liabilities, payouts, and store earnings.</p>
          </div>
          <div className="consignment-reports-downloads">
            <button type="button" className="consignment-reports-download" onClick={exportSalesLedger}>
              <Download size={15} /> Sales ledger
            </button>
            <button type="button" className="consignment-reports-download" onClick={exportPayoutLedger}>
              <Download size={15} /> Payout ledger
            </button>
            <button type="button" className="consignment-reports-download primary" onClick={exportAccountingSummary}>
              <Download size={15} /> Accounting summary
            </button>
          </div>
        </div>

        <div className="consignment-reports-metrics">
          <div className="consignment-reports-metric"><span>Gross sales</span><strong>{money(grossSales)}</strong></div>
          <div className="consignment-reports-metric"><span>Consignor earnings</span><strong>{money(totalConsignorEarnings)}</strong></div>
          <div className="consignment-reports-metric"><span>Outstanding due</span><strong>{money(outstandingDue)}</strong></div>
          <div className="consignment-reports-metric"><span>Store share</span><strong>{money(storeShare)}</strong></div>
        </div>

        <div className="consignment-reports-pair">
          <section className="consignment-reports-card">
            <div className="consignment-reports-card-body">
              <h2>Payout reconciliation</h2>
              <div className="consignment-reports-line"><span>Recorded payouts</span><strong>{money(recordedPayouts)}</strong></div>
              <div className="consignment-reports-line"><span>Manual adjustments</span><strong>{money(manualAdjustments)}</strong></div>
              <div className="consignment-reports-line"><span>Outstanding liability</span><strong>{money(outstandingDue)}</strong></div>
              <div className="consignment-reports-line total"><span>Total consignor earnings</span><strong>{money(totalConsignorEarnings)}</strong></div>
            </div>
          </section>

          <section className="consignment-reports-card">
            <div className="consignment-reports-card-body">
              <h2>Sales activity</h2>
              <div className="consignment-reports-line"><span>Sold items</span><strong>{soldItems.length}</strong></div>
              <div className="consignment-reports-line"><span>Paid sales</span><strong>{paidSales.length}</strong></div>
              <div className="consignment-reports-line"><span>Sales to be paid</span><strong>{outstandingItems.length}</strong></div>
              <div className="consignment-reports-line total"><span>Average sale</span><strong>{money(averageSale)}</strong></div>
            </div>
          </section>
        </div>

        <section className="consignment-reports-card consignment-reports-section">
          <div className="consignment-reports-section-head">
            <h2>Consignor reconciliation</h2>
            <p>Every consignor&apos;s sales, earnings, payouts, and current amount due.</p>
          </div>
          <div className="consignment-reports-table">
            <div className="consignment-reports-row reconciliation head">
              <span>Consignor</span><span>Sold items</span><span>Gross sales</span><span>Consignor earnings</span><span>Paid out</span><span>Due</span><span>Store share</span>
            </div>
            {reconciliation.length === 0 ? (
              <div className="consignment-reports-empty">No sold consignment items yet.</div>
            ) : reconciliation.map((entry) => (
              <div className="consignment-reports-row reconciliation" key={entry.consignor.id}>
                <button type="button" className="consignment-reports-consignor" onClick={() => onOpenConsignor(entry.consignor.id)}>
                  #{entry.consignor.number} · {entry.consignor.firstName} {entry.consignor.lastName}
                  <small>Consignor #{entry.consignor.number}</small>
                </button>
                <span>{entry.soldCount}</span>
                <span>{money(entry.gross)}</span>
                <span>{money(entry.earnings)}</span>
                <span>{money(entry.paidOut)}</span>
                <strong>{money(entry.due)}</strong>
                <span>{money(entry.storeShare)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="consignment-reports-card consignment-reports-section">
          <div className="consignment-reports-section-head">
            <h2>Outstanding consignor liabilities</h2>
            <p>Sold items that still need a consignor payout.</p>
          </div>
          <div className="consignment-reports-table">
            <div className="consignment-reports-row liability head">
              <span>Item</span><span>Consignor</span><span>Sale date</span><span>Sale price</span><span>Commission</span><span>Amount due</span><span>Action</span>
            </div>
            {liabilityRows.length === 0 ? (
              <div className="consignment-reports-empty">There are no outstanding consignor liabilities.</div>
            ) : liabilityRows.map(({ item, consignor, amountDue }) => (
              <div className="consignment-reports-row liability" key={item.id}>
                <strong>#{item.itemNumber} {item.description || 'Consignment item'}</strong>
                {consignor ? (
                  <button type="button" className="consignment-reports-consignor" onClick={() => onOpenConsignor(consignor.id)}>
                    #{consignor.number} · {consignor.firstName} {consignor.lastName}
                  </button>
                ) : <span>—</span>}
                <span>{item.dateSold || '—'}</span>
                <span>{money(saleAmount(item))}</span>
                <span>{commissionRate(item, consignor)}%</span>
                <strong>{money(amountDue)}</strong>
                <span>
                  {consignor ? (
                    <button type="button" className="consignment-reports-pay" onClick={() => onStartPayout(consignor.id)}>
                      Pay consignor
                    </button>
                  ) : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
