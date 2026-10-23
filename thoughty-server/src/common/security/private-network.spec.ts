import { isPrivateNetworkAddress } from './private-network';

describe('isPrivateNetworkAddress', () => {
  it.each(['10.42.0.17', '172.20.1.5', '192.168.1.10', '127.0.0.1', '::1', '::ffff:10.42.0.17', 'fd00::5', 'fe80::1', '100.64.0.3'])(
    'treats %s as private',
    (address) => {
      expect(isPrivateNetworkAddress(address)).toBe(true);
    },
  );

  it.each(['203.0.113.9', '8.8.8.8', '172.32.0.1', '::ffff:8.8.8.8', '2001:db8::1', '', undefined, 'not-an-ip'])(
    'treats %s as public',
    (address) => {
      expect(isPrivateNetworkAddress(address)).toBe(false);
    },
  );
});
