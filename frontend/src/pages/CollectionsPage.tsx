import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { CollectionsAgingRecord } from '../types';
import { Search, Download, ArrowUpDown, ChevronDown, ChevronRight, Activity, Filter } from 'lucide-react';

export const CollectionsPage: React.FC = () => {
  const [collections, setCollections] = useState<CollectionsAgingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [bucketFilter, setBucketFilter] = useState('ALL');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

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
    return (
      <div className="flex items-center justify-center p-16 text-slate-500">
        <Activity className="w-6 h-6 animate-spin mr-2 text-blue-600" />
        Loading accounts receivable aging data...
      </div>
    );
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

  // Filter & Sort
  const filteredCollections = collections
    .filter((c) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchesName = c.customerName.toLowerCase().includes(q);
        const matchesTax = (c.taxNumber || '').toLowerCase().includes(q);
        const matchesDeals = c.deals.some((d) => d.toLowerCase().includes(q));
        if (!matchesName && !matchesTax && !matchesDeals) return false;
      }

      // Overdue filter
      if (overdueOnly) {
        const hasOverdue =
          c.aging.days1_30 > 0 ||
          c.aging.days31_60 > 0 ||
          c.aging.days61_90 > 0 ||
          c.aging.days90Plus > 0;
        if (!hasOverdue) return false;
      }

      // Bucket filter
      if (bucketFilter === 'CURRENT' && c.aging.current <= 0) return false;
      if (bucketFilter === '1_30' && c.aging.days1_30 <= 0) return false;
      if (bucketFilter === '31_60' && c.aging.days31_60 <= 0) return false;
      if (bucketFilter === '61_90' && c.aging.days61_90 <= 0) return false;
      if (bucketFilter === '90_PLUS' && c.aging.days90Plus <= 0) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortDirection === 'desc') {
        return b.totalOutstandingAed - a.totalOutstandingAed;
      }
      return a.totalOutstandingAed - b.totalOutstandingAed;
    });

  // Export to CSV
  const handleExportCsv = () => {
    const headers = [
      'Customer Name',
      'TRN',
      'Deals Count',
      'Associated Deals',
      'Oldest Invoice Number',
      'Oldest Invoice Due Date',
      'Current (AED)',
      '1-30 Days Overdue (AED)',
      '31-60 Days Overdue (AED)',
      '61-90 Days Overdue (AED)',
      '90+ Days Overdue (AED)',
      'Total Outstanding (AED)',
    ];

    const rows = filteredCollections.map((c) => [
      `"${c.customerName.replace(/"/g, '""')}"`,
      `"${c.taxNumber || ''}"`,
      c.deals.length,
      `"${c.deals.join('; ').replace(/"/g, '""')}"`,
      `"${c.oldestInvoiceNumber}"`,
      `"${new Date(c.oldestInvoiceDate).toISOString().split('T')[0]}"`,
      c.aging.current,
      c.aging.days1_30,
      c.aging.days31_60,
      c.aging.days61_90,
      c.aging.days90Plus,
      c.totalOutstandingAed,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `collections_aging_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Collections & Accounts Receivable Aging</h2>
          <p className="text-xs text-slate-500">
            Customer-level aging schedule segmented into standard buckets: Current, 1–30, 31–60, 61–90, and 90+ days.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Report (CSV)</span>
        </button>
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

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search customers by name, TRN, or associated deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bucket Filter */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
          >
            <option value="ALL">All Aging Buckets</option>
            <option value="CURRENT">Current (Not Due)</option>
            <option value="1_30">1–30 Days Overdue</option>
            <option value="31_60">31–60 Days Overdue</option>
            <option value="61_90">61–90 Days Overdue</option>
            <option value="90_PLUS">90+ Days Overdue</option>
          </select>
        </div>

        {/* Overdue Only Checkbox */}
        <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer select-none bg-white px-3 py-2 border border-slate-200 rounded-lg w-full sm:w-auto">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
          />
          <span>Overdue Only</span>
        </label>
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
                <th
                  className="py-3 px-4 font-bold text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Total Outstanding</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCollections.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    No customers match the active search and aging criteria.
                  </td>
                </tr>
              ) : (
                filteredCollections.map((item) => {
                  const isExpanded = expandedCustomerId === item.customerId;

                  return (
                    <React.Fragment key={item.customerId}>
                      <tr
                        onClick={() => setExpandedCustomerId(isExpanded ? null : item.customerId)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <div>
                              <div className="font-bold text-slate-900">{item.customerName}</div>
                              {item.taxNumber && <div className="text-[11px] text-slate-400">TRN: {item.taxNumber}</div>}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {item.deals.length} {item.deals.length === 1 ? 'Deal' : 'Deals'}
                            </span>
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

                      {/* Drill-down associated deals row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={9} className="py-3 px-6">
                            <div className="text-xs font-semibold text-slate-600 mb-1.5">
                              Associated Deals for {item.customerName}:
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-slate-700 text-xs pl-2">
                              {item.deals.map((deal, idx) => (
                                <li key={idx} className="font-medium text-slate-800">
                                  {deal}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
