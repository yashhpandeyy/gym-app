import { Redirect } from 'expo-router';

import { useApp } from '@/store';

/** Entry point: send people to the right side of the app for who they are. */
export default function Index() {
  const session = useApp((s) => s.session);
  const link = useApp((s) => s.link);
  if (!session) return <Redirect href="/welcome" />;
  if (session.role === 'admin') return <Redirect href="/live/admin" />;
  if (session.role === 'member') return <Redirect href="/home" />;
  return <Redirect href={link?.status === 'pending' ? '/live/setup' : '/dashboard'} />;
}
