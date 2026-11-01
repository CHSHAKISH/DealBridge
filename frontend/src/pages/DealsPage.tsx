import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Deal } from '../types';
import { 
  Receipt, 
  CheckCircle2, 
  AlertTriangle,
  X,
  Search,
  Activity,
  Building2
} from 'lucide-react';

export const DealsPage: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Slide-over & Modal States
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [activeMilestoneModal, setActiveMilestoneModal] = useState<{
    dealId: string;
    milestoneNumber: number;
  } | null>(null);

  const fetchDeals = async () => {
    try {
      const data = await api.getDeals();
      setDeals(data);
      // Keep selected deal in sync if open
      if (selectedDeal) {
        const updated = data.find((d) => d.id === selectedDeal.id);
        if (updated) setSelectedDeal(updated);
      }
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

  // Helper for invoice status badge
  const renderInvoiceStatusBadge = (status: string, dueDate?: string, balance = 0) => {
    const isOverdue = dueDate && new Date(dueDate) < new Date() && balance > 0;
    if (isOverdue) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
          OVERDUE
        </span>
      );
    }
    switch (status) {
      case 'PAID':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            PAID
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            PARTIALLY PAID
          </span>
        );
      case 'SENT':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            SENT
          </span>
        );
      case 'VOID':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 line-through">
            VOID
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            DRAFT
          </span>
        );
    }
  };

  // Filter deals
  const filteredDeals = deals.filter((deal) => {
    const matchesSearch =
      deal.name.toLowerCase().includes(search.toLowerCase()) ||
      deal.customer.companyName.toLowerCase().includes(search.toLowerCase()) ||
      (deal.salesOrder?.salesOrderNumber || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'SYNCED' && deal.syncStatus === 'SYNCED') ||
      (statusFilter === 'PENDING' && (deal.syncStatus === 'PENDING' || deal.syncStatus === 'IN_PROGRESS')) ||
      (statusFilter === 'ERROR' && (deal.syncStatus === 'ERROR' || deal.syncStatus === 'NEEDS_REVIEW'));

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-500">
        <Activity className="w-6 h-6 animate-spin mr-2 text-blue-600" />
        Loading synchronized deals...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Synchronized Deals & Milestone Billing</h2>
          <p className="text-xs text-slate-500">
            Real-time status of HubSpot deals, Zoho Sales Orders, and milestone invoice progressions. Click any deal row for full financials.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
            Total Deals: {deals.length}
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search deals by name, company, or Sales Order #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Sync Statuses</option>
          <option value="SYNCED">Synced Only</option>
          <option value="PENDING">Pending / In Progress</option>
          <option value="ERROR">Errors / Needs Review</option>
        </select>
      </div>

      {/* Main Table */}
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
              {filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                    No deals match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredDeals.map((deal) => {
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

                  const inv1 = deal.invoices.find((i) => i.milestoneNumber === 1 && i.status !== 'VOID');
                  const inv2 = deal.invoices.find((i) => i.milestoneNumber === 2 && i.status !== 'VOID');
                  const inv3 = deal.invoices.find((i) => i.milestoneNumber === 3 && i.status !== 'VOID');

                  return (
                    <tr
                      key={deal.id}
                      onClick={() => setSelectedDeal(deal)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                          {deal.name}
                        </div>
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
                        <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveMilestoneModal({ dealId: deal.id, milestoneNumber: 1 })}
                            title="Click to view Milestone 1 details"
                            className={`px-2 py-0.5 text-xs font-medium rounded hover:ring-2 hover:ring-blue-400 transition-all ${
                              inv1?.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : inv1?.status === 'SENT'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : m1?.status === 'INVOICED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            M1 (50%)
                          </button>

                          <button
                            onClick={() => setActiveMilestoneModal({ dealId: deal.id, milestoneNumber: 2 })}
                            title="Click to view Milestone 2 details"
                            className={`px-2 py-0.5 text-xs font-medium rounded hover:ring-2 hover:ring-blue-400 transition-all ${
                              inv2?.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : inv2?.status === 'SENT'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : m2?.status === 'INVOICED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            M2 (30%)
                          </button>

                          <button
                            onClick={() => setActiveMilestoneModal({ dealId: deal.id, milestoneNumber: 3 })}
                            title="Click to view Milestone 3 details"
                            className={`px-2 py-0.5 text-xs font-medium rounded hover:ring-2 hover:ring-blue-400 transition-all ${
                              inv3?.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : inv3?.status === 'SENT'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : m3?.status === 'INVOICED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            M3 (20%)
                          </button>
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

                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deal Detail Slide-Over Panel */}
      {selectedDeal && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50 sticky top-0 z-10">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Deal Detail & Financials</span>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{selectedDeal.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  HubSpot Deal ID: <code className="font-mono text-slate-700">{selectedDeal.hubspotDealId}</code>
                </p>
              </div>
              <button
                onClick={() => setSelectedDeal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6">
              {/* Financial Summary (All 10 required fields) */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Deal Financial Progression (AED)
                </h4>
                {(() => {
                  const activeInvoices = selectedDeal.invoices.filter((i) => i.status !== 'VOID');
                  const soTotal = selectedDeal.totalAmountAed;
                  const totalInvoiced = activeInvoices.reduce((sum, i) => sum + i.totalAmountAed, 0);
                  const totalCollected = activeInvoices.reduce((sum, i) => sum + (i.totalAmountAed - i.balanceAed), 0);
                  const unpaidAmount = activeInvoices.reduce((sum, i) => sum + i.balanceAed, 0);
                  const notYetInvoiced = Math.max(0, soTotal - totalInvoiced);
                  const pctInvoiced = soTotal > 0 ? ((totalInvoiced / soTotal) * 100).toFixed(1) : '0';
                  const pctCollected = soTotal > 0 ? ((totalCollected / soTotal) * 100).toFixed(1) : '0';
                  
                  // Next unpaid due date
                  const unpaidInvoices = activeInvoices.filter((i) => i.balanceAed > 0);
                  unpaidInvoices.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
                  const nextDue = unpaidInvoices[0]?.dueDate;
                  const hasOverdue = unpaidInvoices.some((i) => new Date(i.dueDate) < new Date());

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500 uppercase font-semibold">Sales Order Total</div>
                        <div className="text-base font-bold text-slate-900 mt-0.5">AED {soTotal.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400">Incl. 5% UAE VAT</div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500 uppercase font-semibold">Total Invoiced</div>
                        <div className="text-base font-bold text-blue-600 mt-0.5">AED {totalInvoiced.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500">{pctInvoiced}% of order</div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500 uppercase font-semibold">Total Collected</div>
                        <div className="text-base font-bold text-emerald-600 mt-0.5">AED {totalCollected.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500">{pctCollected}% of order</div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500 uppercase font-semibold">Amount Unpaid</div>
                        <div className="text-base font-bold text-amber-600 mt-0.5">AED {unpaidAmount.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400">Pending collections</div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500 uppercase font-semibold">Not Yet Invoiced</div>
                        <div className="text-base font-bold text-slate-700 mt-0.5">AED {notYetInvoiced.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400">Future milestones</div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-[11px] text-slate-500 uppercase font-semibold">Next Due Date</div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5">
                          {nextDue ? new Date(nextDue).toISOString().split('T')[0] : 'All Settled'}
                        </div>
                        <div className="text-[10px]">
                          {hasOverdue ? (
                            <span className="text-rose-600 font-bold">Overdue Invoices Present</span>
                          ) : (
                            <span className="text-emerald-600">On Track</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Customer & Zoho Reference Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center space-x-2 text-slate-800 font-semibold text-xs">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Customer Details</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">{selectedDeal.customer.companyName}</div>
                  <div className="text-xs text-slate-600">
                    TRN: <code className="font-mono">{selectedDeal.customer.taxRegistrationNo || 'N/A'}</code>
                  </div>
                  <div className="text-xs text-slate-600">
                    Zoho Contact ID: <code className="font-mono">{selectedDeal.customer.zohoContactId || 'Pending'}</code>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center space-x-2 text-slate-800 font-semibold text-xs">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>Sales Order Details</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {selectedDeal.salesOrder?.salesOrderNumber || 'Not created yet'}
                  </div>
                  <div className="text-xs text-slate-600">
                    Zoho SO ID: <code className="font-mono">{selectedDeal.salesOrder?.zohoSalesOrderId || 'N/A'}</code>
                  </div>
                  <div className="text-xs text-slate-600">
                    SO Status: <span className="font-semibold text-emerald-700">{selectedDeal.salesOrder?.status || 'PENDING'}</span>
                  </div>
                </div>
              </div>

              {/* Invoice History Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Invoices & Milestone History
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="p-2.5">Invoice #</th>
                        <th className="p-2.5">Milestone</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Total Amount</th>
                        <th className="p-2.5">Balance</th>
                        <th className="p-2.5">Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedDeal.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400">
                            No invoices generated yet.
                          </td>
                        </tr>
                      ) : (
                        selectedDeal.invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-semibold text-blue-600">
                              {inv.invoiceNumber}
                              {inv.replacementInvoiceId && (
                                <div className="text-[10px] text-slate-400">Replaced by {inv.replacementInvoiceId}</div>
                              )}
                            </td>
                            <td className="p-2.5">Milestone {inv.milestoneNumber}</td>
                            <td className="p-2.5">{renderInvoiceStatusBadge(inv.status, inv.dueDate, inv.balanceAed)}</td>
                            <td className="p-2.5 font-semibold text-slate-900">AED {inv.totalAmountAed.toLocaleString()}</td>
                            <td className="p-2.5 font-semibold text-amber-700">AED {inv.balanceAed.toLocaleString()}</td>
                            <td className="p-2.5 text-slate-500">{new Date(inv.dueDate).toISOString().split('T')[0]}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Allocations */}
              {selectedDeal.paymentAllocations && selectedDeal.paymentAllocations.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Payment Allocations
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="p-2.5">Payment #</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Mode</th>
                          <th className="p-2.5">Allocated Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedDeal.paymentAllocations.map((alloc) => (
                          <tr key={alloc.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-semibold text-emerald-600">
                              {alloc.payment?.paymentNumber || 'Direct Payment'}
                            </td>
                            <td className="p-2.5 text-slate-500">
                              {alloc.payment?.paymentDate ? new Date(alloc.payment.paymentDate).toISOString().split('T')[0] : 'N/A'}
                            </td>
                            <td className="p-2.5 text-slate-700">{alloc.payment?.paymentMode || 'Bank Transfer'}</td>
                            <td className="p-2.5 font-bold text-emerald-700">AED {alloc.allocatedAed.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Milestone Modal */}
      {activeMilestoneModal && (() => {
        const { dealId, milestoneNumber } = activeMilestoneModal;
        const deal = deals.find((d) => d.id === dealId);
        if (!deal) return null;

        const milestone = deal.milestones.find((m) => m.milestoneNumber === milestoneNumber);
        const invoice = deal.invoices.find((i) => i.milestoneNumber === milestoneNumber && i.status !== 'VOID');
        
        const pct = milestoneNumber === 1 ? 50 : milestoneNumber === 2 ? 30 : 20;
        const baseAed = invoice?.amountAed ?? (deal.dealValueAed * pct) / 100;
        const vatAed = invoice?.vatAed ?? (deal.vatAmountAed * pct) / 100;
        const totalAed = invoice?.totalAmountAed ?? (baseAed + vatAed);
        const paidAed = invoice ? (invoice.paidAed ?? Math.max(0, invoice.totalAmountAed - invoice.balanceAed)) : 0;
        const balanceAed = invoice ? invoice.balanceAed : totalAed;

        return (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Milestone Breakdown</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {milestone?.name || `Milestone ${milestoneNumber} (${pct}%)`}
                  </h3>
                  <div className="text-xs text-slate-500 font-medium mt-0.5 truncate max-w-sm">
                    {deal.name} &bull; Total: AED {deal.totalAmountAed.toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => setActiveMilestoneModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 text-xs">
                {/* Financial Table */}
                <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Milestone</th>
                      <th className="p-2.5">Base (AED)</th>
                      <th className="p-2.5">5% VAT</th>
                      <th className="p-2.5">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="p-2.5 font-medium">{pct}% of contract</td>
                      <td className="p-2.5 font-mono">{baseAed.toLocaleString()}</td>
                      <td className="p-2.5 font-mono">{vatAed.toLocaleString()}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-900">{totalAed.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Invoice Status Section */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Invoice Number:</span>
                    <span className="font-mono font-bold text-blue-600">
                      {invoice ? invoice.invoiceNumber : 'Not yet generated'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Invoice Status:</span>
                    <span>
                      {invoice ? renderInvoiceStatusBadge(invoice.status, invoice.dueDate, invoice.balanceAed) : 'PENDING'}
                    </span>
                  </div>
                  {invoice && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Due Date:</span>
                        <span className="text-slate-800 font-mono">
                          {new Date(invoice.dueDate).toISOString().split('T')[0]}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Amount Collected:</span>
                        <span className="font-bold text-emerald-600">AED {paidAed.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Remaining Balance:</span>
                        <span className="font-bold text-amber-600">AED {balanceAed.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setActiveMilestoneModal(null)}
                  className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-900 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
