"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CoachingExpert } from "@/services/Options";
import { UserButton } from "@stackframe/stack";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import RecordRTC from "recordrtc";
import { getToken } from "@/services/GlobalServices";

function DiscussionRoom() {
  const { roomid } = useParams();
  const DiscussionRoomData = useQuery(api.DiscussionRoom.GetDiscussionRoom, {
    id: roomid,
  });

  const [expert, setExpert] = useState();
  const [enableMic, setEnableMic] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // store final + partial transcripts
  const [transcripts, setTranscripts] = useState([]); 
  const [partial, setPartial] = useState(""); 

  const recorder = useRef(null);
  const silenceTimeout = useRef(null);
  const ws = useRef(null);

  useEffect(() => {
    if (DiscussionRoomData) {
      const Expert = CoachingExpert.find(
        (item) => item.name === DiscussionRoomData.expertName
      );
      setExpert(Expert);
    }
  }, [DiscussionRoomData]);

  // Cleanup effect to ensure proper disconnection
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (ws.current) {
        ws.current.close();
      }
      if (recorder.current) {
        recorder.current.stopRecording();
      }
      if (silenceTimeout.current) {
        clearTimeout(silenceTimeout.current);
      }
    };
  }, []);

  // NOTE: Removed the unused base64Encode function.

  const connectToServer = async () => {
    setEnableMic(true);

    const { token } = await getToken();

    // AssemblyAI Universal Streaming WebSocket
    // Use sample_rate=16000 as required for optimal performance.
    const wsUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&encoding=pcm_s16le&format_turns=true&token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log("✅ Connected to AssemblyAI Universal Streaming API");
      setIsConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("📨 Received message:", msg);

        // Handle session begin
        if (msg.type === "Begin") {
          console.log("✅ Session started:", msg.id, "Expires at:", new Date(msg.expires_at * 1000));
          return;
        }

        // Handle turn events (Universal Streaming API format)
        if (msg.type === "Turn") {
          console.log("🎤 Turn event:", {
            transcript: msg.transcript,
            end_of_turn: msg.end_of_turn,
            turn_is_formatted: msg.turn_is_formatted
          });

          // Show partial transcript (ongoing speech)
          if (!msg.end_of_turn) {
            console.log("🎤 You are saying (live):", msg.transcript);
            setPartial(msg.transcript);
          }
          
          // Handle end of turn (final transcript)
          if (msg.end_of_turn) {
            console.log("✅ You said:", msg.transcript);
            console.log("📝 Complete transcript so far:", [...transcripts, msg.transcript].join(" "));
            setTranscripts((prev) => [...prev, msg.transcript]);
            setPartial(""); // Clear partial transcript
          }
        }

        // Handle session termination
        if (msg.type === "Termination") {
          console.log("🛑 Session terminated:", msg);
        }

        // Handle errors
        if (msg.error) {
          console.error("❌ AssemblyAI API Error:", msg.error);
        }
      } catch (error) {
        console.error("❌ Error parsing WebSocket message:", error, event.data);
      }
    };

    ws.current.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
      setEnableMic(false);
      setIsConnected(false);
    };

    ws.current.onclose = (event) => {
      console.log("🔌 WebSocket connection closed:", event.code, event.reason);
      setEnableMic(false);
      setIsConnected(false);
    };

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        recorder.current = new RecordRTC(stream, {
          type: "audio",
          // Use audio/wav for PCM16 encoding compatible with AssemblyAI
          mimeType: "audio/wav",
          recorderType: RecordRTC.StereoAudioRecorder,
          timeSlice: 100, // Send chunk every 100ms (recommended for streaming)
          desiredSampRate: 16000, // Required sample rate for AssemblyAI
          numberOfAudioChannels: 1, // Mono channel required
          bufferSize: 4096,

          // Send audio chunks to AssemblyAI Universal Streaming API
          ondataavailable: async (blob) => {
            if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

            clearTimeout(silenceTimeout.current);

            try {
              // Convert blob to ArrayBuffer for PCM16 data
              const arrayBuffer = await blob.arrayBuffer();
              
              // Send raw PCM audio data directly as binary
              ws.current.send(arrayBuffer);
              
              silenceTimeout.current = setTimeout(() => {
                console.log("User stopped talking.");
              }, 2000);
            } catch (error) {
              console.error("Error sending audio data:", error);
            }
          },
        });

        recorder.current.startRecording();
        console.log("🎙️ Started recording audio stream...");
      })
      .catch((err) => {
        console.error("⚠️ Error accessing microphone:", err);
        setEnableMic(false);
        
        // Provide user-friendly error messages
        if (err.name === 'NotAllowedError') {
          alert('Microphone access denied. Please allow microphone access and try again.');
        } else if (err.name === 'NotFoundError') {
          alert('No microphone found. Please ensure a microphone is connected.');
        } else {
          alert('Error accessing microphone: ' + err.message);
        }
      });
  };

  const disconnect = async () => {
    // Send session termination message before closing
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify({ type: "Terminate" }));
        console.log("📤 Sent termination message");
      } catch (error) {
        console.error("❌ Error sending termination message:", error);
      }
      
      // Close WebSocket connection
      ws.current.close();
      ws.current = null;
    }

    // Stop audio recording
    if (recorder.current) {
      recorder.current.stopRecording(() => {
        // Log the successful creation of the final audio blob
        const audioBlob = recorder.current.getBlob();
        console.log(`💾 Final audio blob created: ${audioBlob.type} -> ${Math.round(audioBlob.size / 1024)} KB`);
        
        recorder.current = null;
        setEnableMic(false);
        setIsConnected(false);
        console.log("🛑 Stopped recording audio stream.");
      });
    }

    // Clear timeouts
    if (silenceTimeout.current) {
      clearTimeout(silenceTimeout.current);
    }
  };

  return (
    <div className="-mt-12">
      <h2 className="text-lg font-bold">{DiscussionRoomData?.coachingOption}</h2>
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <div className="h-[60vh] bg-secondary border rounded-4xl flex flex-col items-center justify-center relative">
            {expert?.avatar && (
              <Image
                src={expert.avatar}
                alt="Avatar"
                width={200}
                height={200}
                className="h-[80px] w-[80px] rounded-full object-cover animate-pulse"
              />
            )}
            <h2 className="text-gray-500">{expert?.name}</h2>
            <div className="p-5 bg-gray-200 px-10 rounded-lg absolute bottom-10 right-10">
              <UserButton />
            </div>
          </div>
          <div className="mt-5 flex items-center justify-center gap-4">
            {!enableMic ? (
              <Button onClick={connectToServer} className="px-8">
                🎤 Start Recording
              </Button>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-red-600 font-medium">Recording</span>
                </div>
                <Button variant="destructive" onClick={disconnect} className="px-8">
                  🛑 Stop Recording
                </Button>
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="h-[60vh] bg-secondary border rounded-4xl flex flex-col items-start p-4 overflow-y-auto">
            <div className="flex items-center justify-between w-full mb-2">
              <h2 className="font-bold">Live Transcript</h2>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-500">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-700 w-full">
              {transcripts.length === 0 && !partial && (
                <p className="text-gray-400 italic">Start speaking to see live transcription...</p>
              )}
              {transcripts.map((line, i) => (
                <div key={i} className="p-2 bg-white rounded border-l-4 border-blue-500">
                  <p className="text-gray-800">{line}</p>
                </div>
              ))}
              {partial && (
                <div className="p-2 bg-yellow-50 rounded border-l-4 border-yellow-400">
                  <p className="text-gray-600 italic">🎤 {partial}</p>
                </div>
              )}
            </div>
          </div>
          <h2 className="mt-4 text-gray-400 text-sm">
            At the end of your conversation you will automatically generate feedback/notes from your conversation
          </h2>
        </div>
      </div>
    </div>
  );
}

export default DiscussionRoom;