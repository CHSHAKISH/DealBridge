import { describe, it, expect } from 'vitest';
import { FinancialEngine } from '../src/services/financial/financial-engine.js';

describe('FinancialEngine: Money & UAE VAT Arithmetic', () => {
  it('calculates 5% UAE VAT exactly without floating-point error', () => {
    // 120,000 AED base -> 6,000 AED VAT -> 126,000 AED total
    const financials = FinancialEngine.calculateDealFinancials(120000, 5.0);

    expect(financials.dealValueAed).toBe(120000);
    expect(financials.vatAmountAed).toBe(6000);
    expect(financials.totalAmountAed).toBe(126000);

    expect(financials.dealValueMinorUnits).toBe(12000000n);
    expect(financials.vatAmountMinorUnits).toBe(600000n);
    expect(financials.totalAmountMinorUnits).toBe(12600000n);
  });

  it('splits deal into exact milestone invoices (50%, 30%, 20%)', () => {
    const financials = FinancialEngine.calculateDealFinancials(120000, 5.0);

    // Milestone 1: 50% Signing
    const m1 = financials.milestones[0];
    expect(m1.name).toBe('Signing');
    expect(m1.percentage).toBe(50);
    expect(m1.baseAmountAed).toBe(60000);
    expect(m1.vatAmountAed).toBe(3000);
    expect(m1.totalAmountAed).toBe(63000);

    // Milestone 2: 30% Go-Live
    const m2 = financials.milestones[1];
    expect(m2.name).toBe('Go-Live');
    expect(m2.percentage).toBe(30);
    expect(m2.baseAmountAed).toBe(36000);
    expect(m2.vatAmountAed).toBe(1800);
    expect(m2.totalAmountAed).toBe(37800);

    // Milestone 3: 20% 90-day post go-live
    const m3 = financials.milestones[2];
    expect(m3.name).toBe('90 Days Post Go-Live');
    expect(m3.percentage).toBe(20);
    expect(m3.baseAmountAed).toBe(24000);
    expect(m3.vatAmountAed).toBe(1200);
    expect(m3.totalAmountAed).toBe(25200);
  });

  it('maintains mathematical invariant: sum of milestones equals sales order total', () => {
    const financials = FinancialEngine.calculateDealFinancials(120000, 5.0);
    const isValid = FinancialEngine.verifyInvariant(financials);

    expect(isValid).toBe(true);

    const sumTotal = financials.milestones.reduce((acc, m) => acc + m.totalAmountAed, 0);
    expect(sumTotal).toBe(126000);
  });

  it('handles arbitrary odd amounts with penny-exact rounding', () => {
    // 77,777.77 AED with 5% VAT
    const financials = FinancialEngine.calculateDealFinancials(77777.77, 5.0);
    expect(FinancialEngine.verifyInvariant(financials)).toBe(true);
  });
});

