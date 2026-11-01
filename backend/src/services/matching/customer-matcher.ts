import prisma from '../../database/prisma.js';
import zohoApiClient from '../zoho/api-client.js';
import { Customer, SyncStatus } from '@prisma/client';

export interface CustomerResolutionResult {
  status: 'MATCHED' | 'CREATED' | 'NEEDS_REVIEW';
  customer?: Customer;
  zohoContactId?: string;
  reason?: string;
  candidateMatches?: any[];
}

export class CustomerMatcher {
  /**
   * Normalizes company names by lowercasing, trimming extra spaces,
   * and standardizing common corporate suffixes.
   */
  static normalizeCompanyName(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // remove punctuation
      .replace(/\s+/g, ' ')                        // collapse whitespace
      .replace(/\b(llc|ltd|limited|inc|incorporated|corp|corporation|fz-llc|fz llc)\b/gi, '')
      .trim();
  }

  /**
   * Resolves a customer between HubSpot and Zoho Books
   */
  static async resolveCustomer(params: {
    hubspotCompanyId?: string;
    companyName: string;
    taxNumber?: string;
    domain?: string;
    email?: string;
  }): Promise<CustomerResolutionResult> {
    const normalized = this.normalizeCompanyName(params.companyName);

    // 1. Check local database mappings first
    if (params.hubspotCompanyId) {
      const existing = await prisma.customer.findUnique({
        where: { hubspotCompanyId: params.hubspotCompanyId },
      });
      if (existing && existing.zohoContactId) {
        return {
          status: 'MATCHED',
          customer: existing,
          zohoContactId: existing.zohoContactId,
          reason: 'Matched via local database hubspotCompanyId mapping',
        };
      }
    }

    // 2. Query Zoho Books for candidates
    // Search by company name or tax registration number
    const searchQuery = params.companyName.trim();
    const zohoCandidates = await zohoApiClient.searchContacts(searchQuery);

    // Filter candidates using TRN (Tax Number) or Normalized Name
    let exactMatches: any[] = [];
    let fuzzyMatches: any[] = [];

    for (const contact of zohoCandidates) {
      // Check TRN match
      if (params.taxNumber && contact.tax_registration_number === params.taxNumber) {
        exactMatches.push(contact);
        continue;
      }

      // Check normalized name match
      const candidateNormalized = this.normalizeCompanyName(contact.company_name || contact.contact_name);
      if (candidateNormalized === normalized) {
        exactMatches.push(contact);
      } else if (candidateNormalized.includes(normalized) || normalized.includes(candidateNormalized)) {
        fuzzyMatches.push(contact);
      }
    }

    // 3. Ambiguous conflict handling (Assignment Rule: "When more than one customer could match, a person decides")
    if (exactMatches.length > 1 || (exactMatches.length === 0 && fuzzyMatches.length > 1)) {
      const candidates = exactMatches.length > 0 ? exactMatches : fuzzyMatches;
      
      // Save customer record in NEEDS_REVIEW status
      const customerRecord = await prisma.customer.create({
        data: {
          hubspotCompanyId: params.hubspotCompanyId,
          companyName: params.companyName,
          normalizedName: normalized,
          taxRegistrationNo: params.taxNumber,
          domain: params.domain,
          email: params.email,
          currency: 'AED',
          syncStatus: SyncStatus.NEEDS_REVIEW,
          notes: `Ambiguous match: Found ${candidates.length} potential matches in Zoho Books. Requires human selection.`,
        },
      });

      return {
        status: 'NEEDS_REVIEW',
        customer: customerRecord,
        reason: `Found ${candidates.length} potential matches in Zoho Books. Human resolution required.`,
        candidateMatches: candidates,
      };
    }

    // 4. Exact Single Match Found in Zoho Books
    if (exactMatches.length === 1) {
      const matchedZoho = exactMatches[0];
      const existingByZoho = await prisma.customer.findUnique({
        where: { zohoContactId: matchedZoho.contact_id },
      });

      if (existingByZoho) {
        return {
          status: 'MATCHED',
          customer: existingByZoho,
          zohoContactId: matchedZoho.contact_id,
          reason: 'Matched existing customer in database by zohoContactId',
        };
      }

      const customerRecord = await prisma.customer.upsert({
        where: { hubspotCompanyId: params.hubspotCompanyId || `temp_${matchedZoho.contact_id}` },
        update: {
          zohoContactId: matchedZoho.contact_id,
          syncStatus: SyncStatus.SYNCED,
          companyName: params.companyName,
        },
        create: {
          hubspotCompanyId: params.hubspotCompanyId,
          zohoContactId: matchedZoho.contact_id,
          companyName: params.companyName,
          normalizedName: normalized,
          taxRegistrationNo: params.taxNumber,
          domain: params.domain,
          email: params.email,
          currency: 'AED',
          syncStatus: SyncStatus.SYNCED,
        },
      });

      return {
        status: 'MATCHED',
        customer: customerRecord,
        zohoContactId: matchedZoho.contact_id,
        reason: 'Matched single contact in Zoho Books',
      };
    }

    // 5. No Match Found -> Create New Customer in Zoho Books
    console.log(`[CustomerMatcher] No match found for "${params.companyName}". Creating new customer in Zoho Books...`);

    // Fetch AED currency ID
    const currencies = await zohoApiClient.getCurrencies();
    const aedCurrency = currencies.find((c: any) => c.currency_code === 'AED');

    const createdContact = await zohoApiClient.createContact({
      contact_name: params.companyName,
      company_name: params.companyName,
      email: params.email || undefined,
      currency_code: 'AED',
      currency_id: aedCurrency?.currency_id,
      notes: `Synced from HubSpot CRM (Company ID: ${params.hubspotCompanyId || 'N/A'})`,
    });

    const customerRecord = await prisma.customer.create({
      data: {
        hubspotCompanyId: params.hubspotCompanyId,
        zohoContactId: createdContact.contact_id,
        companyName: params.companyName,
        normalizedName: normalized,
        taxRegistrationNo: params.taxNumber,
        domain: params.domain,
        email: params.email,
        currency: 'AED',
        syncStatus: SyncStatus.SYNCED,
      },
    });

    return {
      status: 'CREATED',
      customer: customerRecord,
      zohoContactId: createdContact.contact_id,
      reason: 'New customer created in Zoho Books',
    };
  }
}
