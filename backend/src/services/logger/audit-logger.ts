import prisma from '../../database/prisma.js';
import { SystemSource, TrafficDirection } from '@prisma/client';

export interface LogEntry {
  dealId?: string;
  system: SystemSource;
  direction: TrafficDirection;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  correlationId: string;
  requestBody?: any;
  responseBody?: any;
  errorMessage?: string;
}

// In-memory counters for assignment requirement reporting
class ApiCallMetrics {
  private zohoCallsTotal = 0;
  private zohoCallsLastSync = 0;
  private hubspotCallsTotal = 0;

  incrementZoho() {
    this.zohoCallsTotal++;
    this.zohoCallsLastSync++;
  }

  incrementHubSpot() {
    this.hubspotCallsTotal++;
  }

  resetLastSyncCounter() {
    const count = this.zohoCallsLastSync;
    this.zohoCallsLastSync = 0;
    return count;
  }

  async syncFromDb() {
    try {
      this.zohoCallsTotal = await prisma.integrationLog.count({
        where: { system: SystemSource.ZOHO },
      });
      this.hubspotCallsTotal = await prisma.integrationLog.count({
        where: { system: SystemSource.HUBSPOT },
      });
    } catch {}
  }

  getMetrics() {
    return {
      zohoCallsTotal: this.zohoCallsTotal,
      zohoCallsLastSync: this.zohoCallsLastSync,
      hubspotCallsTotal: this.hubspotCallsTotal,
    };
  }
}

export const apiMetrics = new ApiCallMetrics();

/**
 * Sanitizes and redacts sensitive data (tokens, secrets, credentials)
 */
function redactSecrets(data: any): string | null {
  if (!data) return null;

  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Replace common secret patterns
    const redacted = str
      .replace(/(Bearer\s+)[a-zA-Z0-9._-]+/gi, '$1[REDACTED]')
      .replace(/(Zoho-oauthtoken\s+)[a-zA-Z0-9._-]+/gi, '$1[REDACTED]')
      .replace(/("?(client_secret|refresh_token|access_token|password|secret)"?\s*[:=]\s*"?)[^",\s}]+/gi, '$1[REDACTED]');

    return redacted.length > 5000 ? redacted.substring(0, 5000) + '... [TRUNCATED]' : redacted;
  } catch {
    return '[UNABLE TO SERIALIZE]';
  }
}

export async function logApiCall(entry: LogEntry): Promise<void> {
  // Update in-memory telemetry
  if (entry.system === 'ZOHO') {
    apiMetrics.incrementZoho();
  } else if (entry.system === 'HUBSPOT') {
    apiMetrics.incrementHubSpot();
  }

  try {
    let internalDealId: string | null = null;
    if (entry.dealId) {
      // Check if entry.dealId is an internal UUID or a hubspotDealId
      const deal = await prisma.deal.findFirst({
        where: {
          OR: [
            { id: entry.dealId },
            { hubspotDealId: entry.dealId },
          ],
        },
        select: { id: true },
      });
      if (deal) internalDealId = deal.id;
    }

    await prisma.integrationLog.create({
      data: {
        dealId: internalDealId,
        system: entry.system,
        direction: entry.direction,
        endpoint: entry.endpoint,
        method: entry.method,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs,
        correlationId: entry.correlationId,
        requestBodyMasked: redactSecrets(entry.requestBody),
        responseBodyMasked: redactSecrets(entry.responseBody),
        errorMessage: entry.errorMessage || null,
      },
    });
  } catch (err: any) {
    console.error('Failed to persist integration log to DB:', err.message);
  }
}
