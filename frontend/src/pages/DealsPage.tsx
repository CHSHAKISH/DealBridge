import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Deal } from '../types';
import { 
  Receipt, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export const DealsPage: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const fetchDeals = async () => {
    try {
      const data = await api.getDeals();
      setDeals(data);
    } catch (err) {
      console.error('Failed to load deals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const handleTriggerMilestone = async (dealId: string, milestoneNumber: 2 | 3) => {
    setTriggeringId(`${dealId}-${milestoneNumber}`);
    try {
      await api.triggerMilestone(dealId, milestoneNumber);
      await fetchDeals();
    } catch (err: any) {
      alert(`Failed to trigger milestone: ${err.message}`);
    } finally {
      setTriggeringId(null);
    }
  };

  if (loading) {
    return <div className="text-center p-12 text-slate-500">Loading synchronized deals...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Synchronized Deals & Milestone Billing</h2>
          <p className="text-xs text-slate-500">
            Real-time status of HubSpot deals, Zoho Sales Orders, and milestone invoice progressions.
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
          Total Deals: {deals.length}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Deal & Customer</th>
                <th className="py-3 px-4">Sales Order</th>
                <th className="py-3 px-4">Deal Value (AED)</th>
                <th className="py-3 px-4">Milestones Invoiced</th>
                <th className="py-3 px-4">% Invoiced / Collected</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {deals.map((deal) => {
                // Calculate progress
                const totalInvoiced = deal.invoices
                  .filter((i) => i.status !== 'VOID')
                  .reduce((sum, i) => sum + i.totalAmountAed, 0);
                
                const totalCollected = deal.invoices
                  .filter((i) => i.status !== 'VOID')
                  .reduce((sum, i) => sum + (i.totalAmountAed - i.balanceAed), 0);

                const pctInvoiced = deal.totalAmountAed > 0 ? (totalInvoiced / deal.totalAmountAed) * 100 : 0;
                const pctCollected = deal.totalAmountAed > 0 ? (totalCollected / deal.totalAmountAed) * 100 : 0;

                const m1 = deal.milestones.find((m) => m.milestoneNumber === 1);
                const m2 = deal.milestones.find((m) => m.milestoneNumber === 2);
                const m3 = deal.milestones.find((m) => m.milestoneNumber === 3);

                return (
                  <tr key={deal.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{deal.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {deal.customer.companyName} {deal.customer.taxRegistrationNo ? `• TRN: ${deal.customer.taxRegistrationNo}` : ''}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {deal.salesOrder ? (
                        <div className="flex items-center space-x-1 text-blue-600 font-mono text-xs font-semibold">
                          <Receipt className="w-3.5 h-3.5" />
                          <span>{deal.salesOrder.salesOrderNumber}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Pending creation</span>
                      )}
                    </td>

                    <td className="py-4 px-4 font-semibold text-slate-900">
                      AED {deal.totalAmountAed.toLocaleString()}
                      <div className="text-xs text-slate-400 font-normal">Base: {deal.dealValueAed.toLocaleString()} + 5% VAT</div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          m1?.status === 'INVOICED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          M1 (50%)
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          m2?.status === 'INVOICED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          M2 (30%)
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          m3?.status === 'INVOICED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          M3 (20%)
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="w-32 space-y-1">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Invoiced:</span>
                          <span className="font-semibold text-slate-700">{pctInvoiced.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(100, pctInvoiced)}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                          <span>Collected:</span>
                          <span className="font-semibold text-emerald-600">{pctCollected.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(100, pctCollected)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {deal.syncStatus === 'SYNCED' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" />
                          Synced
                        </span>
                      )}
                      {deal.syncStatus === 'NEEDS_REVIEW' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 mr-1 text-amber-500" />
                          Needs Review
                        </span>
                      )}
                      {deal.syncStatus === 'ERROR' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Error
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {m2?.status !== 'INVOICED' && (
                          <button
                            onClick={() => handleTriggerMilestone(deal.id, 2)}
                            disabled={triggeringId === `${deal.id}-2`}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
                          >
                            {triggeringId === `${deal.id}-2` ? 'Triggering...' : 'Trigger M2 (Go-Live)'}
                          </button>
                        )}
                        {m2?.status === 'INVOICED' && m3?.status !== 'INVOICED' && (
                          <button
                            onClick={() => handleTriggerMilestone(deal.id, 3)}
                            disabled={triggeringId === `${deal.id}-3`}
                            className="px-2.5 py-1 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 transition-colors disabled:opacity-50"
                          >
                            {triggeringId === `${deal.id}-3` ? 'Triggering...' : 'Trigger M3 (90-Day)'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
