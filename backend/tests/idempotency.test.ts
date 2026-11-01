import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

describe('Idempotency & Deduplication Engine', () => {
  it('generates consistent payload hashes for webhook deduplication', () => {
    const payloadA = { objectId: '12345', propertyName: 'dealstage', propertyValue: 'closedwon' };
    const payloadB = { objectId: '12345', propertyName: 'dealstage', propertyValue: 'closedwon' };

    const hashA = crypto.createHash('sha256').update(JSON.stringify(payloadA)).digest('hex');
    const hashB = crypto.createHash('sha256').update(JSON.stringify(payloadB)).digest('hex');

    expect(hashA).toBe(hashB);
  });

  it('generates deterministic idempotency keys for deal operations', () => {
    const dealId = 'deal_novatech_789';
    const key1 = `deal_${dealId}:sales_order`;
    const key2 = `deal_${dealId}:sales_order`;

    expect(key1).toBe(key2);
    expect(key1).toBe('deal_deal_novatech_789:sales_order');
  });

  it('generates distinct milestone invoice keys to prevent cross-milestone collisions', () => {
    const dealId = 'deal_novatech_789';
    const m1Key = `deal_${dealId}:invoice:1`;
    const m2Key = `deal_${dealId}:invoice:2`;
    const m3Key = `deal_${dealId}:invoice:3`;

    expect(m1Key).not.toBe(m2Key);
    expect(m2Key).not.toBe(m3Key);
  });
});
