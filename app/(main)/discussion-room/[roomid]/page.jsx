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

  // NOTE: Removed the unused base64Encode function.

  const connectToServer = async () => {
    setEnableMic(true);

    const { token } = await getToken();

    // AssemblyAI realtime WebSocket
    // Use sample_rate=16000 as required for optimal performance.
    const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log("✅ Connected to AssemblyAI Realtime");
    };

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      // Check for API-side errors
      if (msg.error) {
          console.error("❌ AssemblyAI API Error:", msg.error);
      }

      if (msg.message_type === "PartialTranscript") {
        console.log("🎤 You are saying (live):", msg.text); // LIVE speech in console
        setPartial(msg.text); 
      }

      if (msg.message_type === "FinalTranscript") {
        console.log("✅ You said:", msg.text); // FINAL speech in console
        console.log("📝 Complete transcript so far:", [...transcripts, msg.text].join(" "));
        setTranscripts((prev) => [...prev, msg.text]); 
        setPartial(""); 
      }
    };

    ws.current.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
    };

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        recorder.current = new RecordRTC(stream, {
          type: "audio",
          // Use audio/wav for reliable raw PCM data chunks
          mimeType: "audio/wav", 
          recorderType: RecordRTC.StereoAudioRecorder,
          timeSlice: 250, // Send chunk every 250ms
          desiredSampRate: 16000,
          numberOfAudioChannels: 1,
          bufferSize: 4096,

          // Send audio chunks to AssemblyAI
          ondataavailable: async (blob) => {
            if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

            clearTimeout(silenceTimeout.current);

            const buffer = await blob.arrayBuffer();
            
            // CRITICAL FIX: Send the raw ArrayBuffer (binary data) directly
            ws.current.send(buffer); 

            silenceTimeout.current = setTimeout(() => {
              console.log("User stopped talking.");
            }, 2000);
          },
        });

        recorder.current.startRecording();
        console.log("🎙️ Started recording audio stream...");
      })
      .catch((err) => {
        console.error("⚠️ Error accessing microphone:", err);
      });
  };

  const disconnect = async () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    if (recorder.current) {
      recorder.current.stopRecording(() => {
        
        // Log the successful creation of the final audio blob
        const audioBlob = recorder.current.getBlob();
        console.log(`💾 Final audio blob created: ${audioBlob.type} -> ${Math.round(audioBlob.size / 1024)} KB`);
        
        recorder.current = null;
        setEnableMic(false);
        console.log("🛑 Stopped recording audio stream.");
      });
    }

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
          <div className="mt-5 flex items-center justify-center">
            {!enableMic ? (
              <Button onClick={connectToServer}>Connect</Button>
            ) : (
              <Button variant="destructive" onClick={disconnect}>
                Disconnect
              </Button>
            )}
          </div>
        </div>
        <div>
          <div className="h-[60vh] bg-secondary border rounded-4xl flex flex-col items-start p-4 overflow-y-auto">
            <h2 className="font-bold mb-2">Live Transcript</h2>
            <div className="space-y-1 text-sm text-gray-700 w-full">
              {transcripts.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              {partial && (
                <p className="text-gray-500 italic">{partial}</p> 
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