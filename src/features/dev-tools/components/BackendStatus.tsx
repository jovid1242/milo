import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { backendConfig } from '@/config/backend';
import { useRepositories } from '@/data/repository-provider';
import type { CourseOrigin, CourseUpdateResult } from '@/data/repositories/types';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';
import { spacing } from '@/theme';

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function describeOrigin(origin: CourseOrigin): string {
  if (origin.source === 'bundled') return `Bundled course, version ${origin.version}`;
  const hash = origin.contentHash?.slice(0, 8) ?? '?';
  const saved = origin.savedAt ? ` · saved ${time(origin.savedAt)}` : '';
  return `Downloaded course (API cache), version ${origin.version} · ${hash}${saved}`;
}

function describeUpdate(result: CourseUpdateResult): string {
  switch (result.status) {
    case 'current':
      return `The saved course is current (version ${result.version}).`;
    case 'saved':
      return `Version ${result.version} downloaded and saved: in use from the next launch.`;
    case 'unsupported':
      return `The server's course needs a newer app (format ${result.schemaVersion}).`;
    case 'rejected':
      return `Refused, the saved course stays: ${result.reason}`;
  }
}

/** Which backend this build talks to, who is signed in, and where the course came from. */
export function BackendStatus() {
  const repositories = useRepositories();
  const status = useAuthStore((state) => state.status);
  const email = useAuthStore((state) => state.account?.email ?? null);
  const [origin, setOrigin] = useState<CourseOrigin | null>(null);
  const [update, setUpdate] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const updates = repositories.courseUpdates;

  useEffect(() => {
    updates
      ?.origin()
      .then(setOrigin)
      .catch((error: unknown) => logger.warn('course origin unavailable', error));
  }, [updates]);

  const check = () => {
    if (!updates || checking) return;
    setChecking(true);
    updates
      .check()
      .then((result) => setUpdate(describeUpdate(result)))
      .catch((error: unknown) =>
        setUpdate(`Check failed: ${error instanceof Error ? error.message : String(error)}`),
      )
      .finally(() => setChecking(false));
  };

  return (
    <View style={styles.status}>
      <AppText variant="caption" color="secondary">
        {backendConfig.apiUrl ? `API: ${backendConfig.apiUrl}` : 'Local mode: no API configured'}
      </AppText>
      {repositories.auth.mode === 'remote' ? (
        <AppText variant="caption" color="secondary">
          {status === 'authenticated' ? `Signed in: ${email ?? '—'}` : 'Signed out'}
        </AppText>
      ) : null}
      <AppText variant="caption" color="secondary" testID="dev-course-origin">
        {updates
          ? origin
            ? describeOrigin(origin)
            : 'Course: not loaded yet'
          : 'Bundled course (EXPO_PUBLIC_COURSE_SOURCE or local mode)'}
      </AppText>
      {update ? (
        <AppText variant="caption" color="brand">
          {update}
        </AppText>
      ) : null}
      {updates ? (
        <Button
          label="Check for a course update"
          size="sm"
          variant="secondary"
          haptic={null}
          loading={checking}
          onPress={check}
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { gap: spacing[1] },
  button: { alignSelf: 'flex-start', marginTop: spacing[2] },
});
