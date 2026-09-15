/* eslint-disable react/prop-types */
import { Moon, Sun, ArrowLeft } from 'lucide-react';
import { useOutletContext } from 'react-router';
import '../../styles/consignment-global.css';
import '../../styles/consignment-header.css';

export default function Header({ eyebrow, title, onBack = null, action = null }) {
  const { resolvedTheme = 'light', setTheme } = useOutletContext() || {};
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="consignment-header">
      <div className="consignment-header-row">
        <div className="consignment-header-main">
          {onBack && (
            <button type="button" className="consignment-back" onClick={onBack} aria-label="Back">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            {eyebrow && <p className="consignment-eyebrow">{eyebrow}</p>}
            <h1 className="consignment-title">{title}</h1>
          </div>
        </div>
        {action && <div className="consignment-header-action">{action}</div>}
        <button
          type="button"
          className="consignment-theme-toggle"
          onClick={() => setTheme?.(isDark ? 'light' : 'dark')}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
          {isDark
            ? <Sun size={18} aria-hidden="true" />
            : <Moon size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
