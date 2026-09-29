import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { searchShopifyTags } from '../../consignmentApi';

function normalizeTags(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();

  return raw
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function serializeTags(tags) {
  return normalizeTags(tags).join(', ');
}

export default function ShopifyTagPicker({
  value,
  onChange,
  disabled = false,
}) {
  const selected = useMemo(() => normalizeTags(value), [value]);
  const [availableTags, setAvailableTags] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');

    searchShopifyTags()
      .then((tags) => {
        if (!cancelled) setAvailableTags(normalizeTags(tags));
      })
      .catch((error) => {
        if (!cancelled) {
          setAvailableTags([]);
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load existing Shopify tags.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedKeys = useMemo(
    () => new Set(selected.map((tag) => tag.toLowerCase())),
    [selected],
  );

  const suggestions = useMemo(() => {
    const search = query.trim().toLowerCase();

    return availableTags
      .filter((tag) => !selectedKeys.has(tag.toLowerCase()))
      .filter((tag) => !search || tag.toLowerCase().includes(search))
      .slice(0, 8);
  }, [availableTags, query, selectedKeys]);

  function commit(tags) {
    onChange(serializeTags(tags));
  }

  function addTag(tag) {
    const clean = String(tag || '').trim();
    if (!clean || selectedKeys.has(clean.toLowerCase())) return;
    commit([...selected, clean]);
    setQuery('');
  }

  function removeTag(tag) {
    commit(selected.filter((entry) => entry.toLowerCase() !== tag.toLowerCase()));
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(query.replace(/,$/, ''));
      return;
    }

    if (event.key === 'Backspace' && !query && selected.length) {
      removeTag(selected[selected.length - 1]);
    }
  }

  return (
    <div className="consignment-tag-picker">
      {selected.length > 0 && (
        <div className="consignment-tag-chips" aria-label="Selected tags">
          {selected.map((tag) => (
            <span className="consignment-tag-chip" key={tag}>
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
                disabled={disabled}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="consignment-tag-entry">
        <input
          className="consignment-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="Search existing tags or create a new tag"
          autoComplete="off"
        />

        {query.trim() && !selectedKeys.has(query.trim().toLowerCase()) && (
          <button
            type="button"
            className="consignment-tag-create"
            onClick={() => addTag(query)}
            disabled={disabled}
          >
            <Plus size={14} />
            Create “{query.trim()}”
          </button>
        )}
      </div>

      {loading && (
        <div className="consignment-tag-help">Loading existing Shopify tags…</div>
      )}

      {!loading && loadError && (
        <div className="consignment-tag-help">
          Existing tags could not be loaded. You can still create a new tag.
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <div className="consignment-tag-suggestions">
          <span>Existing tags</span>
          <div>
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                disabled={disabled}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
