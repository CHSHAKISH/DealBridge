import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Handshake, 
  ScrollText, 
  PieChart 
} from 'lucide-react';
import { OverviewPage } from './pages/OverviewPage';
import { DealsPage } from './pages/DealsPage';
import { LogsPage } from './pages/LogsPage';
import { CollectionsPage } from './pages/CollectionsPage';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'deals' | 'logs' | 'collections'>('overview');
  const [engineStatus, setEngineStatus] = useState<'online' | 'degraded' | 'offline'>('online');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || '/api';
        const res = await fetch(`${apiBase}/health`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'healthy') {
            setEngineStatus('online');
          } else {
            setEngineStatus('degraded');
          }
        } else {
          setEngineStatus('degraded');
        }
      } catch {
        setEngineStatus('offline');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
              DB
            </div>
            <div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">DealBridge</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                HubSpot ⇄ Zoho Books
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {engineStatus === 'online' && (
              <span className="flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                Integration Engine Online
              </span>
            )}
            {engineStatus === 'degraded' && (
              <span className="flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-500 mr-1.5"></span>
                Integration Engine Degraded
              </span>
            )}
            {engineStatus === 'offline' && (
              <span className="flex items-center text-xs font-medium text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                <span className="h-2 w-2 rounded-full bg-rose-500 mr-1.5"></span>
                Integration Engine Offline
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-b border-slate-200 mb-8 pb-1">
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'deals', label: 'Deals & Invoices', icon: Handshake },
            { id: 'logs', label: 'Integration Logs', icon: ScrollText },
            { id: 'collections', label: 'Collections Aging', icon: PieChart },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewPage />}
        {activeTab === 'deals' && <DealsPage />}
        {activeTab === 'logs' && <LogsPage />}
        {activeTab === 'collections' && <CollectionsPage />}
      </div>
    </div>
  );
}
