import { describe, it, expect } from 'vitest';
import { CustomerMatcher } from '../src/services/matching/customer-matcher.js';

describe('CustomerMatcher: Normalization & Matching Rules', () => {
  it('normalizes company names by lowercasing and stripping whitespace', () => {
    const raw = '   NovaTech   Solutions   ';
    expect(CustomerMatcher.normalizeCompanyName(raw)).toBe('novatech solutions');
  });

  it('removes common legal suffixes (LLC, Ltd, Inc, FZ-LLC)', () => {
    expect(CustomerMatcher.normalizeCompanyName('NovaTech Solutions LLC')).toBe('novatech solutions');
    expect(CustomerMatcher.normalizeCompanyName('NovaTech Solutions Ltd.')).toBe('novatech solutions');
    expect(CustomerMatcher.normalizeCompanyName('NovaTech Solutions Incorporated')).toBe('novatech solutions');
    expect(CustomerMatcher.normalizeCompanyName('NovaTech Solutions FZ-LLC')).toBe('novatech solutions');
  });

  it('strips punctuation and special characters', () => {
    expect(CustomerMatcher.normalizeCompanyName('Nova-Tech, Solutions & Co.!')).toBe('novatech solutions co');
  });

  it('produces identical normalized names for equivalent corporate entities', () => {
    const variantA = 'Acme Global Services LLC';
    const variantB = '  ACME GLOBAL SERVICES LTD. ';
    expect(CustomerMatcher.normalizeCompanyName(variantA)).toBe(CustomerMatcher.normalizeCompanyName(variantB));
  });
});

