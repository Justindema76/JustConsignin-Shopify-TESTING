import ConsignmentIntakeApp from './consignment_intake';
import './styles/manual-intake-save.css';

/**
 * Stable Tier 1 entry point.
 *
 * Do not mutate React-rendered screens from this wrapper. Tier-specific UI
 * changes must be implemented inside consignment_intake.jsx so navigation,
 * form state, image saving, and Shopify actions remain reliable.
 *
 * Manual intake saving is intentionally available for both Tier 1 and Tier 2.
 */
export default function TierOneConsignmentApp({ activePlan = null }) {
  return <ConsignmentIntakeApp activePlan={activePlan} />;
}
