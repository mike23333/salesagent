'use client';

import { useState } from 'react';
import { Phone, ChartLine, Users, ArrowClockwise } from '@phosphor-icons/react';
import { RecentCalls } from '@/components/app/recent-calls';
import { HandoffAlert } from '@/components/app/handoff-alert';

// Stats card component
function StatCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {value}
          </p>
          {trend && (
            <p
              className={`mt-1 text-sm ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.isPositive ? '+' : ''}
              {trend.value}% from yesterday
            </p>
          )}
        </div>
        <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
          <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // TODO: Refresh data from Firebase
    await new Promise((r) => setTimeout(r, 1000));
    setIsRefreshing(false);
  };

  const handleHandoffAccept = (callId: string) => {
    console.log('Accepting handoff for call:', callId);
    // TODO: Join the LiveKit room and take over the call
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
      {/* Handoff Alert - always rendered, shows when needed */}
      <HandoffAlert onAccept={handleHandoffAccept} />

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Rozetka Sales Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Monitor AI sales calls and manage handoffs
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          <ArrowClockwise
            className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Calls Today"
          value={47}
          icon={Phone}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Upsell Rate"
          value="23%"
          icon={ChartLine}
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          title="Active Calls"
          value={3}
          icon={Users}
        />
        <StatCard
          title="Handoffs Today"
          value={8}
          icon={Phone}
          trend={{ value: 2, isPositive: false }}
        />
      </div>

      {/* Recent Calls Table */}
      <RecentCalls />
    </div>
  );
}
