import axios from 'axios';
import { Deal, IntegrationLog, CollectionsAgingRecord, ApiMetrics } from '../types';

const client = axios.create({
  baseURL: '/api',
});

export const api = {
  getDeals: async (): Promise<Deal[]> => {
    const res = await client.get('/deals');
    return res.data;
  },

  getLogs: async (system?: string, limit = 50): Promise<IntegrationLog[]> => {
    const params: any = { limit };
    if (system) params.system = system;
    const res = await client.get('/logs', { params });
    return res.data;
  },

  getCollections: async (): Promise<CollectionsAgingRecord[]> => {
    const res = await client.get('/collections');
    return res.data;
  },

  getMetrics: async (): Promise<ApiMetrics> => {
    const res = await client.get('/metrics');
    return res.data;
  },

  triggerMilestone: async (dealId: string, milestoneNumber: 2 | 3): Promise<any> => {
    const res = await client.post(`/sync/milestone/${dealId}`, { milestoneNumber });
    return res.data;
  },
};

