/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { Check } from 'lucide-react';
import ShopifyProductPanel from './ShopifyProductPanel';
import { CATEGORIES, CONDITIONS } from '../../lib/itemFields';

export function ManualItemCore({
  form,
  setForm,
  onSave,
  saveLabel = 'Save manual item',
  saveDisabled = false,
  helperText = 'Saves only the consignment metaobject record. No Shopify product is created.',
  showItemNumber = false,
}) {
  const set = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const setCategory = (category) => {
    setForm((current) => ({
      ...current,
      category,
      type: '',
    }));
  };

  const itemNumberValid =
    !showItemNumber ||
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,28}[A-Za-z0-9])?$/.test(String(form.itemNumber || '').trim());

  return (
    <>
      {showItemNumber && (
        <div className="consignment-form-field">
          <label className="consignment-label" htmlFor="item-number-input">Item number</label>
          <input
            id="item-number-input"
            className="consignment-input"
            value={form.itemNumber || ''}
            onChange={set('itemNumber')}
            autoCapitalize="characters"
            spellCheck={false}
          />
          <div className="consignment-form-help">
            {itemNumberValid
              ? 'Changing it also changes the barcode and the SKU on Shopify. Reprint the label after saving.'
              : 'Use letters, numbers and dashes only (up to 30 characters).'}
          </div>
        </div>
      )}

      <div className="consignment-form-grid consignment-form-grid-2">
        <div className="consignment-form-field">
          <label className="consignment-label">Item description *</label>

          <input
            className="consignment-input"
            value={form.description}
            onChange={set('description')}
            placeholder="What is it?"
          />
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">Price *</label>

          <input
            className="consignment-input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={form.price}
            onChange={set('price')}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="consignment-form-grid consignment-form-grid-2">
        <div className="consignment-form-field">
          <label className="consignment-label">Category</label>

          <select
            className="consignment-select"
            value={form.category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">Brand</label>

          <input
            className="consignment-input"
            value={form.brand}
            onChange={set('brand')}
            placeholder="e.g. Gap"
          />
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">Size</label>

          <input
            className="consignment-input"
            value={form.size}
            onChange={set('size')}
            placeholder="Optional"
          />
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">Condition</label>

          <select
            className="consignment-select"
            value={form.condition}
            onChange={set('condition')}
          >
            {CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {condition}
              </option>
            ))}
          </select>
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">Consignment term</label>

          <select
            className="consignment-select"
            value={form.consignmentTerm || ''}
            onChange={set('consignmentTerm')}
          >
            <option value="">No term</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">Internal notes</label>

          <textarea
            className="consignment-textarea"
            rows={2}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Notes about this consigned item"
          />
        </div>
      </div>

      <div className="consignment-form-help">{helperText}</div>

      <div
        className="consignment-form-actions-inner"
        style={{ marginBottom: 14 }}
      >
        <button
          className="consignment-btn"
          disabled={saveDisabled || !itemNumberValid}
          onClick={onSave}
        >
          <Check size={18} />
          {saveLabel}
        </button>
      </div>
    </>
  );
}

export function ShopifyProductSection(props) {
  return <ShopifyProductPanel {...props} />;
}
