import { Redirect } from 'expo-router';

/** Members join on the mobile app, so the website sends everyone to its one front door. */
export default function ToWelcome() {
  return <Redirect href="/welcome" />;
}
