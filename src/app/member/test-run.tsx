import { router } from 'expo-router';

import { TestRunner } from '@/components/fitness/TestRunner';
import { Screen } from '@/components/ui';
import { useApp } from '@/store';

/** A member taking the gym's strength and endurance test on their own phone. */
export default function TestRun() {
  const memberId = useApp((st) => st.session?.memberId);
  if (!memberId) return null;
  return (
    <Screen header="stack" title="Strength test">
      <TestRunner memberId={memberId} onClose={() => router.back()} />
    </Screen>
  );
}
