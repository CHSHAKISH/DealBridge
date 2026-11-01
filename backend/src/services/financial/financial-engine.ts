/**
 * Financial Calculation Engine for UAE VAT (5%) and Milestone Billing.
 * 
 * Guarantees:
 * 1. Uses integer minor units (fils: 1 AED = 100 fils) to eliminate IEEE 754 floating-point drift.
 * 2. Mathematical invariant: Milestone 1 + Milestone 2 + Milestone 3 === Total Deal Value.
 */

export interface MilestoneBreakdown {
  milestoneNumber: number;
  name: string;
  percentage: number;
  baseAmountMinorUnits: bigint;
  vatAmountMinorUnits: bigint;
  totalAmountMinorUnits: bigint;
  // Human readable AED amounts for display/APIs
  baseAmountAed: number;
  vatAmountAed: number;
  totalAmountAed: number;
}

export interface DealFinancials {
  dealValueMinorUnits: bigint;
  vatRatePercent: number;
  vatAmountMinorUnits: bigint;
  totalAmountMinorUnits: bigint;
  dealValueAed: number;
  vatAmountAed: number;
  totalAmountAed: number;
  milestones: MilestoneBreakdown[];
}

export class FinancialEngine {
  private static FILS_MULTIPLIER = 100n;

  /**
   * Converts AED decimal amount to integer fils (minor units)
   * Example: 120000.00 -> 12000000n
   */
  static aedToFils(aed: number | string): bigint {
    const numeric = typeof aed === 'string' ? parseFloat(aed) : aed;
    if (isNaN(numeric)) return 0n;
    // Round to avoid floating-point artifacts like 120000 * 100 = 11999999.9999
    return BigInt(Math.round(numeric * 100));
  }

  /**
   * Converts integer fils to AED decimal number
   * Example: 12000000n -> 120000.00
   */
  static filsToAed(fils: bigint): number {
    return Number(fils) / 100;
  }

  /**
   * Calculates 5% UAE VAT and 3 milestone invoices for a given deal base amount
   * Scenario:
   *   Base: AED 120,000
   *   VAT 5%: AED 6,000
   *   Total: AED 126,000
   * 
   *   M1 (Signing - 50%): AED 60,000 base + AED 3,000 VAT = AED 63,000
   *   M2 (Go-Live - 30%): AED 36,000 base + AED 1,800 VAT = AED 37,800
   *   M3 (90-day - 20%):  AED 24,000 base + AED 1,200 VAT = AED 25,200
   */
  static calculateDealFinancials(dealValueAed: number, vatRate = 5.0): DealFinancials {
    const dealValueMinorUnits = this.aedToFils(dealValueAed);
    
    // VAT calculation: (dealValue * vatRate * 100) / 10000
    // Using BigInt arithmetic: (dealValueMinorUnits * 5n) / 100n
    const vatRateInt = BigInt(Math.round(vatRate * 100)); // 500 for 5.00%
    const vatAmountMinorUnits = (dealValueMinorUnits * vatRateInt) / 10000n;
    const totalAmountMinorUnits = dealValueMinorUnits + vatAmountMinorUnits;

    // Milestone percentages: 50%, 30%, 20%
    const milestoneDefs = [
      { number: 1, name: 'Signing', pct: 50 },
      { number: 2, name: 'Go-Live', pct: 30 },
      { number: 3, name: '90 Days Post Go-Live', pct: 20 },
    ];

    let allocatedBaseMinor = 0n;
    let allocatedVatMinor = 0n;

    const milestones: MilestoneBreakdown[] = milestoneDefs.map((def, idx) => {
      let mBase: bigint;
      let mVat: bigint;

      // For the last milestone, use remainder to prevent 1-fil rounding discrepancy
      if (idx === milestoneDefs.length - 1) {
        mBase = dealValueMinorUnits - allocatedBaseMinor;
        mVat = vatAmountMinorUnits - allocatedVatMinor;
      } else {
        const pctBigInt = BigInt(def.pct);
        mBase = (dealValueMinorUnits * pctBigInt) / 100n;
        mVat = (vatAmountMinorUnits * pctBigInt) / 100n;
        allocatedBaseMinor += mBase;
        allocatedVatMinor += mVat;
      }

      const mTotal = mBase + mVat;

      return {
        milestoneNumber: def.number,
        name: def.name,
        percentage: def.pct,
        baseAmountMinorUnits: mBase,
        vatAmountMinorUnits: mVat,
        totalAmountMinorUnits: mTotal,
        baseAmountAed: this.filsToAed(mBase),
        vatAmountAed: this.filsToAed(mVat),
        totalAmountAed: this.filsToAed(mTotal),
      };
    });

    return {
      dealValueMinorUnits,
      vatRatePercent: vatRate,
      vatAmountMinorUnits,
      totalAmountMinorUnits,
      dealValueAed: this.filsToAed(dealValueMinorUnits),
      vatAmountAed: this.filsToAed(vatAmountMinorUnits),
      totalAmountAed: this.filsToAed(totalAmountMinorUnits),
      milestones,
    };
  }

  /**
   * Verifies the milestone sum invariant
   */
  static verifyInvariant(financials: DealFinancials): boolean {
    const sumBase = financials.milestones.reduce((acc, m) => acc + m.baseAmountMinorUnits, 0n);
    const sumVat = financials.milestones.reduce((acc, m) => acc + m.vatAmountMinorUnits, 0n);
    const sumTotal = financials.milestones.reduce((acc, m) => acc + m.totalAmountMinorUnits, 0n);

    return (
      sumBase === financials.dealValueMinorUnits &&
      sumVat === financials.vatAmountMinorUnits &&
      sumTotal === financials.totalAmountMinorUnits
    );
  }
}

