import test from 'node:test';
import assert from 'node:assert/strict';
import { categorizeIp, isAlwaysBlocked, isInternal, normalizeIp } from '@/common/net/ip-ranges';

test('loopback is recognised in every form it can be written', () => {
  for (const address of ['127.0.0.1', '127.1.2.3', '127.255.255.254', '::1', '::ffff:127.0.0.1', '[::1]']) {
    assert.equal(categorizeIp(address), 'loopback', address);
  }
});

test('the unspecified address is not mistaken for a public host', () => {
  // 0.0.0.0 routes to localhost on Linux, so it is a loopback bypass in disguise.
  for (const address of ['0.0.0.0', '0.1.2.3', '::', '::0']) {
    assert.equal(categorizeIp(address), 'unspecified', address);
  }
});

test('all three RFC1918 blocks are private, and their neighbours are not', () => {
  for (const address of ['10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.255', '192.168.1.1']) {
    assert.equal(categorizeIp(address), 'private', address);
  }
  for (const address of ['172.15.0.1', '172.32.0.1', '192.169.1.1', '11.0.0.1', '9.255.255.255']) {
    assert.equal(categorizeIp(address), 'public', address);
  }
});

test('cloud metadata and link-local addresses are link-local', () => {
  // 169.254.169.254 is the cloud instance metadata endpoint on AWS/GCP/Azure.
  assert.equal(categorizeIp('169.254.169.254'), 'link-local');
  assert.equal(categorizeIp('fe80::1'), 'link-local');
  assert.equal(categorizeIp('febf::1'), 'link-local');
});

test('IPv6 unique-local and multicast ranges are classified', () => {
  assert.equal(categorizeIp('fc00::1'), 'unique-local');
  assert.equal(categorizeIp('fd12:3456::1'), 'unique-local');
  assert.equal(categorizeIp('ff02::1'), 'multicast');
  assert.equal(categorizeIp('224.0.0.1'), 'multicast');
});

test('carrier-grade NAT is treated as internal, not public', () => {
  assert.equal(categorizeIp('100.64.0.1'), 'carrier-grade-nat');
  assert.equal(categorizeIp('100.127.255.255'), 'carrier-grade-nat');
  assert.equal(categorizeIp('100.63.255.255'), 'public');
  assert.equal(categorizeIp('100.128.0.1'), 'public');
});

// ::ffff:10.0.0.1 reaches exactly the same host as 10.0.0.1; judging it as "some IPv6
// address" would be a complete bypass of the private-range check.
test('IPv4-mapped IPv6 is judged by the address it carries', () => {
  assert.equal(categorizeIp('::ffff:10.0.0.1'), 'private');
  assert.equal(categorizeIp('::ffff:192.168.0.1'), 'private');
  assert.equal(categorizeIp('::ffff:169.254.169.254'), 'link-local');
  assert.equal(categorizeIp('::ffff:8.8.8.8'), 'public');
  assert.equal(categorizeIp('::ffff:0:127.0.0.1'), 'loopback');
});

test('a zone index does not hide a link-local address', () => {
  assert.equal(categorizeIp('fe80::1%eth0'), 'link-local');
});

test('ordinary public addresses stay public', () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '203.0.113.10', '2606:4700::1111']) {
    assert.equal(categorizeIp(address), 'public', address);
  }
});

test('reserved and broadcast space is not offered as public', () => {
  assert.equal(categorizeIp('255.255.255.255'), 'broadcast');
  assert.equal(categorizeIp('240.0.0.1'), 'broadcast');
});

test('malformed octets are not silently parsed as IPv4', () => {
  // "999.1.1.1" is not a valid dotted quad; falling through to the IPv6 branch and
  // calling it public would be wrong, but so would crashing.
  assert.equal(categorizeIp('999.1.1.1'), 'public');
  assert.equal(categorizeIp('not-an-ip'), 'public');
});

test('the two blocking sets separate "never" from "unless configured"', () => {
  // Nothing here is ever a PostgreSQL server, so no configuration opens them.
  for (const category of ['link-local', 'unspecified', 'multicast', 'broadcast'] as const) {
    assert.equal(isAlwaysBlocked(category), true, category);
    assert.equal(isInternal(category), false, category);
  }
  // These are reachable databases on a self-hosted install, so they are configurable.
  for (const category of ['loopback', 'private', 'unique-local', 'carrier-grade-nat'] as const) {
    assert.equal(isAlwaysBlocked(category), false, category);
    assert.equal(isInternal(category), true, category);
  }
  assert.equal(isAlwaysBlocked('public'), false);
  assert.equal(isInternal('public'), false);
});

test('addresses that reach the same host compare equal after normalising', () => {
  assert.equal(normalizeIp('::ffff:127.0.0.1'), '127.0.0.1');
  assert.equal(normalizeIp('::ffff:0:10.0.0.5'), '10.0.0.5');
  assert.equal(normalizeIp('[::1]'), '::1');
  assert.equal(normalizeIp('FE80::1%eth0'), 'fe80::1');
  assert.equal(normalizeIp('127.0.0.1'), '127.0.0.1');
  assert.equal(normalizeIp('::ffff:notanip'), '::ffff:notanip');
});
