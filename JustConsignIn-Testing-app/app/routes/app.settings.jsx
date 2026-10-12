/* eslint-disable react/prop-types */

import { useEffect, useState } from 'react';
import { CreditCard, MapPin } from 'lucide-react';
import { useFetcher, useLoaderData, useNavigate } from 'react-router';
import { authenticate } from '../shopify.server';
import { PLANS, getActivePlan } from '../billing.server';
import {
  getConsignmentLocations,
  saveConsignmentLocations,
} from '../locations.server';
import Header from '../components/consignment/Header';
import '../styles/consignment-global.css';
import '../styles/consignment-forms.css';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const activePlan = await getActivePlan(admin);

  // Locations must never break the settings page; show the error in place.
  let locationData = null;
  let locationError = null;
  try {
    locationData = await getConsignmentLocations(admin);
  } catch (error) {
    console.error('Could not load Shopify locations', error);
    locationError = 'Could not load your Shopify locations. Reload to try again.';
  }

  return { activePlan, plans: PLANS, locationData, locationError };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  if (formData.get('intent') !== 'save-locations') {
    return { ok: false, error: 'Unknown action.' };
  }

  try {
    const shopId = String(formData.get('shopId') || '');
    const enabledIds = JSON.parse(String(formData.get('enabledIds') || '[]'));
    const saved = await saveConsignmentLocations(admin, shopId, enabledIds);
    return { ok: true, enabledIds: saved };
  } catch (error) {
    console.error('Could not save consignment locations', error);
    return { ok: false, error: 'Could not save locations. Please try again.' };
  }
};

function LocationsSection({ locationData, locationError }) {
  const fetcher = useFetcher();
  const [enabledIds, setEnabledIds] = useState(locationData?.enabledIds || []);
  const [dirty, setDirty] = useState(false);
  const isSaving = fetcher.state !== 'idle';

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) {
      setEnabledIds(fetcher.data.enabledIds);
      setDirty(false);
    }
  }, [fetcher.state, fetcher.data]);

  const toggle = (id) => {
    setEnabledIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
    setDirty(true);
  };

  const save = () => {
    fetcher.submit(
      {
        intent: 'save-locations',
        shopId: locationData.shopId,
        enabledIds: JSON.stringify(enabledIds),
      },
      { method: 'post' },
    );
  };

  const locations = locationData?.locations || [];
  const showDefaultNote = locationData?.isDefault && !dirty;

  return (
    <section className="consignment-form-section">
      <div className="consignment-form-section-head">
        <span className="consignment-form-section-marker" aria-hidden="true" />
        <MapPin size={17} aria-hidden="true" />
        <div>
          <h2>Locations</h2>
          <p>
            Imported from your Shopify locations. Choose which ones accept
            consignors. Manage names and addresses in Shopify.
          </p>
        </div>
      </div>

      <div className="consignment-form-section-body">
        {locationError ? (
          <p className="consignment-form-help">{locationError}</p>
        ) : locations.length === 0 ? (
          <p className="consignment-form-help">
            No locations found. Add a location in Shopify under Settings → Locations.
          </p>
        ) : (
          <>
            {showDefaultNote && (
              <p className="consignment-form-help" style={{ marginBottom: 12 }}>
                {enabledIds.length
                  ? 'Your store location was enabled automatically. Save to confirm.'
                  : 'No locations are enabled yet. Choose the stores that accept consignors and save.'}
              </p>
            )}

            <div style={{ display: 'grid', gap: 10 }}>
              {locations.map((location) => {
                const checked = enabledIds.includes(location.id);
                return (
                  <label
                    key={location.id}
                    className="consignment-card"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: 14,
                      cursor: isSaving ? 'default' : 'pointer',
                      opacity: location.isActive ? 1 : 0.7,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isSaving}
                      onChange={() => toggle(location.id)}
                      style={{ marginTop: 3 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <strong>{location.name}</strong>
                        <span
                          className={`consignment-badge ${location.isActive ? 'active' : 'returned'}`}
                        >
                          {location.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {location.isFulfillmentService && (
                          <span className="consignment-badge draft">
                            Fulfillment service
                          </span>
                        )}
                      </div>
                      {location.addressLines.length > 0 && (
                        <p className="consignment-form-help" style={{ marginTop: 4 }}>
                          {location.addressLines.join(', ')}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            {fetcher.data && !fetcher.data.ok && (
              <p className="consignment-form-help" style={{ color: '#b42318' }}>
                {fetcher.data.error}
              </p>
            )}

            <div className="consignment-form-actions-inner">
              <button
                type="button"
                className="consignment-btn"
                disabled={isSaving || (!dirty && !locationData?.isDefault)}
                onClick={save}
              >
                {isSaving ? 'Saving…' : 'Save locations'}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default function SettingsRoute() {
  const navigate = useNavigate();
  const { activePlan, plans, locationData, locationError } = useLoaderData();

  const activePlanDetails = activePlan ? plans[activePlan] : null;

  const planLabel =
    activePlan === 'TIER2'
      ? 'Manual + Shopify Sync'
      : activePlan === 'TIER1'
        ? 'Manual'
        : 'No active plan';

  const planActionLabel =
    activePlan === 'TIER1'
      ? 'Upgrade to Shopify Sync'
      : activePlan === 'TIER2'
        ? 'Manage plan'
        : 'Choose plan';

  return (
    <div className="consignment">
      <Header
        eyebrow="Preferences"
        title="Settings"
        onBack={() => navigate('/app')}
      />

      <div className="consignment-body">
        <div className="consignment-settings-shell">
          <section className="consignment-form-section">
            <div className="consignment-form-section-head">
              <span
                className="consignment-form-section-marker"
                aria-hidden="true"
              />

              <CreditCard size={17} aria-hidden="true" />

              <div>
                <h2>Plan and billing</h2>
                <p>View your current plan or change your subscription.</p>
              </div>
            </div>

            <div className="consignment-form-section-body">
              <div className="consignment-form-grid consignment-form-grid-2">
                <div className="consignment-form-field">
                  <span className="consignment-label">Current plan</span>
                  <strong>{planLabel}</strong>
                  <p className="consignment-form-help">
                    {activePlan === 'TIER2'
                      ? 'Shopify product sync, POS and online publishing are enabled.'
                      : activePlan === 'TIER1'
                        ? 'Manual consignment workflow is enabled.'
                        : 'Choose a plan to continue using JustConsignIn.'}
                  </p>
                </div>

                <div className="consignment-form-field">
                  <span className="consignment-label">Billing</span>
                  <strong>
                    {activePlanDetails
                      ? `$${activePlanDetails.amount} ${activePlanDetails.currencyCode} / 30 days`
                      : '-'}
                  </strong>
                  <p className="consignment-form-help">
                    Subscription changes are reviewed and approved through Shopify.
                  </p>
                </div>
              </div>

              <div className="consignment-form-actions-inner">
                <button
                  type="button"
                  className="consignment-btn"
                  onClick={() => navigate('/app/plans')}
                >
                  {planActionLabel}
                </button>
              </div>
            </div>
          </section>

          <LocationsSection
            locationData={locationData}
            locationError={locationError}
          />
        </div>
      </div>
    </div>
  );
}
