export interface Deal {
  id: string;
  hubspotDealId: string;
  name: string;
  customerId: string;
  stage: string;
  currency: string;
  dealValueAed: number;
  vatAmountAed: number;
  totalAmountAed: number;
  zohoSalesOrderId?: string;
  syncStatus: 'SYNCED' | 'PENDING' | 'IN_PROGRESS' | 'NEEDS_REVIEW' | 'ERROR';
  syncError?: string;
  lastSyncedAt?: string;
  customer: {
    id: string;
    companyName: string;
    taxRegistrationNo?: string;
    zohoContactId?: string;
  };
  salesOrder?: {
    id: string;
    salesOrderNumber: string;
    zohoSalesOrderId: string;
    totalMinorUnits: string;
    status: string;
  };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    milestoneNumber: number;
    status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
    totalAmountAed: number;
    balanceAed: number;
    dueDate: string;
  }>;
  milestones: Array<{
    id: string;
    milestoneNumber: number;
    name: string;
    percentage: number;
    targetAed: number;
    status: 'PENDING' | 'TRIGGERED' | 'INVOICED';
  }>;
}

export interface IntegrationLog {
  id: string;
  dealId?: string;
  system: 'HUBSPOT' | 'ZOHO';
  direction: 'INBOUND' | 'OUTBOUND';
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  correlationId: string;
  requestBodyMasked?: string;
  responseBodyMasked?: string;
  errorMessage?: string;
  createdAt: string;
  deal?: {
    name: string;
  };
}

export interface CollectionsAgingRecord {
  customerId: string;
  customerName: string;
  taxNumber?: string;
  totalOutstandingAed: number;
  oldestInvoiceNumber: string;
  oldestInvoiceDate: string;
  deals: string[];
  aging: {
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days90Plus: number;
  };
}

export interface ApiMetrics {
  zohoCallsTotal: number;
  zohoCallsLastSync: number;
  hubspotCallsTotal: number;
  retryCount?: number;
  failureCount?: number;
  lastSuccessfulSync?: string | null;
}

