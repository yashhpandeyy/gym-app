import * as Updates from 'expo-updates';
import { useEffect } from 'react';

import { isUrgent, restartIntoUpdate, updatesOn, useUpdateChecks, useUpdateReady } from '@/lib/updates';
import { useApp } from '@/store';

/**
 * Keeps the app on the newest published update without putting anything on screen. A downloaded
 * update runs the next time the app opens; on the sign-in screens the button shows "Updated" and the
 * app switches to it as soon as someone signs in, which is a moment they're already waiting.
 * Urgent fixes restart straight away.
 */
export function UpdateWatcher() {
  return updatesOn ? <Watcher /> : null;
}

function Watcher() {
  const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();
  useUpdateChecks();
  const urgent = isUpdatePending && isUrgent(downloadedUpdate?.manifest);

  useEffect(() => {
    useUpdateReady.setState({ ready: isUpdatePending });
    if (urgent) restartIntoUpdate();
  }, [isUpdatePending, urgent]);

  // Someone just signed in and a newer version is waiting: move to it now, once the sign-in is saved.
  useEffect(
    () =>
      useApp.subscribe((s, prev) => {
        if (!prev.session && s.session && useUpdateReady.getState().ready) setTimeout(restartIntoUpdate, 900);
      }),
    [],
  );

  return null;
}
