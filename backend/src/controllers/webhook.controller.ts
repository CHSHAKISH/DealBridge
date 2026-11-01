import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../database/prisma.js';
import { dealSyncQueue } from '../queues/deal-queue.js';
import { SystemSource, WebhookStatus } from '@prisma/client';
import hubspotApiClient from '../services/hubspot/api-client.js';

export async function handleHubSpotWebhook(req: Request, res: Response) {
  const events = Array.isArray(req.body) ? req.body : [req.body];

  console.log(`[HubSpot Webhook] Received ${events.length} event(s)...`);

  for (const event of events) {
    // Generate deterministic hash for deduplication
    const payloadStr = JSON.stringify(event);
    const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    // 1. Check if event was already received (Webhook Deduplication)
    const existing = await prisma.webhookEvent.findUnique({
      where: { payloadHash },
    });

    if (existing) {
      console.log(`[HubSpot Webhook] Duplicate event detected (Hash: ${payloadHash.substring(0, 8)}). Skipping.`);
      continue;
    }

    // 2. Persist event in inbox table
    await prisma.webhookEvent.create({
      data: {
        source: SystemSource.HUBSPOT,
        eventType: event.subscriptionType || event.propertyName || 'deal.propertyChange',
        payloadHash,
        rawPayload: payloadStr,
        status: WebhookStatus.PENDING,
      },
    });

    // 3. Check if deal stage changed to 'closedwon'
    const isStageChange =
      event.propertyName === 'dealstage' ||
      event.subscriptionType === 'deal.propertyChange' ||
      event.propertyValue === 'closedwon';

    const dealId = String(event.objectId || event.dealId || '');

    if (dealId && (isStageChange || event.stage === 'closedwon' || event.propertyValue === 'closedwon')) {
      // Fetch full deal from HubSpot API
      try {
        const hubspotDeal = await hubspotApiClient.getDeal(dealId);
        const stage = hubspotDeal.properties?.dealstage;

        if (stage === 'closedwon') {
          const dealName = hubspotDeal.properties?.dealname || 'Enterprise Implementation';
          const amountAed = parseFloat(hubspotDeal.properties?.amount || '120000');

          // Check associated company
          let companyName = 'NovaTech Solutions LLC';
          let hubspotCompanyId: string | undefined;
          const associatedCompanies = hubspotDeal.associations?.companies?.results;
          if (associatedCompanies && associatedCompanies.length > 0) {
            hubspotCompanyId = String(associatedCompanies[0].id);
            try {
              const comp = await hubspotApiClient.getCompany(hubspotCompanyId);
              if (comp.properties?.name) companyName = comp.properties.name;
            } catch {}
          }

          // Enqueue asynchronous background job (CRM never waits!)
          await dealSyncQueue.add(
            'sync-closed-won',
            {
              hubspotDealId: dealId,
              dealName,
              amountAed,
              companyName,
              hubspotCompanyId,
              correlationId: `corr_wh_${Date.now()}`,
            },
            {
              jobId: `deal_${dealId}_closedwon`, // Deterministic job ID prevents duplicate queueing
            }
          );

          console.log(`[HubSpot Webhook] Enqueued deal ${dealId} for background sync.`);
        }
      } catch (err: any) {
        console.error(`[HubSpot Webhook] Failed to fetch deal details for ${dealId}:`, err.message);
      }
    }
  }

  // Immediately respond 200 OK
  return res.status(200).json({ received: true, count: events.length });
}
