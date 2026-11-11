import { router } from 'expo-router';

import { MemberWelcome } from '@/components/auth/MemberWelcome';

export default function Welcome() {
  return <MemberWelcome onOwner={(mode) => router.push({ pathname: '/owner', params: { mode } })} />;
}
