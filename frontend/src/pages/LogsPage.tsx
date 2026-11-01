import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { IntegrationLog } from '../types';
import { RefreshCw, Eye, EyeOff, Search } from 'lucide-react';

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getLogs(selectedSystem || undefined, 100);
      setLogs(data);
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
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.endpoint.toLowerCase().includes(q) ||
      log.correlationId.toLowerCase().includes(q) ||
      (log.deal?.name || '').toLowerCase().includes(q) ||
      String(log.statusCode).includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">API Integration Audit Logs</h2>
          <p className="text-xs text-slate-500">
            Immutable telemetry of every outbound and inbound API call between HubSpot and Zoho Books with secret masking.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* System Filter */}
          <select
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 shadow-sm"
          >
            <option value="">All Systems (HubSpot & Zoho)</option>
            <option value="HUBSPOT">HubSpot CRM Calls</option>
            <option value="ZOHO">Zoho Books API Calls</option>
          </select>

          <button
            onClick={fetchLogs}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Filter by endpoint, deal name, correlation ID, or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">System</th>
                <th className="py-2.5 px-4">Method & Endpoint</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Duration</th>
                <th className="py-2.5 px-4">Deal / Correlation</th>
                <th className="py-2.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const isSuccess = log.statusCode >= 200 && log.statusCode < 300;

                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                          log.system === 'ZOHO' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-orange-50 text-orange-700 border border-orange-200'
                        }`}>
                          {log.system}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-slate-900 mr-1.5">{log.method}</span>
                        <span className="text-slate-600">{log.endpoint}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          isSuccess
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {log.statusCode}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500">
                        {log.durationMs}ms
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 truncate max-w-xs">{log.deal?.name || 'General Sync'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{log.correlationId}</div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors inline-flex items-center space-x-1"
                        >
                          {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Payload Viewer */}
                    {isExpanded && (
                      <tr className="bg-slate-900 text-slate-200 text-xs">
                        <td colSpan={7} className="p-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className="font-semibold text-slate-400 mb-1">Request Payload (Redacted):</div>
                              <pre className="bg-slate-950 p-3 rounded-lg overflow-x-auto text-[11px] font-mono text-emerald-400 max-h-56">
                                {log.requestBodyMasked ? JSON.stringify(JSON.parse(log.requestBodyMasked), null, 2) : 'No request body (GET)'}
                              </pre>
                            </div>

                            <div>
                              <div className="font-semibold text-slate-400 mb-1">Response Body (Redacted):</div>
                              <pre className="bg-slate-950 p-3 rounded-lg overflow-x-auto text-[11px] font-mono text-blue-300 max-h-56">
                                {log.responseBodyMasked ? JSON.stringify(JSON.parse(log.responseBodyMasked), null, 2) : 'No response body'}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
