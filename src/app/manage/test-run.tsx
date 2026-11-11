import { router, useLocalSearchParams } from 'expo-router';

import { TestRunner } from '@/components/fitness/TestRunner';
import { Empty, Screen } from '@/components/ui';
import { firstName } from '@/lib/format';
import { useApp } from '@/store';

/** Staff testing a member at the gym. The result goes on the member's record and shows in their app. */
export default function StaffTestRun() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const member = useApp((st) => st.members.find((m) => m.id === memberId));
  const staffName = useApp((st) => st.session?.staffName);
  if (!member) {
    return (
      <Screen header="stack" title="Strength test">
        <Empty icon="person-outline" title="Member not found" body="They may have been removed." action="Back" onAction={() => router.back()} />
      </Screen>
    );
  }
  return (
    <Screen header="stack" title={`Testing ${firstName(member.name)}`}>
      <TestRunner memberId={member.id} by={staffName || 'the gym'} onClose={() => router.back()} />
    </Screen>
  );
}
