/* eslint-disable react/prop-types */

import { CreditCard } from 'lucide-react';
import { useLoaderData, useNavigate } from 'react-router';
import { authenticate } from '../shopify.server';
import { PLANS, getActivePlan } from '../billing.server';
import Header from '../components/consignment/Header';
import '../styles/consignment-global.css';
import '../styles/consignment-forms.css';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const activePlan = await getActivePlan(admin);
  return { activePlan, plans: PLANS };
};

export default function SettingsRoute() {
  const navigate = useNavigate();
  const { activePlan, plans } = useLoaderData();

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
        </div>
      </div>
    </div>
  );
}
