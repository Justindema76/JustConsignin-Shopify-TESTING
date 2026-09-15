/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useState } from 'react';
import { Check } from 'lucide-react';
import Header from '../../components/consignment/Header';
import '../../styles/consignment-forms.css';

/* ============================================================================
   PAGE: ADD NEW CONSIGNOR
   Creates a new consignor record.

   GLOBAL STYLES USED:
   - consignment-body
   - consignment-input
   - consignment-select
   - consignment-textarea
   - consignment-btn

   SHARED FORM LAYOUT:
   - consignment-forms.css
   ============================================================================ */

export default function CreateConsignorScreen({ onBack, onSave, nextNumber }) {
  /* --------------------------------------------------------------------------
     FORM STATE
     -------------------------------------------------------------------------- */
  const [form, setForm] = useState({
    number: nextNumber,
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    province: 'Ontario',
    postalCode: '',
    commissionPct: 50,
    unsoldPreference: 'Please return',
    notes: '',
  });

  const set = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const valid = form.firstName.trim() && form.lastName.trim();

  return (
    <>
      {/* ======================================================================
          PAGE HEADER
          ====================================================================== */}
      <Header eyebrow="New consignor" title="Create consignor" onBack={onBack} />

      <div className="consignment-body consignment-form-page">
        <div className="consignment-form-shell">

          {/* ==================================================================
              SECTION: IDENTITY
              ================================================================== */}
          <section className="consignment-form-section">
            <div className="consignment-form-section-head">
              <span className="consignment-form-section-marker" aria-hidden="true" />
              <div>
                <h2>Identity</h2>
                <p>Basic consignor information</p>
              </div>
            </div>

            <div className="consignment-form-section-body">
              <div className="consignment-form-grid consignment-form-grid-identity">

                {/* CONSIGNOR NUMBER */}
                <div className="consignment-form-field consignment-form-field-number">
                  <label className="consignment-label">Consignor #</label>
                  <input
                    className="consignment-input"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={form.number}
                    onChange={set('number')}
                  />
                  <div className="consignment-form-help">
                    Auto-assigned
                  </div>
                </div>

                {/* FIRST NAME */}
                <div className="consignment-form-field">
                  <label className="consignment-label">First name</label>
                  <input
                    className="consignment-input"
                    value={form.firstName}
                    onChange={set('firstName')}
                    placeholder="Sarah"
                  />
                </div>

                {/* LAST NAME */}
                <div className="consignment-form-field">
                  <label className="consignment-label">Last name</label>
                  <input
                    className="consignment-input"
                    value={form.lastName}
                    onChange={set('lastName')}
                    placeholder="Lee"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ==================================================================
              SECTION: CONTACT
              ================================================================== */}
          <section className="consignment-form-section">
            <div className="consignment-form-section-head">
              <span className="consignment-form-section-marker" aria-hidden="true" />
              <div>
                <h2>Contact</h2>
                <p>Phone, email, and mailing address</p>
              </div>
            </div>

            <div className="consignment-form-section-body">

              {/* PHONE + EMAIL */}
              <div className="consignment-form-grid consignment-form-grid-2">
                <div className="consignment-form-field">
                  <label className="consignment-label">Phone</label>
                  <input
                    className="consignment-input"
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="(416) 555-0134"
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">Email</label>
                  <input
                    className="consignment-input"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="sarah@email.com"
                  />
                </div>
              </div>

              {/* STREET ADDRESS */}
              <div className="consignment-form-field">
                <label className="consignment-label">Street address</label>
                <input
                  className="consignment-input"
                  value={form.address}
                  onChange={set('address')}
                  placeholder="123 Main Street"
                  autoComplete="street-address"
                />
              </div>

              {/* CITY / PROVINCE / POSTAL CODE */}
              <div className="consignment-form-grid consignment-form-grid-3">
                <div className="consignment-form-field">
                  <label className="consignment-label">City</label>
                  <input
                    className="consignment-input"
                    value={form.city}
                    onChange={set('city')}
                    placeholder="Hamilton"
                    autoComplete="address-level2"
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">Province</label>
                  <input
                    className="consignment-input"
                    value={form.province}
                    onChange={set('province')}
                    placeholder="Ontario"
                    autoComplete="address-level1"
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">Postal code</label>
                  <input
                    className="consignment-input"
                    value={form.postalCode}
                    onChange={set('postalCode')}
                    placeholder="L8E 1A1"
                    autoCapitalize="characters"
                    autoComplete="postal-code"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ==================================================================
              SECTION: CONSIGNMENT SETTINGS
              ================================================================== */}
          <section className="consignment-form-section">
            <div className="consignment-form-section-head">
              <span className="consignment-form-section-marker" aria-hidden="true" />
              <div>
                <h2>Consignment settings</h2>
                <p>Default terms used for this consignor</p>
              </div>
            </div>

            <div className="consignment-form-section-body">
              <div className="consignment-form-grid consignment-form-grid-2">

                {/* COMMISSION */}
                <div className="consignment-form-field">
                  <label className="consignment-label">
                    Consignor gets (%)
                  </label>
                  <input
                    className="consignment-input"
                    type="number"
                    inputMode="decimal"
                    value={form.commissionPct}
                    onChange={set('commissionPct')}
                    placeholder="50"
                  />
                </div>

                {/* UNSOLD ITEM PREFERENCE */}
                <div className="consignment-form-field">
                  <label className="consignment-label">Unsold items</label>
                  <select
                    className="consignment-select"
                    value={form.unsoldPreference}
                    onChange={set('unsoldPreference')}
                  >
                    <option value="Please return">Please return</option>
                    <option value="Donation okay">Donation okay</option>
                    <option value="Ask me first">Ask me first</option>
                  </select>
                </div>
              </div>

              {/* NOTES */}
              <div className="consignment-form-field">
                <label className="consignment-label">Notes (optional)</label>
                <textarea
                  className="consignment-textarea"
                  rows={3}
                  value={form.notes}
                  onChange={set('notes')}
                  placeholder="Anything worth remembering"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ======================================================================
          SAVE ACTION
          Uses the global .consignment-btn style.
          ====================================================================== */}
      <div className="consignment-form-actions">
        <div className="consignment-form-actions-inner">
          <button
            className="consignment-btn"
            disabled={!valid}
            onClick={() => onSave(form)}
          >
            <Check size={18} />
            Save consignor
          </button>
        </div>
      </div>
    </>
  );
}
