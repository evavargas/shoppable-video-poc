export const LIVE_STATUSES = ['live', 'scheduled', 'ended'] as const;
export type HostStatus = (typeof LIVE_STATUSES)[number];

/** Same shape the Firestore rules accept for a pinned product. */
export const isValidHandle = (h: unknown): h is string => typeof h === 'string' && /^[A-Za-z0-9_-]{1,255}$/.test(h);

const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * UNSIGNED custom token (alg "none"). Only the Auth *emulator* accepts it; real Firebase Auth rejects it,
 * which is exactly why the host panel cannot write in production. Real hosts would get a signed token
 * (or a normal login + custom claim) minted by a server with the Admin SDK.
 */
export function devHostToken(projectId: string, uid = 'poc-host'): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iss: `firebase-auth-emulator@${projectId}.iam.gserviceaccount.com`,
    sub: `firebase-auth-emulator@${projectId}.iam.gserviceaccount.com`,
    iat: now,
    exp: now + 3600,
    uid,
    claims: { host: true },
  };
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.`;
}

export interface LiveState {
  status: HostStatus;
  pinnedProduct: string | null;
}
