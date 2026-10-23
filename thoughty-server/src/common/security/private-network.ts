import { BlockList, isIPv4 } from 'node:net';

const PRIVATE_NETWORKS = new BlockList();
PRIVATE_NETWORKS.addSubnet('10.0.0.0', 8, 'ipv4');
PRIVATE_NETWORKS.addSubnet('172.16.0.0', 12, 'ipv4');
PRIVATE_NETWORKS.addSubnet('192.168.0.0', 16, 'ipv4');
PRIVATE_NETWORKS.addSubnet('127.0.0.0', 8, 'ipv4');
PRIVATE_NETWORKS.addSubnet('169.254.0.0', 16, 'ipv4');
PRIVATE_NETWORKS.addSubnet('100.64.0.0', 10, 'ipv4');
PRIVATE_NETWORKS.addSubnet('fc00::', 7, 'ipv6');
PRIVATE_NETWORKS.addSubnet('fe80::', 10, 'ipv6');
PRIVATE_NETWORKS.addAddress('::1', 'ipv6');

/**
 * Whether a client address is loopback, link-local, or on a private network. With `trust proxy`
 * set (see trust-proxy.ts), a request that came through the public ingress carries the real
 * client's address, so only in-cluster callers such as Prometheus count as private.
 */
export function isPrivateNetworkAddress(address: string | undefined): boolean {
  if (!address) {
    return false;
  }
  const ip = address.startsWith('::ffff:') && isIPv4(address.slice(7)) ? address.slice(7) : address;
  try {
    return PRIVATE_NETWORKS.check(ip, isIPv4(ip) ? 'ipv4' : 'ipv6');
  } catch {
    return false;
  }
}
