import { NextResponse } from 'next/server';
import { getPendingHandoffs } from '@/lib/firebase-admin';

export const revalidate = 0;

export async function GET() {
  try {
    const handoffs = getPendingHandoffs();
    return NextResponse.json({ handoffs });
  } catch (error) {
    console.error('Error fetching pending handoffs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending handoffs' },
      { status: 500 }
    );
  }
}
