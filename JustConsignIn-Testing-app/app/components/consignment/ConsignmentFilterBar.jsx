/* eslint-disable react/prop-types */
import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import '../../styles/consignment-filter-bar.css';

// Reusable filter/search bar. This component owns ONLY the layout,
// spacing, and responsive behavior shared by every page (the collapsible
// "Filters & sorting" panel, the search box, the view toggle beside it).
// It does not know anything about consignors, statuses, sale sources, or
// any other domain concept — every choice comes in through props.
//
//   <ConsignmentFilterBar
//     search={{ value, onChange, placeholder, ariaLabel }}
//     filters={[
//       { key: 'consignor', label: 'Consignor', value, onChange, options: [{value, label}, ...] },
//       ...
//     ]}
//     views={{ value, onChange, ariaLabel, options: [{value, label, icon: LucideIcon}, ...] }}
//   />
//
// `filters` renders inside the collapsible "Filters & sorting" panel, in
// the order given — sort is just another entry in that same array, not a
// separate concept, since visually and structurally it's identical to any
// other dropdown.
//
// Any of `search`, `filters`, and `views` can be omitted by a page that
// doesn't need it (e.g. a page with no view toggle just omits `views`).
export default function ConsignmentFilterBar({ search, filters, views }) {
  const hasFilters = Array.isArray(filters) && filters.length > 0;
  const hasSearch = Boolean(search);
  const hasViews = Boolean(views) && Array.isArray(views.options) && views.options.length > 0;
  const [filtersOpen, setFiltersOpen] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 761px)').matches
      : false,
  );

  if (!hasFilters && !hasSearch && !hasViews) return null;

  return (
    <div className="consignment-items-toolbar">
      {hasFilters && (
        <details
          className="consignment-items-filter-details"
          open={filtersOpen}
          onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
        >
          <summary className="consignment-items-filter-summary">
            <span>Filters &amp; sorting</span>
            <ChevronDown size={20} aria-hidden="true" />
          </summary>
          <div className="consignment-items-toolbar-top">
            {filters.map((filter) => (
              <label key={filter.key} className="consignment-tool-field">
                <span>{filter.label}</span>
                <select
                  className="consignment-select consignment-filter-select"
                  value={filter.value}
                  onChange={(event) => filter.onChange(event.target.value)}
                  aria-label={filter.ariaLabel || `Filter by ${filter.label}`}
                  disabled={filter.disabled}
                >
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
      )}

      {(hasSearch || hasViews) && (
        <div className="consignment-items-toolbar-bottom">
          {hasSearch && (
            <div className="consignment-search">
              <Search size={19} />
              <input
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder || 'Search'}
                aria-label={search.ariaLabel || search.placeholder || 'Search'}
              />
            </div>
          )}
          {hasViews && (
            <div className="consignment-tool-view">
              <span>View</span>
              <div className="consignment-view-toggle consignment-finder-toggle" aria-label={views.ariaLabel || 'Choose view'}>
                {views.options.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={views.value === option.value ? 'active' : ''}
                      onClick={() => views.onChange(option.value)}
                      aria-pressed={views.value === option.value}
                    >
                      {Icon ? <Icon size={16} /> : null} {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
