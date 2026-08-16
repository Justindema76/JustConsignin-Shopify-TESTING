import ConsignmentIntakeApp from './consignment_intake';

/**
 * Testing entry point.
 *
 * Tier 2 UI is intentionally unlocked in this TESTING repository so the
 * Shopify product-sync workflow can be developed without the upgrade gate.
 * Restore activePlan passthrough before shipping this behavior to production.
 */
export default function TierOneConsignmentApp() {
  return <ConsignmentIntakeApp activePlan="TIER2" />;
}
