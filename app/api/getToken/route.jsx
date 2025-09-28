import { AssemblyAI } from "assemblyai";
import { NextResponse } from "next/server";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});

export async function GET() {
  try {
    // Generates a temporary, 60-second token for the Realtime API
    const { token } = await client.streaming.createTemporaryToken({
      expires_in_seconds: 60,
    });
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Error creating AssemblyAI token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}