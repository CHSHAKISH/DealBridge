import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { CollectionsAgingRecord } from '../types';

export const CollectionsPage: React.FC = () => {
  const [collections, setCollections] = useState<CollectionsAgingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getCollections();
        setCollections(data);
      } catch (err) {
        console.error('Failed to load collections aging data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-center p-12 text-slate-500">Loading accounts receivable aging data...</div>;
  }

  // Calculate aggregate aging across all customers
  const totals = collections.reduce(
    (acc, c) => ({
      total: acc.total + c.totalOutstandingAed,
      current: acc.current + c.aging.current,
      days1_30: acc.days1_30 + c.aging.days1_30,
      days31_60: acc.days31_60 + c.aging.days31_60,
      days61_90: acc.days61_90 + c.aging.days61_90,
      days90Plus: acc.days90Plus + c.aging.days90Plus,
    }),
    { total: 0, current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Collections & Accounts Receivable Aging</h2>
        <p className="text-xs text-slate-500">
          Customer-wise outstanding invoices segmented into standard aging buckets: Current, 1–30, 31–60, 61–90, and 90+ days overdue.
        </p>
      </div>

      {/* Aggregate Aging Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 uppercase font-semibold">Total Outstanding</div>
          <div className="text-lg font-bold text-slate-900 mt-1">AED {totals.total.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
          <div className="text-xs text-slate-500 uppercase font-semibold">Current (Not Due)</div>
          <div className="text-lg font-bold text-emerald-600 mt-1">AED {totals.current.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500">
          <div className="text-xs text-slate-500 uppercase font-semibold">1–30 Days Overdue</div>
          <div className="text-lg font-bold text-blue-600 mt-1">AED {totals.days1_30.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs text-slate-500 uppercase font-semibold">31–60 Days Overdue</div>
          <div className="text-lg font-bold text-amber-600 mt-1">AED {totals.days31_60.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-orange-500">
          <div className="text-xs text-slate-500 uppercase font-semibold">61–90 Days Overdue</div>
          <div className="text-lg font-bold text-orange-600 mt-1">AED {totals.days61_90.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-rose-500">
          <div className="text-xs text-slate-500 uppercase font-semibold">90+ Days Overdue</div>
          <div className="text-lg font-bold text-rose-600 mt-1">AED {totals.days90Plus.toLocaleString()}</div>
        </div>
      </div>

      {/* Customer Aging Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Associated Deals</th>
                <th className="py-3 px-4">Oldest Unpaid Invoice</th>
                <th className="py-3 px-4">Current</th>
                <th className="py-3 px-4">1–30 Days</th>
                <th className="py-3 px-4">31–60 Days</th>
                <th className="py-3 px-4">61–90 Days</th>
                <th className="py-3 px-4">90+ Days</th>
                <th className="py-3 px-4 font-bold text-right">Total Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {collections.map((item) => (
                <tr key={item.customerId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{item.customerName}</div>
                    {item.taxNumber && <div className="text-[11px] text-slate-400">TRN: {item.taxNumber}</div>}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5">
                      {item.deals.map((dealName, i) => (
                        <div key={i} className="text-slate-600 font-medium truncate max-w-xs">
                          • {dealName}
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono">
                    <div className="text-slate-900 font-semibold">{item.oldestInvoiceNumber}</div>
                    <div className="text-slate-400 text-[10px]">
                      Due: {new Date(item.oldestInvoiceDate).toISOString().split('T')[0]}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-semibold text-emerald-700">
                    {item.aging.current > 0 ? `AED ${item.aging.current.toLocaleString()}` : '-'}
                  </td>

                  <td className="py-3.5 px-4 font-semibold text-blue-700">
                    {item.aging.days1_30 > 0 ? `AED ${item.aging.days1_30.toLocaleString()}` : '-'}
                  </td>

                  <td className="py-3.5 px-4 font-semibold text-amber-700">
                    {item.aging.days31_60 > 0 ? `AED ${item.aging.days31_60.toLocaleString()}` : '-'}
                  </td>

                  <td className="py-3.5 px-4 font-semibold text-orange-700">
                    {item.aging.days61_90 > 0 ? `AED ${item.aging.days61_90.toLocaleString()}` : '-'}
                  </td>

                  <td className="py-3.5 px-4 font-bold text-rose-700">
                    {item.aging.days90Plus > 0 ? `AED ${item.aging.days90Plus.toLocaleString()}` : '-'}
                  </td>

                  <td className="py-3.5 px-4 text-right font-bold text-slate-900 text-sm">
                    AED {item.totalOutstandingAed.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
