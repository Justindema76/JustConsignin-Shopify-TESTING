import { useLoaderData } from 'react-router';
import { authenticate } from '../shopify.server';
import { getActivePlan } from '../billing.server';
import TierOneConsignmentApp from '../tier1_consignment_app';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const activePlan = await getActivePlan(admin);
  return { activePlan };
};

export default function AppIndex() {
  const { activePlan } = useLoaderData();
  return <TierOneConsignmentApp activePlan={activePlan} />;
}
