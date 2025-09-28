import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Generate temporary token using direct API call as per documentation
    // https://www.assemblyai.com/docs/api-reference/streaming-api/generate-streaming-token
    const response = await fetch(
      `https://streaming.assemblyai.com/v3/token?expires_in_seconds=300&max_session_duration_seconds=1800`,
      {
        method: 'GET',
        headers: {
          'Authorization': process.env.ASSEMBLYAI_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Token generation failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ Generated temporary token for Universal Streaming API");
    console.log(`Token expires in ${data.expires_in_seconds} seconds`);
    
    return NextResponse.json({ 
      token: data.token,
      expires_in_seconds: data.expires_in_seconds 
    });
  } catch (error) {
    console.error("❌ Error creating AssemblyAI token:", error);
    return NextResponse.json(
      { error: "Failed to generate token", details: error.message },
      { status: 500 }
    );
  }
}