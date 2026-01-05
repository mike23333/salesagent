'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { PhoneCall, X, Microphone, User, Phone } from '@phosphor-icons/react';

interface HandoffData {
  id: string;
  room_name: string;
  phone_number: string;
  customer_name: string;
  status: string;
  handoff_reason?: string;
  product_name: string;
  created_at: string;
}

interface HandoffAlertProps {
  onAccept?: (callId: string) => void;
  onDismiss?: () => void;
}

export function HandoffAlert({ onAccept, onDismiss }: HandoffAlertProps) {
  const router = useRouter();
  const [handoffs, setHandoffs] = useState<HandoffData[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const hasPlayedSound = useRef<Set<string>>(new Set());

  const playAlertSound = useCallback(() => {
    if (typeof window !== 'undefined' && window.AudioContext) {
      const audioContext = new window.AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();

      const ringPattern = async () => {
        for (let i = 0; i < 3; i++) {
          gainNode.gain.value = 0.3;
          await new Promise((r) => setTimeout(r, 200));
          gainNode.gain.value = 0;
          await new Promise((r) => setTimeout(r, 100));
        }
        oscillator.stop();
      };

      ringPattern();
    }
  }, []);

  // Poll for handoff notifications
  useEffect(() => {
    const checkForHandoffs = async () => {
      try {
        const response = await fetch('/api/handoffs/pending');
        const data = await response.json();

        if (data.handoffs && data.handoffs.length > 0) {
          // Play sound for new handoffs
          data.handoffs.forEach((h: HandoffData) => {
            if (!hasPlayedSound.current.has(h.id)) {
              playAlertSound();
              hasPlayedSound.current.add(h.id);
            }
          });
          setHandoffs(data.handoffs);
        } else {
          setHandoffs([]);
        }
      } catch (error) {
        console.error('Failed to check for handoffs:', error);
      }
    };

    // Check immediately on mount
    checkForHandoffs();

    // Then poll every 3 seconds
    const interval = setInterval(checkForHandoffs, 3000);
    return () => clearInterval(interval);
  }, [playAlertSound]);

  const handleAccept = async (handoff: HandoffData) => {
    if (onAccept) {
      onAccept(handoff.id);
    }
    // Navigate to the handoff takeover page
    router.push(`/handoff/${handoff.id}`);
  };

  const handleDismiss = (handoffId: string) => {
    setDismissedIds((prev) => new Set(prev).add(handoffId));
    if (onDismiss) {
      onDismiss();
    }
  };

  // Filter out dismissed handoffs
  const visibleHandoffs = handoffs.filter((h) => !dismissedIds.has(h.id));

  return (
    <AnimatePresence>
      {visibleHandoffs.map((handoff, index) => (
        <motion.div
          key={handoff.id}
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          style={{ top: `${16 + index * 200}px` }}
          className="fixed right-4 z-50 w-96 overflow-hidden rounded-lg border border-orange-200 bg-white shadow-xl dark:border-orange-800 dark:bg-gray-900"
        >
          {/* Pulsing header */}
          <div className="relative flex items-center gap-3 bg-orange-500 px-4 py-3 text-white">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <PhoneCall className="h-6 w-6" weight="fill" />
            </motion.div>
            <div className="flex-1">
              <h3 className="font-semibold">Handoff Requested</h3>
              <p className="text-sm text-orange-100">Customer needs assistance</p>
            </div>
            <button
              onClick={() => handleDismiss(handoff.id)}
              className="rounded-full p-1 hover:bg-orange-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Customer info */}
            <div className="mb-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <User className="h-4 w-4" />
              <span className="font-medium">{handoff.customer_name}</span>
            </div>

            <div className="mb-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Phone className="h-4 w-4" />
              <span>{handoff.phone_number}</span>
            </div>

            <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              <strong>Product:</strong> {handoff.product_name}
            </div>

            <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              <strong>Reason:</strong> {handoff.handoff_reason || 'Customer requested human agent'}
            </div>

            <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              Room: {handoff.room_name}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleAccept(handoff)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 font-medium text-white transition hover:bg-green-600"
              >
                <Microphone className="h-5 w-5" />
                Take Over Call
              </button>
            </div>
          </div>

          {/* Pulsing border animation */}
          <motion.div
            className="absolute inset-0 rounded-lg border-2 border-orange-500"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{ pointerEvents: 'none' }}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
