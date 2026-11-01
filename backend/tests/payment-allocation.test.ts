import { describe, it, expect } from 'vitest';

interface PaymentAllocationItem {
  paymentId: string;
  invoiceId: string;
  dealId: string;
  allocatedMinorUnits: bigint;
}

interface PaymentRecord {
  id: string;
  totalMinorUnits: bigint;
  allocations: PaymentAllocationItem[];
}

/**
 * Pure allocation logic helper validating multi-deal split correctness.
 * When a single payment (e.g., AED 25,000) settles multiple invoices across different deals,
 * each deal must receive ONLY its allocated share — never the full payment amount.
 */
function allocatePaymentToDeals(payment: PaymentRecord) {
  const dealCredits: Record<string, bigint> = {};
  let totalAllocated = 0n;

  for (const alloc of payment.allocations) {
    totalAllocated += alloc.allocatedMinorUnits;
    dealCredits[alloc.dealId] = (dealCredits[alloc.dealId] || 0n) + alloc.allocatedMinorUnits;
  }

  if (totalAllocated > payment.totalMinorUnits) {
    throw new Error('Over-allocation: Sum of allocations exceeds payment amount');
  }

  return {
    dealCredits,
    totalAllocated,
    unallocatedBalance: payment.totalMinorUnits - totalAllocated,
  };
}

describe('Payment Allocation: Multi-Deal Split Correctness', () => {
  it('correctly splits a single payment across multiple deals without assigning the full amount to each', () => {
    // Payment PAY-001 = AED 25,000 (2,500,000 fils)
    // Invoice A on Deal 1: AED 10,000 (1,000,000 fils)
    // Invoice B on Deal 2: AED 15,000 (1,500,000 fils)
    const payment: PaymentRecord = {
      id: 'PAY-001',
      totalMinorUnits: 2500000n, // AED 25,000 in fils
      allocations: [
        {
          paymentId: 'PAY-001',
          invoiceId: 'INV-101',
          dealId: 'DEAL-A',
          allocatedMinorUnits: 1000000n, // AED 10,000
        },
        {
          paymentId: 'PAY-001',
          invoiceId: 'INV-205',
          dealId: 'DEAL-B',
          allocatedMinorUnits: 1500000n, // AED 15,000
        },
      ],
    };

    const result = allocatePaymentToDeals(payment);

    // Verify Deal A receives exactly AED 10,000 credit (NOT AED 25,000)
    expect(result.dealCredits['DEAL-A']).toBe(1000000n);
    // Verify Deal B receives exactly AED 15,000 credit (NOT AED 25,000)
    expect(result.dealCredits['DEAL-B']).toBe(1500000n);

    // Verify invariant: total allocated matches payment sum exactly
    expect(result.totalAllocated).toBe(2500000n);
    expect(result.unallocatedBalance).toBe(0n);
  });

  it('rejects allocation when sum of allocations exceeds payment total', () => {
    const invalidPayment: PaymentRecord = {
      id: 'PAY-002',
      totalMinorUnits: 2000000n, // AED 20,000
      allocations: [
        {
          paymentId: 'PAY-002',
          invoiceId: 'INV-101',
          dealId: 'DEAL-A',
          allocatedMinorUnits: 1500000n,
        },
        {
          paymentId: 'PAY-002',
          invoiceId: 'INV-205',
          dealId: 'DEAL-B',
          allocatedMinorUnits: 1000000n, // Total = 25,000 > 20,000
        },
      ],
    };

    expect(() => allocatePaymentToDeals(invalidPayment)).toThrowError(
      'Over-allocation: Sum of allocations exceeds payment amount'
    );
  });
});
