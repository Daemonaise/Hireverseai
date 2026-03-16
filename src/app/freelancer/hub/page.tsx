'use client';

import { HubDashboard } from '@/components/hub/hub-dashboard';

const FREELANCER_ID = 'dev-react-001';

export default function HubPage() {
  return <HubDashboard freelancerId={FREELANCER_ID} />;
}
