import { readBackendConfig } from '../backend';

describe('backend config', () => {
  it('is local without an API URL: no account, the bundled course', () => {
    expect(readBackendConfig({})).toEqual({ apiUrl: null, course: 'bundled' });
    expect(readBackendConfig({ apiUrl: '  ' })).toEqual({ apiUrl: null, course: 'bundled' });
  });

  it('talks to the API when one is given, course included', () => {
    expect(readBackendConfig({ apiUrl: 'http://localhost:3000/api/v1/' })).toEqual({
      apiUrl: 'http://localhost:3000/api/v1',
      course: 'api',
    });
  });

  it('can keep the bundled course while accounts use the API', () => {
    expect(
      readBackendConfig({ apiUrl: 'https://api.milo.app/api/v1', courseSource: 'bundled' }),
    ).toEqual({ apiUrl: 'https://api.milo.app/api/v1', course: 'bundled' });
  });

  it('refuses a malformed setting instead of quietly running local', () => {
    expect(() => readBackendConfig({ apiUrl: 'localhost:3000' })).toThrow(/EXPO_PUBLIC_API_URL/);
    expect(() => readBackendConfig({ apiUrl: 'ftp://milo.app' })).toThrow(/http\(s\)/);
    expect(() =>
      readBackendConfig({ apiUrl: 'http://localhost:3000', courseSource: 'cms' }),
    ).toThrow(/EXPO_PUBLIC_COURSE_SOURCE/);
  });
});
