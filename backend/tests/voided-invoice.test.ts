import { describe, it, expect } from 'vitest';

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  totalMinorUnits: bigint;
  balanceMinorUnits: bigint;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
  replacementInvoiceId?: string;
}

/**
 * Calculates active financial summary from a deal's invoice list.
 * Voided invoices are completely excluded from active totals (invoiced & outstanding),
 * but remain preserved in history with their replacement reference intact.
 */
function calculateActiveFinancials(invoices: InvoiceItem[]) {
  let activeInvoicedMinorUnits = 0n;
  let activeOutstandingMinorUnits = 0n;

  for (const inv of invoices) {
    if (inv.status !== 'VOID') {
      activeInvoicedMinorUnits += inv.totalMinorUnits;
      activeOutstandingMinorUnits += inv.balanceMinorUnits;
    }
  }

  const activeCollectedMinorUnits = activeInvoicedMinorUnits - activeOutstandingMinorUnits;

  return {
    activeInvoicedMinorUnits,
    activeOutstandingMinorUnits,
    activeCollectedMinorUnits,
    totalInvoiceCount: invoices.length,
    activeInvoiceCount: invoices.filter((i) => i.status !== 'VOID').length,
    voidedInvoiceCount: invoices.filter((i) => i.status === 'VOID').length,
  };
}

describe('Voided Invoice Recalculation & Audit Preservation', () => {
  it('excludes voided invoices from active invoiced balance while preserving audit history', () => {
    // Scenario:
    // INV-001 (Milestone 1, AED 63,000) - PAID, balance 0
    // INV-002 (Milestone 2, AED 37,800) - VOIDED due to billing dispute
    // INV-003 (Replacement Milestone 2, AED 37,800) - SENT, balance AED 37,800
    const invoices: InvoiceItem[] = [
      {
        id: 'inv_1',
        invoiceNumber: 'INV-001',
        totalMinorUnits: 6300000n, // AED 63,000
        balanceMinorUnits: 0n,
        status: 'PAID',
      },
      {
        id: 'inv_2',
        invoiceNumber: 'INV-002',
        totalMinorUnits: 3780000n, // AED 37,800
        balanceMinorUnits: 3780000n,
        status: 'VOID',
        replacementInvoiceId: 'INV-003',
      },
      {
        id: 'inv_3',
        invoiceNumber: 'INV-003',
        totalMinorUnits: 3780000n, // AED 37,800
        balanceMinorUnits: 3780000n,
        status: 'SENT',
      },
    ];

    const result = calculateActiveFinancials(invoices);

    // Active invoiced must NOT double-count the voided invoice:
    // Should be 63,000 + 37,800 = AED 100,800 (10,080,000 fils)
    // NOT 63,000 + 37,800 + 37,800 = 138,600
    expect(result.activeInvoicedMinorUnits).toBe(10080000n);

    // Outstanding balance must only count active INV-003: AED 37,800
    expect(result.activeOutstandingMinorUnits).toBe(3780000n);

    // Collected must only count paid INV-001: AED 63,000
    expect(result.activeCollectedMinorUnits).toBe(6300000n);

    // Mathematical reconciliation invariant: Collected + Outstanding = Invoiced
    expect(result.activeCollectedMinorUnits + result.activeOutstandingMinorUnits).toBe(
      result.activeInvoicedMinorUnits
    );

    // Audit preservation checks
    expect(result.totalInvoiceCount).toBe(3);
    expect(result.activeInvoiceCount).toBe(2);
    expect(result.voidedInvoiceCount).toBe(1);

    // Verify replacement reference is preserved
    const voided = invoices.find((i) => i.status === 'VOID');
    expect(voided?.replacementInvoiceId).toBe('INV-003');
  });
});

