'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useParticipants,
  useLocalParticipant,
  useTracks,
  AudioTrack,
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import { motion } from 'motion/react';
import {
  Microphone,
  MicrophoneSlash,
  Phone,
  PhoneDisconnect,
  User,
  ChatText,
  ArrowLeft,
} from '@phosphor-icons/react';

interface TranscriptEntry {
  speaker: 'agent' | 'user';
  text: string;
  timestamp: string;
}

interface CallDetails {
  customerName: string;
  phoneNumber: string;
  productName: string;
  handoffReason?: string;
  transcript: TranscriptEntry[];
}

interface JoinResponse {
  serverUrl: string;
  roomName: string;
  token: string;
  operatorIdentity: string;
  callDetails: CallDetails;
}

function TranscriptView({ transcript }: { transcript: TranscriptEntry[] }) {
  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
        <ChatText className="h-5 w-5" />
        Conversation History
      </h3>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
        {transcript.map((entry, i) => (
          <div
            key={i}
            className={`flex ${entry.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                entry.speaker === 'agent'
                  ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                  : 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100'
              }`}
            >
              <div className="mb-1 text-xs font-medium opacity-70">
                {entry.speaker === 'agent' ? 'AI Agent' : 'Customer'} - {entry.timestamp}
              </div>
              <div>{entry.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallControls({ onDisconnect }: { onDisconnect: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = async () => {
    await localParticipant.setMicrophoneEnabled(isMuted);
    setIsMuted(!isMuted);
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={toggleMute}
        className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
          isMuted
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'
        }`}
      >
        {isMuted ? (
          <MicrophoneSlash className="h-6 w-6" weight="fill" />
        ) : (
          <Microphone className="h-6 w-6" weight="fill" />
        )}
      </button>

      <button
        onClick={onDisconnect}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
      >
        <PhoneDisconnect className="h-6 w-6" weight="fill" />
      </button>
    </div>
  );
}

function RoomContent({
  callDetails,
  onDisconnect,
}: {
  callDetails: CallDetails;
  onDisconnect: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Microphone]);

  // Listen for room events
  useEffect(() => {
    const handleDisconnected = () => {
      console.log('Room disconnected');
    };

    room.on(RoomEvent.Disconnected, handleDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room]);

  return (
    <div className="flex h-full gap-6 p-6">
      {/* Left panel - Transcript */}
      <div className="flex w-1/2 flex-col rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900">
        <TranscriptView transcript={callDetails.transcript} />
      </div>

      {/* Right panel - Call controls */}
      <div className="flex w-1/2 flex-col rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900">
        {/* Customer info */}
        <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <div className="mb-2 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {callDetails.customerName}
            </span>
          </div>
          <div className="mb-2 flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Phone className="h-4 w-4" />
            <span>{callDetails.phoneNumber}</span>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Product:</strong> {callDetails.productName}
          </div>
          {callDetails.handoffReason && (
            <div className="mt-2 rounded bg-orange-100 px-3 py-2 text-sm text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              <strong>Handoff reason:</strong> {callDetails.handoffReason}
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
            In this call ({participants.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <div
                key={p.identity}
                className="rounded-full bg-gray-200 px-3 py-1 text-sm dark:bg-gray-700"
              >
                {p.name || p.identity}
              </div>
            ))}
          </div>
        </div>

        {/* Call status */}
        <div className="mb-6 flex flex-1 flex-col items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
          >
            <Phone className="h-12 w-12 text-green-600 dark:text-green-400" weight="fill" />
          </motion.div>
          <p className="text-lg font-medium text-green-600 dark:text-green-400">
            Connected - Speaking with customer
          </p>
        </div>

        {/* Audio tracks */}
        {tracks.map((track) => (
          <AudioTrack key={track.participant.identity} trackRef={track} />
        ))}

        {/* Controls */}
        <CallControls onDisconnect={onDisconnect} />
      </div>
    </div>
  );
}

export default function HandoffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [joinData, setJoinData] = useState<JoinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    async function joinHandoff() {
      try {
        const response = await fetch(`/api/handoffs/${id}/join`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to join handoff');
        }

        const data = await response.json();
        setJoinData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join call');
      }
    }

    joinHandoff();
  }, [id]);

  const handleDisconnect = () => {
    router.push('/');
  };

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-100 dark:bg-gray-950">
        <div className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-900">
          <h1 className="mb-4 text-xl font-bold text-red-600">Error</h1>
          <p className="mb-4 text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!joinData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-100 dark:bg-gray-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="mb-4 h-12 w-12 rounded-full border-4 border-blue-500 border-t-transparent"
        />
        <p className="text-gray-600 dark:text-gray-400">Connecting to call...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Handoff - {joinData.callDetails.customerName}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </header>

      {/* LiveKit Room */}
      <LiveKitRoom
        serverUrl={joinData.serverUrl}
        token={joinData.token}
        connect={true}
        audio={true}
        video={false}
        onConnected={() => setIsConnected(true)}
        onDisconnected={handleDisconnect}
        className="h-[calc(100vh-73px)]"
      >
        <RoomAudioRenderer />
        <RoomContent callDetails={joinData.callDetails} onDisconnect={handleDisconnect} />
      </LiveKitRoom>
    </div>
  );
}
