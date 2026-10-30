import { Redirect } from 'expo-router';

/** The website has one front door; owner sign-in and creation live on /welcome. */
export default function ToWelcome() {
  return <Redirect href="/welcome" />;
}
