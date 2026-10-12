/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useState } from 'react';
import { Check } from 'lucide-react';
import Header from '../../components/consignment/Header';
import {
  addressLabels,
  countryOptions,
  regionsFor,
} from '../../lib/addressFormats';
import '../../styles/consignment-forms.css';

/* ============================================================================
   PAGE: NEW / EDIT CONSIGNOR
   One form for both. Pass `consignor` to edit an existing record;
   leave it out (and pass `nextNumber`) to create a new one.

   GLOBAL STYLES USED:
   - consignment-body
   - consignment-input
   - consignment-select
   - consignment-textarea
   - consignment-btn

   SHARED FORM LAYOUT:
   - consignment-forms.css
   ============================================================================ */

const COUNTRIES = countryOptions();
const LAST_LOCATION_KEY = 'justconsignin:last-consignor-location';

function readLastLocation() {
  try {
    return window.localStorage.getItem(LAST_LOCATION_KEY) || '';
  } catch {
    return '';
  }
}

function rememberLocation(id) {
  try {
    window.localStorage.setItem(LAST_LOCATION_KEY, id);
  } catch {
    // Browser storage can be blocked; the pick just isn't remembered.
  }
}

export default function ConsignorFormScreen({
  consignor = null,
  nextNumber,
  onBack,
  onSave,
  storeSetup = {},
}) {
  const editing = Boolean(consignor);
  const locations = storeSetup.locations || [];
  const enabledIds = storeSetup.enabledLocationIds || [];

  // Stores the consignor can be assigned to. A consignor already set to a
  // store that was later switched off keeps it.
  const locationOptions = locations.filter(
    (location) =>
      enabledIds.includes(location.id) || location.id === consignor?.locationId,
  );
  const showLocation = locationOptions.length > 1;

  function initialLocation() {
    if (consignor?.locationId) return consignor.locationId;
    if (enabledIds.length === 1) return enabledIds[0];
    const last = readLastLocation();
    return enabledIds.includes(last) ? last : '';
  }

  /* --------------------------------------------------------------------------
     FORM STATE
     -------------------------------------------------------------------------- */
  const [form, setForm] = useState({
    number: editing ? consignor.number : nextNumber,
    firstName: consignor?.firstName || '',
    lastName: consignor?.lastName || '',
    phone: consignor?.phone || '',
    email: consignor?.email || '',
    address: consignor?.address || '',
    city: consignor?.city || '',
    country: consignor?.country || storeSetup.countryCode || '',
    province: editing ? consignor.province || '' : storeSetup.province || '',
    postalCode: consignor?.postalCode || '',
    locationId: initialLocation(),
    commissionPct: consignor?.commissionPct ?? 50,
    unsoldPreference: consignor?.unsoldPreference || 'Please return',
    notes: consignor?.notes || '',
  });

  const set = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const setCountry = (event) => {
    const country = event.target.value;
    setForm((current) => ({
      ...current,
      country,
      // A province from another country's list doesn't carry over.
      province: country === storeSetup.countryCode ? storeSetup.province || '' : '',
    }));
  };

  const labels = addressLabels(form.country);
  const regions = regionsFor(form.country);
  // Keep a saved value that isn't in the list (e.g. "ON") selectable.
  const regionOptions = regions && form.province && !regions.includes(form.province)
    ? [form.province, ...regions]
    : regions;

  const valid = form.firstName.trim()
    && form.lastName.trim()
    && (!showLocation || form.locationId);

  const save = () => {
    if (showLocation) rememberLocation(form.locationId);
    if (editing) onSave(consignor.id, form);
    else onSave(form);
  };

  return (
    <>
      {/* ======================================================================
          PAGE HEADER
          ====================================================================== */}
      <Header
        eyebrow={editing ? `Consignor #${consignor.number}` : 'New consignor'}
        title={editing ? 'Edit consignor' : 'Create consignor'}
        onBack={onBack}
      />

      <div className="consignment-body consignment-form-page">
        <div className="consignment-form-shell">
          {/* ==================================================================
              SECTION: IDENTITY
              ================================================================== */}
          <section className="consignment-form-section">
            <div className="consignment-form-section-head">
              <span
                className="consignment-form-section-marker"
                aria-hidden="true"
              />
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
                  {!editing && (
                    <div className="consignment-form-help">Auto-assigned</div>
                  )}
                </div>

                {/* FIRST NAME */}
                <div className="consignment-form-field">
                  <label className="consignment-label">First name</label>
                  <input
                    className="consignment-input"
                    value={form.firstName}
                    onChange={set('firstName')}
                  />
                </div>

                {/* LAST NAME */}
                <div className="consignment-form-field">
                  <label className="consignment-label">Last name</label>
                  <input
                    className="consignment-input"
                    value={form.lastName}
                    onChange={set('lastName')}
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
              <span
                className="consignment-form-section-marker"
                aria-hidden="true"
              />
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
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">Email</label>
                  <input
                    className="consignment-input"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                  />
                </div>
              </div>

              {/* COUNTRY */}
              <div className="consignment-form-field">
                <label className="consignment-label">Country</label>
                <select
                  className="consignment-select"
                  value={form.country}
                  onChange={setCountry}
                  autoComplete="country"
                >
                  <option value="">Choose a country</option>
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* STREET ADDRESS */}
              <div className="consignment-form-field">
                <label className="consignment-label">Street address</label>
                <input
                  className="consignment-input"
                  value={form.address}
                  onChange={set('address')}
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
                    autoComplete="address-level2"
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">{labels.region}</label>
                  {regionOptions ? (
                    <select
                      className="consignment-select"
                      value={form.province}
                      onChange={set('province')}
                      autoComplete="address-level1"
                    >
                      <option value="">Choose</option>
                      {regionOptions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="consignment-input"
                      value={form.province}
                      onChange={set('province')}
                      autoComplete="address-level1"
                    />
                  )}
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">{labels.postal}</label>
                  <input
                    className="consignment-input"
                    value={form.postalCode}
                    onChange={set('postalCode')}
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
              <span
                className="consignment-form-section-marker"
                aria-hidden="true"
              />
              <div>
                <h2>Consignment settings</h2>
                <p>Default terms used for this consignor</p>
              </div>
            </div>

            <div className="consignment-form-section-body">
              {/* STORE LOCATION (only when the store has more than one) */}
              {showLocation && (
                <div className="consignment-form-field">
                  <label className="consignment-label">Store location</label>
                  <select
                    className="consignment-select"
                    value={form.locationId}
                    onChange={set('locationId')}
                  >
                    <option value="">Choose a store</option>
                    {locationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
            onClick={save}
          >
            <Check size={18} />
            {editing ? 'Save changes' : 'Save consignor'}
          </button>
        </div>
      </div>
    </>
  );
}
