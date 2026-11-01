import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { IntegrationLog } from '../types';
import { RefreshCw, Search, X, AlertOctagon } from 'lucide-react';

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [inspectedLog, setInspectedLog] = useState<IntegrationLog | null>(null);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getLogs(selectedSystem || undefined, 100);
      setLogs(data);
      if (inspectedLog) {
        const updated = data.find((l) => l.id === inspectedLog.id);
        if (updated) setInspectedLog(updated);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedSystem]);

  const filteredLogs = logs.filter((log) => {
    // Search query
    if (search) {
      const q = search.toLowerCase();
      const matches =
        log.endpoint.toLowerCase().includes(q) ||
        log.correlationId.toLowerCase().includes(q) ||
        (log.deal?.name || '').toLowerCase().includes(q) ||
        String(log.statusCode).includes(q) ||
        log.method.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Status filter
    if (statusFilter === 'SUCCESS') {
      if (log.statusCode < 200 || log.statusCode >= 300) return false;
    } else if (statusFilter === 'FAILED') {
      if (log.statusCode < 400) return false;
    } else if (statusFilter === '4XX') {
      if (log.statusCode < 400 || log.statusCode >= 500) return false;
    } else if (statusFilter === '5XX') {
      if (log.statusCode < 500) return false;
    }

    // Date range filter
    if (fromDate) {
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];
      if (logDate < fromDate) return false;
    }
    if (toDate) {
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];
      if (logDate > toDate) return false;
    }

    return true;
  });

  const formatJson = (maskedJson?: string) => {
    if (!maskedJson) return null;
    try {
      return JSON.stringify(JSON.parse(maskedJson), null, 2);
    } catch {
      return maskedJson;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">API Integration Audit Logs</h2>
          <p className="text-xs text-slate-500">
            Immutable telemetry of every outbound and inbound API call between HubSpot and Zoho Books with secret masking.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by endpoint, deal name, correlation ID, method, or HTTP status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* System Filter */}
          <select
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Systems (HubSpot & Zoho)</option>
            <option value="HUBSPOT">HubSpot CRM Calls</option>
            <option value="ZOHO">Zoho Books API Calls</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All HTTP Statuses</option>
            <option value="SUCCESS">Success Only (2xx)</option>
            <option value="FAILED">All Failures (4xx & 5xx)</option>
            <option value="4XX">Client / Validation (4xx)</option>
            <option value="5XX">Server Errors (5xx)</option>
          </select>
        </div>

        {/* Date Filter Strip */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <span className="font-medium text-slate-500">Date Range:</span>
          <div className="flex items-center space-x-1.5">
            <label className="text-[11px] text-slate-400">From:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700"
            />
          </div>
          <div className="flex items-center space-x-1.5">
            <label className="text-[11px] text-slate-400">To:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="text-[11px] text-blue-600 hover:underline ml-2"
            >
              Clear dates
            </button>
          )}
          <span className="ml-auto text-slate-400 text-[11px]">
            Showing {filteredLogs.length} of {logs.length} logs
          </span>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4 whitespace-nowrap">Timestamp</th>
                <th className="py-2.5 px-4 whitespace-nowrap">System</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Direction</th>
                <th className="py-2.5 px-4">Method & Endpoint</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Duration</th>
                <th className="py-2.5 px-4">Deal / Correlation</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap min-w-[90px]">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No integration logs match the search or filter conditions.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isSuccess = log.statusCode >= 200 && log.statusCode < 300;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setInspectedLog(log)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        <div>{new Date(log.createdAt).toLocaleTimeString()}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(log.createdAt).toISOString().split('T')[0]}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                          log.system === 'ZOHO' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-orange-50 text-orange-700 border border-orange-200'
                        }`}>
                          {log.system}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium text-[11px] whitespace-nowrap ${
                          log.direction === 'OUTBOUND'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {log.direction === 'OUTBOUND' ? '→ Outbound' : '← Inbound'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-slate-900 mr-1.5">{log.method}</span>
                        <span className="text-slate-600">{log.endpoint}</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          isSuccess
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {log.statusCode}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">
                        {log.durationMs}ms
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 truncate max-w-xs">
                          {log.deal?.name || 'General Sync / Hook'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{log.correlationId}</div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap min-w-[90px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedLog(log);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Side Drawer */}
      {inspectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 text-slate-200 h-full shadow-2xl flex flex-col overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950 sticky top-0 z-10">
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    inspectedLog.statusCode >= 200 && inspectedLog.statusCode < 300
                      ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                      : 'bg-rose-900/60 text-rose-300 border border-rose-700'
                  }`}>
                    HTTP {inspectedLog.statusCode}
                  </span>
                  <span className="font-mono text-xs text-amber-400 font-bold">{inspectedLog.method}</span>
                  <span className="text-xs text-slate-400">{inspectedLog.system}</span>
                </div>
                <div className="font-mono text-sm font-bold text-slate-100 mt-1 break-all">
                  {inspectedLog.endpoint}
                </div>
              </div>
              <button
                onClick={() => setInspectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 space-y-5 text-xs">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Direction</div>
                  <div className="font-semibold text-slate-200 mt-0.5">{inspectedLog.direction}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Duration</div>
                  <div className="font-mono font-semibold text-slate-200 mt-0.5">{inspectedLog.durationMs}ms</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Timestamp</div>
                  <div className="font-mono text-slate-300 mt-0.5">
                    {new Date(inspectedLog.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-3 pt-2 border-t border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Correlation ID</div>
                  <div className="font-mono text-slate-300 select-all">{inspectedLog.correlationId}</div>
                </div>
                {inspectedLog.deal?.name && (
                  <div className="col-span-2 sm:col-span-3">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Associated Deal</div>
                    <div className="font-semibold text-blue-400">{inspectedLog.deal.name}</div>
                  </div>
                )}
              </div>

              {/* Error Alert if any */}
              {inspectedLog.errorMessage && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg flex items-start space-x-2.5 text-rose-200">
                  <AlertOctagon className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-300">Error Description:</div>
                    <div className="mt-0.5 font-mono text-[11px]">{inspectedLog.errorMessage}</div>
                  </div>
                </div>
              )}

              {/* Sanitized Request Payload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-400">Request Payload (Masked):</span>
                  <span className="text-[10px] text-slate-500">Tokens & Secrets Redacted</span>
                </div>
                <pre className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 overflow-x-auto font-mono text-[11px] text-emerald-400 max-h-72">
                  {formatJson(inspectedLog.requestBodyMasked) || 'No request body sent (GET request)'}
                </pre>
              </div>

              {/* Sanitized Response Payload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-400">Response Payload (Masked):</span>
                  <span className="text-[10px] text-slate-500">Tokens & Secrets Redacted</span>
                </div>
                <pre className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 overflow-x-auto font-mono text-[11px] text-blue-300 max-h-72">
                  {formatJson(inspectedLog.responseBodyMasked) || 'No response body'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
