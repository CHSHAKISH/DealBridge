import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Handshake, 
  ScrollText, 
  PieChart, 
  CheckCircle2, 
  ExternalLink 
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'deals' | 'logs' | 'collections'>('overview');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
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

          <div className="flex items-center space-x-2">
            <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Integration Active
            </span>
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

        {/* Placeholder / Preview Content for Phase 0 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <div className="max-w-3xl">
            <div className="flex items-center space-x-3 text-emerald-600 mb-3">
              <CheckCircle2 className="w-6 h-6" />
              <h2 className="text-xl font-bold text-slate-900">Phase 0 Initialized Successfully</h2>
            </div>
            <p className="text-slate-600 mb-6">
              DealBridge project scaffolding is ready. The environment features a full Node.js + TypeScript backend with Express, Docker Compose for PostgreSQL & Redis, and a modern React + Tailwind CSS frontend.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-1">Backend Setup</h4>
                <p className="text-slate-500">Node 24 + Express + TypeScript, Prisma ORM, BullMQ queue, and secure environment configuration.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-1">Frontend Setup</h4>
                <p className="text-slate-500">React + Vite + Tailwind CSS with layout prepared for Deals, Live Logs, and Collections Aging.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

