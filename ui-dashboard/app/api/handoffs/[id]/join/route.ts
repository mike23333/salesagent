import { NextResponse } from 'next/server';
import { AccessToken, type VideoGrant } from 'livekit-server-sdk';
import { getHandoffById, updateHandoffStatus } from '@/lib/firebase-admin';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export const revalidate = 0;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json(
        { error: 'LiveKit credentials not configured' },
        { status: 500 }
      );
    }

    const handoff = getHandoffById(id);
    console.log('Looking for handoff:', id, 'Found:', handoff ? 'yes' : 'no');
    if (!handoff) {
      return NextResponse.json(
        { error: 'Handoff not found', id },
        { status: 404 }
      );
    }

    // Generate token for human operator to join the room
    const operatorIdentity = `human_operator_${Date.now()}`;
    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: operatorIdentity,
      name: 'Human Operator',
      ttl: '30m',
    });

    const grant: VideoGrant = {
      room: handoff.room_name,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    };
    at.addGrant(grant);

    const token = await at.toJwt();

    // Mark handoff as being handled
    updateHandoffStatus(id, 'active');

    return NextResponse.json({
      serverUrl: LIVEKIT_URL,
      roomName: handoff.room_name,
      token,
      operatorIdentity,
      callDetails: {
        customerName: handoff.customer_name,
        phoneNumber: handoff.phone_number,
        productName: handoff.product_name,
        handoffReason: handoff.handoff_reason,
        transcript: handoff.transcript,
      },
    });
  } catch (error) {
    console.error('Error joining handoff:', error);
    return NextResponse.json(
      { error: 'Failed to join handoff' },
      { status: 500 }
    );
  }
}
