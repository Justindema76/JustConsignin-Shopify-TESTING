/* eslint-disable react/prop-types */

// Compatibility re-export so existing screens keep working unchanged.
// New/updated screens can import Header directly from ./Header.
export { default as Header } from './Header';

export function MetricCard({ icon: Icon, label, value, note, onClick }) {
  return (
    <button type="button" className="consignment-metric" onClick={onClick} aria-label={`Open ${label}`}>
      <div className="consignment-metric-icon"><Icon size={18} /></div>
      <div className="consignment-metric-label">{label}</div>
      <div className="consignment-metric-value">{value}</div>
      {note && <div className="consignment-metric-note">{note}</div>}
    </button>
  );
}
