import { useState } from 'react';
import { Check } from 'lucide-react';
import { Header } from '../../components/consignment/SharedPieces';

export default function EditConsignorPage({
  consignor,
  onBack,
  onSave,
}) {
  const [form, setForm] = useState({
    number: consignor.number,
    firstName: consignor.firstName || '',
    lastName: consignor.lastName || '',
    phone: consignor.phone || '',
    email: consignor.email || '',
    address: consignor.address || '',
    city: consignor.city || '',
    province: consignor.province || 'Ontario',
    postalCode: consignor.postalCode || '',
    commissionPct: consignor.commissionPct ?? 50,
    unsoldPreference:
      consignor.unsoldPreference || 'Please return',
    notes: consignor.notes || '',
  });

  const set = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const valid =
    form.firstName.trim() &&
    form.lastName.trim();

  return (
    <>
      <Header
        eyebrow={`Consignor #${consignor.number}`}
        title="Edit consignor"
        onBack={onBack}
      />

      <div className="consignment-body">
        <div className="consignment-field">
          <label className="consignment-label">
            Consignor number
          </label>

          <input
            className="consignment-input"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={form.number}
            onChange={set('number')}
          />
        </div>

        <div className="consignment-row2">
          <div className="consignment-field">
            <label className="consignment-label">
              First name
            </label>

            <input
              className="consignment-input"
              value={form.firstName}
              onChange={set('firstName')}
              placeholder="Sarah"
            />
          </div>

          <div className="consignment-field">
            <label className="consignment-label">
              Last name
            </label>

            <input
              className="consignment-input"
              value={form.lastName}
              onChange={set('lastName')}
              placeholder="Lee"
            />
          </div>
        </div>

        <div className="consignment-row2">
          <div className="consignment-field">
            <label className="consignment-label">
              Phone
            </label>

            <input
              className="consignment-input"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="(416) 555-0134"
            />
          </div>

          <div className="consignment-field">
            <label className="consignment-label">
              Email
            </label>

            <input
              className="consignment-input"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="sarah@email.com"
            />
          </div>
        </div>

        <div className="consignment-field">
          <label className="consignment-label">
            Street address
          </label>

          <input
            className="consignment-input"
            value={form.address}
            onChange={set('address')}
            placeholder="123 Main Street"
            autoComplete="street-address"
          />
        </div>

        <div className="consignment-row2">
          <div className="consignment-field">
            <label className="consignment-label">
              City
            </label>

            <input
              className="consignment-input"
              value={form.city}
              onChange={set('city')}
              placeholder="Hamilton"
              autoComplete="address-level2"
            />
          </div>

          <div className="consignment-field">
            <label className="consignment-label">
              Province
            </label>

            <input
              className="consignment-input"
              value={form.province}
              onChange={set('province')}
              placeholder="Ontario"
              autoComplete="address-level1"
            />
          </div>
        </div>

        <div className="consignment-field">
          <label className="consignment-label">
            Postal code
          </label>

          <input
            className="consignment-input"
            value={form.postalCode}
            onChange={set('postalCode')}
            placeholder="L8E 1A1"
            autoCapitalize="characters"
            autoComplete="postal-code"
          />
        </div>

        <div className="consignment-field">
          <label className="consignment-label">
            Commission split — consignor gets
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

        <div className="consignment-field">
          <label className="consignment-label">
            Unsold items
          </label>

          <select
            className="consignment-select"
            value={form.unsoldPreference}
            onChange={set('unsoldPreference')}
          >
            <option value="Please return">
              Please return
            </option>

            <option value="Donation okay">
              Donation okay
            </option>

            <option value="Ask me first">
              Ask me first
            </option>
          </select>
        </div>

        <div className="consignment-field">
          <label className="consignment-label">
            Notes (optional)
          </label>

          <textarea
            className="consignment-textarea"
            rows={2}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Anything worth remembering"
          />
        </div>
      </div>

      <div className="consignment-fab-wrap">
        <button
          type="button"
          className="consignment-btn"
          disabled={!valid}
          onClick={() =>
            onSave(consignor.id, form)
          }
        >
          <Check size={18} />
          Save changes
        </button>
      </div>
    </>
  );
}