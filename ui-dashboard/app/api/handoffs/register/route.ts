import { NextResponse } from 'next/server';
import { addHandoff, type HandoffCall } from '@/lib/firebase-admin';

export const revalidate = 0;

// Called by the Python agent when transfer_to_human is triggered
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const handoff: HandoffCall = {
      id: body.call_id || `call-${Date.now()}`,
      room_name: body.room_name,
      phone_number: body.phone_number || 'Unknown',
      customer_name: body.customer_name || 'Customer',
      status: 'handoff_requested',
      handoff_reason: body.reason || 'Customer requested human agent',
      product_name: body.product_name || 'Unknown product',
      created_at: new Date().toISOString(),
      transcript: body.transcript || [],
    };

    addHandoff(handoff);

    console.log('Registered handoff:', handoff.id, 'room:', handoff.room_name);

    return NextResponse.json({ success: true, handoff_id: handoff.id });
  } catch (error) {
    console.error('Error registering handoff:', error);
    return NextResponse.json(
      { error: 'Failed to register handoff' },
      { status: 500 }
    );
  }
}
