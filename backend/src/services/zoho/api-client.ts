import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from '../../config/index.js';
import zohoTokenManager from './token-manager.js';
import { logApiCall } from '../logger/audit-logger.js';
import { SystemSource, TrafficDirection } from '@prisma/client';

export class ZohoApiClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.getBaseUrl(),
      timeout: 15000,
    });
  }

  private getBaseUrl(): string {
    const domainMap: Record<string, string> = {
      com: 'https://www.zohoapis.com/books/v3',
      ae: 'https://www.zohoapis.ae/books/v3',
      in: 'https://www.zohoapis.in/books/v3',
      eu: 'https://www.zohoapis.eu/books/v3',
      com_au: 'https://www.zohoapis.com.au/books/v3',
    };
    return domainMap[config.zoho.region] || 'https://www.zohoapis.in/books/v3';
  }

  /**
   * Executes an API request with automatic auth refresh, rate limit handling (429),
   * audit logging, and exponential backoff retry.
   */
  async request<T = any>(
    options: AxiosRequestConfig & { dealId?: string; correlationId?: string },
    retryCount = 0
  ): Promise<T> {
    const maxRetries = 3;
    const correlationId = options.correlationId || `corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = Date.now();

    try {
      const accessToken = await zohoTokenManager.getValidToken();

      const response: AxiosResponse<T> = await this.axiosInstance.request({
        ...options,
        params: {
          organization_id: config.zoho.organizationId,
          ...(options.params || {}),
        },
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json;charset=UTF-8',
          ...(options.headers || {}),
        },
      });

      const durationMs = Date.now() - startTime;

      // Log successful call
      await logApiCall({
        dealId: options.dealId,
        system: SystemSource.ZOHO,
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

      // Log error call
      await logApiCall({
        dealId: options.dealId,
        system: SystemSource.ZOHO,
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

      // 1. Handle 401 Unauthorized (Token might have been invalidated)
      if (status === 401 && retryCount < 1) {
        zohoTokenManager.invalidateToken();
        return this.request<T>(options, retryCount + 1);
      }

      // 2. Handle 429 Rate Limit
      if (status === 429 && retryCount < maxRetries) {
        const retryAfterSec = parseInt(error.response?.headers['retry-after'] || '2', 10);
        const delayMs = (retryAfterSec || Math.pow(2, retryCount) * 1000) + Math.random() * 500;
        console.warn(`[ZohoApiClient] Rate limit hit (429). Retrying in ${delayMs}ms (attempt ${retryCount + 1})...`);
        await new Promise((res) => setTimeout(res, delayMs));
        return this.request<T>(options, retryCount + 1);
      }

      // 3. Handle Transient 5xx Errors
      if (status >= 500 && status < 600 && retryCount < maxRetries) {
        const delayMs = Math.pow(2, retryCount) * 1000 + Math.random() * 500;
        console.warn(`[ZohoApiClient] Server error (${status}). Retrying in ${delayMs}ms (attempt ${retryCount + 1})...`);
        await new Promise((res) => setTimeout(res, delayMs));
        return this.request<T>(options, retryCount + 1);
      }

      throw error;
    }
  }

  // Domain API Methods

  async getOrganizations(): Promise<any[]> {
    const res = await this.request({ url: '/organizations', method: 'GET' });
    return res.organizations || [];
  }

  async searchContacts(searchQuery: string): Promise<any[]> {
    const res = await this.request({
      url: '/contacts',
      method: 'GET',
      params: { search_text: searchQuery },
    });
    return res.contacts || [];
  }

  async getContact(contactId: string): Promise<any> {
    const res = await this.request({
      url: `/contacts/${contactId}`,
      method: 'GET',
    });
    return res.contact;
  }

  async createContact(contactData: {
    contact_name: string;
    company_name?: string;
    email?: string;
    currency_code?: string;
    currency_id?: string;
    tax_treatment?: string;
    notes?: string;
  }): Promise<any> {
    const res = await this.request({
      url: '/contacts',
      method: 'POST',
      data: contactData,
    });
    return res.contact;
  }

  async searchItems(itemName: string): Promise<any[]> {
    const res = await this.request({
      url: '/items',
      method: 'GET',
      params: { search_text: itemName },
    });
    return res.items || [];
  }

  async createSalesOrder(orderData: {
    customer_id: string;
    salesorder_number?: string;
    reference_number?: string;
    date: string;
    currency_code?: string;
    line_items: Array<{
      item_id?: string;
      name: string;
      rate: number;
      quantity: number;
      tax_percentage?: number;
      tax_name?: string;
    }>;
    notes?: string;
  }, dealId?: string, correlationId?: string): Promise<any> {
    const res = await this.request({
      url: '/salesorders',
      method: 'POST',
      data: orderData,
      dealId,
      correlationId,
    });
    return res.salesorder;
  }

  async createInvoice(invoiceData: {
    customer_id: string;
    salesorder_id?: string;
    reference_number?: string;
    date: string;
    due_date?: string;
    currency_code?: string;
    line_items: Array<{
      item_id?: string;
      name: string;
      rate: number;
      quantity: number;
      tax_percentage?: number;
    }>;
    notes?: string;
  }, dealId?: string, correlationId?: string): Promise<any> {
    const res = await this.request({
      url: '/invoices',
      method: 'POST',
      data: invoiceData,
      dealId,
      correlationId,
    });
    return res.invoice;
  }

  async getInvoice(invoiceId: string): Promise<any> {
    const res = await this.request({
      url: `/invoices/${invoiceId}`,
      method: 'GET',
    });
    return res.invoice;
  }

  async getPayments(params?: { customer_id?: string; date_start?: string }): Promise<any[]> {
    const res = await this.request({
      url: '/customerpayments',
      method: 'GET',
      params,
    });
    return res.customerpayments || [];
  }

  async getCurrencies(): Promise<any[]> {
    const res = await this.request({
      url: '/settings/currencies',
      method: 'GET',
    });
    return res.currencies || [];
  }
}

export const zohoApiClient = new ZohoApiClient();
export default zohoApiClient;
