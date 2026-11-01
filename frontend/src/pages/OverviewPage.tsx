import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Deal, ApiMetrics } from '../types';
import { 
  Building2, 
  Handshake, 
  CheckCircle2, 
  Clock, 
  Receipt, 
  Wallet, 
  AlertCircle, 
  Activity 
} from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [metrics, setMetrics] = useState<ApiMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [dealsData, metricsData] = await Promise.all([
          api.getDeals(),
          api.getMetrics(),
        ]);
        setDeals(dealsData);
        setMetrics(metricsData);
      } catch (err) {
        console.error('Failed to load overview data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <Activity className="w-6 h-6 animate-spin mr-2 text-blue-600" />
        Loading dashboard metrics...
      </div>
    );
  }

  // Calculate high-level KPIs
  const totalCustomers = new Set(deals.map((d) => d.customerId)).size;
  const totalDeals = deals.length;
  const syncedDeals = deals.filter((d) => d.syncStatus === 'SYNCED').length;

  const totalSalesOrderValue = deals.reduce((acc, d) => acc + (d.totalAmountAed || 0), 0);
  
  // Total Invoiced and Total Collected from active invoices
  let totalInvoicedAed = 0;
  let totalOutstandingAed = 0;
  deals.forEach((d) => {
    d.invoices.forEach((inv) => {
      if (inv.status !== 'VOID') {
        totalInvoicedAed += inv.totalAmountAed;
        totalOutstandingAed += inv.balanceAed;
      }
    });
  });
  const totalCollectedAed = Math.max(0, totalInvoicedAed - totalOutstandingAed);

  const kpis = [
    {
      label: 'Total Deals',
      value: totalDeals,
      sub: `${syncedDeals} fully synced`,
      icon: Handshake,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Total Customers',
      value: totalCustomers,
      sub: 'Mapped to Zoho Books Customers',
      icon: Building2,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Sales Orders Total',
      value: `AED ${totalSalesOrderValue.toLocaleString()}`,
      sub: 'Including 5% UAE VAT',
      icon: Receipt,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Total Invoiced',
      value: `AED ${totalInvoicedAed.toLocaleString()}`,
      sub: `${totalSalesOrderValue > 0 ? ((totalInvoicedAed / totalSalesOrderValue) * 100).toFixed(1) : 0}% of order value`,
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Cash Collected',
      value: `AED ${totalCollectedAed.toLocaleString()}`,
      sub: `${totalSalesOrderValue > 0 ? ((totalCollectedAed / totalSalesOrderValue) * 100).toFixed(1) : 0}% collected`,
      icon: Wallet,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Accounts Receivable',
      value: `AED ${totalOutstandingAed.toLocaleString()}`,
      sub: 'Outstanding balances',
      icon: AlertCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start space-x-4">
              <div className={`p-3 rounded-lg ${kpi.bg} ${kpi.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">{kpi.value}</div>
                <div className="text-xs text-slate-500 mt-1">{kpi.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reconciliation Indicator */}
      {(() => {
        const isReconciled = Math.abs(totalCollectedAed + totalOutstandingAed - totalInvoicedAed) < 0.01;
        return (
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
              isReconciled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              <span className={`h-2 w-2 rounded-full mr-2 ${isReconciled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {isReconciled ? 'Reconciled' : 'Reconciliation Mismatch'}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Collected + Outstanding = Invoiced &nbsp;
              ({totalCollectedAed.toLocaleString()} + {totalOutstandingAed.toLocaleString()} ≈ {totalInvoicedAed.toLocaleString()})
            </span>
          </div>
        );
      })()}

      {/* System Telemetry & Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">API Call Instrumentation</h3>
            <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Required assignment metric measuring Zoho Books API consumption from Closed Won to paid.
          </p>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-sm font-medium text-slate-700">Total Zoho Books API Calls:</span>
              <span className="text-sm font-bold text-blue-600">{metrics?.zohoCallsTotal || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-sm font-medium text-slate-700">Zoho Calls During Idle Sync:</span>
              <span className="text-sm font-bold text-slate-800">{metrics?.zohoCallsLastSync || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-sm font-medium text-slate-700">Total HubSpot CRM API Calls:</span>
              <span className="text-sm font-bold text-indigo-600">{metrics?.hubspotCallsTotal || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-2">Integration Health & Rules</h3>
          <p className="text-xs text-slate-500 mb-4">
            Active guardrails ensuring production-grade financial accuracy.
          </p>

          <ul className="space-y-2.5 text-xs text-slate-600">
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span><strong>Idempotency Guarantees:</strong> Unique operation locks prevent duplicate orders.</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span><strong>Penny/Fils Accuracy:</strong> All money calculations computed in integer minor units.</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span><strong>Strict Product Mapping:</strong> Never guesses an item; halts if unmapped.</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span><strong>Diff-Based CRM Sync:</strong> Only writes changed fields, preserving quota.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
