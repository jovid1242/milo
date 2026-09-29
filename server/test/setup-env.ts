import { TEST_ENV } from './test-env';

// Replaces whatever server/.env holds: tests never see development settings.
Object.assign(process.env, TEST_ENV);

// The app code under test runs as a release build would.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
