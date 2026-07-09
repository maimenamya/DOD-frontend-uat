import { isJwtExpired, jwtExpiresAtMs } from './jwt-expiry.util';

function makeToken(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: expSeconds }));
  return `${header}.${payload}.signature`;
}

describe('jwt-expiry.util', () => {
  it('reads exp from payload', () => {
    const exp = 1_700_000_000;
    expect(jwtExpiresAtMs(makeToken(exp))).toBe(exp * 1000);
  });

  it('detects expired token', () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    expect(isJwtExpired(makeToken(past))).toBe(true);
  });

  it('detects valid token', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(isJwtExpired(makeToken(future))).toBe(false);
  });
});
