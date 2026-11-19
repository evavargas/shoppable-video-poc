import { devHostToken, isValidHandle } from './logic';

describe('host logic', () => {
  it('accepts only handles the Firestore rules accept', () => {
    expect(isValidHandle('combo-roll_1')).toBe(true);
    for (const bad of ['', 'a b', 'a/b', 'x'.repeat(256), null, 5]) expect(isValidHandle(bad)).toBe(false);
  });

  it('builds an unsigned emulator token that carries the host claim', () => {
    const [h, p, sig] = devHostToken('demo-x').split('.');
    const dec = (s: string) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));
    expect(dec(h!).alg).toBe('none');
    expect(dec(p!).claims).toEqual({ host: true });
    expect(sig).toBe('');
  });
});
