import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../../config/index.js';
import { logApiCall } from '../logger/audit-logger.js';
import { SystemSource, TrafficDirection } from '@prisma/client';

export class HubSpotApiClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: 'https://api.hubapi.com/crm/v3',
      timeout: 10000,
    });
  }

  private async request<T = any>(
    options: any & { dealId?: string; correlationId?: string }
  ): Promise<T> {
    const correlationId = options.correlationId || `corr_hs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = Date.now();

    try {
      const response: AxiosResponse<T> = await this.axiosInstance.request({
        ...options,
        headers: {
          Authorization: `Bearer ${config.hubspot.accessToken}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      const durationMs = Date.now() - startTime;

      await logApiCall({
        dealId: options.dealId,
        system: SystemSource.HUBSPOT,
        direction: TrafficDirection.OUTBOUND,
        endpoint: options.url || '',
        method: options.method?.toUpperCase() || 'GET',
        statusCode: response.status,
        durationMs,
        correlationId,
        requestBody: options.data,
        responseBody: response.data,
      });

      return response.data;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const status = error.response?.status || 500;
      const errorData = error.response?.data;

      await logApiCall({
        dealId: options.dealId,
        system: SystemSource.HUBSPOT,
        direction: TrafficDirection.OUTBOUND,
        endpoint: options.url || '',
        method: options.method?.toUpperCase() || 'GET',
        statusCode: status,
        durationMs,
        correlationId,
        requestBody: options.data,
        responseBody: errorData,
        errorMessage: errorData?.message || error.message,
      });

      throw error;
    }
  }

  /**
   * Retrieves deal details along with associated company IDs
   */
  async getDeal(dealId: string): Promise<any> {
    const properties = [
      'dealname',
      'amount',
      'dealstage',
      'pipeline',
      'closedate',
      'zoho_sales_order_id',
      'zoho_sales_order_total',
      'zoho_total_invoiced',
      'zoho_percentage_invoiced',
      'zoho_total_collected',
      'zoho_percentage_collected',
      'zoho_amount_unpaid',
      'zoho_amount_not_invoiced',
      'zoho_next_due_date',
      'zoho_is_overdue',
      'zoho_integration_status',
    ];

    const res = await this.request({
      url: `/objects/deals/${dealId}`,
      method: 'GET',
      params: {
        properties: properties.join(','),
        associations: 'companies,contacts',
      },
    });

    return res;
  }

  /**
   * Retrieves company details by ID (name, domain, phone, etc.)
   */
  async getCompany(companyId: string): Promise<any> {
    const properties = ['name', 'domain', 'city', 'country', 'phone', 'zip', 'tax_number', 'vat_number'];
    const res = await this.request({
      url: `/objects/companies/${companyId}`,
      method: 'GET',
      params: {
        properties: properties.join(','),
      },
    });
    return res;
  }

  /**
   * Updates only modified properties on a deal (Diff-Based Update)
   * Prevents writing fields when value has not changed.
   */
  async updateDealIfChanged(
    dealId: string,
    newProperties: Record<string, any>,
    currentProperties?: Record<string, any>,
    correlationId?: string
  ): Promise<{ updated: boolean; changedFields: string[] }> {
    const changedProperties: Record<string, any> = {};
    const changedFields: string[] = [];

    // If current properties not passed, fetch them
    let current = currentProperties;
    if (!current) {
      const deal = await this.getDeal(dealId);
      current = deal.properties || {};
    }

    // Compare each field to determine delta
    for (const [key, value] of Object.entries(newProperties)) {
      const currentValue = current[key];
      // Normalize values to string comparison
      const normalizedCurrent = currentValue !== undefined && currentValue !== null ? String(currentValue).trim() : '';
      const normalizedNew = value !== undefined && value !== null ? String(value).trim() : '';

      if (normalizedCurrent !== normalizedNew) {
        changedProperties[key] = value;
        changedFields.push(key);
      }
    }

    // If nothing changed, do NOT call API (Strict requirement!)
    if (changedFields.length === 0) {
      return { updated: false, changedFields: [] };
    }

    // Perform PATCH update
    await this.request({
      url: `/objects/deals/${dealId}`,
      method: 'PATCH',
      data: { properties: changedProperties },
      dealId,
      correlationId,
    });

    return { updated: true, changedFields };
  }
}

export const hubspotApiClient = new HubSpotApiClient();
export default hubspotApiClient;
