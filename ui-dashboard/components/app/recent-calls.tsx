'use client';

import { useState, useEffect } from 'react';
import { Phone, PlayCircle, UserSwitch, Check, X } from '@phosphor-icons/react';

interface CallRecord {
  id: string;
  customerName: string;
  phone: string;
  date: string;
  duration: string;
  status: 'completed' | 'in_progress' | 'handoff';
  upsellAccepted: boolean;
  recordingUrl?: string;
}

// Mock data - replace with Firebase integration
const mockCalls: CallRecord[] = [
  {
    id: '1',
    customerName: 'Oleksandr Petrov',
    phone: '+380501234567',
    date: '2026-01-05 19:30',
    duration: '3:45',
    status: 'completed',
    upsellAccepted: true,
    recordingUrl: '#',
  },
  {
    id: '2',
    customerName: 'Maria Kovalenko',
    phone: '+380671234567',
    date: '2026-01-05 19:15',
    duration: '2:12',
    status: 'completed',
    upsellAccepted: false,
  },
  {
    id: '3',
    customerName: 'Ivan Shevchenko',
    phone: '+380931234567',
    date: '2026-01-05 19:00',
    duration: '5:30',
    status: 'handoff',
    upsellAccepted: false,
    recordingUrl: '#',
  },
];

export function RecentCalls() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with Firebase real-time listener
    const loadCalls = async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCalls(mockCalls);
      setIsLoading(false);
    };
    loadCalls();
  }, []);

  const getStatusBadge = (status: CallRecord['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
            Completed
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            In Progress
          </span>
        );
      case 'handoff':
        return (
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 dark:bg-orange-900 dark:text-orange-300">
            <UserSwitch className="mr-1 h-3 w-3" />
            Handoff
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Recent Calls
      </h2>
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Upsell
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {calls.map((call) => (
              <tr key={call.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex items-center">
                    <Phone className="mr-2 h-4 w-4 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {call.customerName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {call.phone}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {call.date}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {call.duration}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  {getStatusBadge(call.status)}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  {call.upsellAccepted ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <X className="h-5 w-5 text-gray-400" />
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  {call.recordingUrl && (
                    <button
                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      onClick={() => {
                        // TODO: Play recording
                        console.log('Play recording:', call.recordingUrl);
                      }}
                    >
                      <PlayCircle className="mr-1 h-4 w-4" />
                      Play
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
