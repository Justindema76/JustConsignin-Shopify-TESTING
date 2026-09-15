/* eslint-disable react/prop-types */
import { Download } from 'lucide-react';
import {
  csvValue, money, saleAmount, commissionRate, consignorEarning, isSold, recordedPayoutGroups,
} from '../../lib/consignmentHelpers';
import '../../styles/consignment-reports.css';

// Local, not shared: this export needs arbitrary row shapes (section
// headers, blank separator rows, single-cell rows) that don't fit the
// stricter headers+rows CSV helper in consignmentHelpers.js.
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