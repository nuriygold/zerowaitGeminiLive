import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";

export type Caption = {
  text: string;
  isUser: boolean;
  timestamp: number;
};

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private audioQueue: Int16Array[] = [];
  private isPlaying = false;
  private onCaption: (caption: Caption) => void;
  private onStatus: (status: string) => void;
  private onUiState: (state: string) => void;
  private isMuted = false;

  constructor(apiKey: string, onCaption: (caption: Caption) => void, onStatus: (status: string) => void, onUiState: (state: string) => void) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onCaption = onCaption;
    this.onStatus = onStatus;
    this.onUiState = onUiState;
  }

  async start() {
    try {
      this.onStatus("Connecting...");
      
      // Initialize AudioContext on user gesture
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const sessionPromise = this.ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: () => {
            this.onStatus("Listening");
            this.startAudioCapture();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const base64Data = part.inlineData.data;
                  console.log("Received audio data chunk, length:", base64Data.length);
                  const binaryString = atob(base64Data);
                  const len = binaryString.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  // Ensure we have an even number of bytes for Int16
                  if (len % 2 === 0) {
                    this.audioQueue.push(new Int16Array(bytes.buffer));
                    if (!this.isPlaying) {
                      this.playNextInQueue();
                    }
                  }
                }
              }
            }

            if (message.serverContent?.interrupted) {
              this.audioQueue = [];
              this.isPlaying = false;
            }

            // Handle Transcriptions
            const modelTranscription = message.serverContent?.modelTurn?.parts?.find(p => p.text)?.text;
            if (modelTranscription) {
               // Check for UI state JSON
               const lines = modelTranscription.split('\n');
               let cleanText = "";
               for (const line of lines) {
                 try {
                   const json = JSON.parse(line.trim());
                   if (json.ui_state) {
                     this.onUiState(json.ui_state);
                     continue;
                   }
                 } catch {
                   cleanText += (cleanText ? "\n" : "") + line;
                 }
               }
               if (cleanText) {
                 this.onCaption({ text: cleanText, isUser: false, timestamp: Date.now() });
               }
            }

            const userTranscription = (message.serverContent as any)?.userTurn?.parts?.find((p: any) => p.text)?.text;
            if (userTranscription) {
               this.onCaption({ text: userTranscription, isUser: true, timestamp: Date.now() });
            }

            // Handle tool calls
            if (message.toolCall) {
              for (const call of message.toolCall.functionCalls) {
                const result = await this.handleFunctionCall(call);
                this.session.sendToolResponse({
                  functionResponses: [{
                    name: call.name,
                    response: result,
                    id: call.id
                  }]
                });
              }
            }
          },
          onclose: () => this.onStatus("Disconnected"),
          onerror: (err) => {
            console.error("Live API Error:", err);
            this.onStatus("Error");
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          inputAudioTranscription: {},
          systemInstruction: `You are “zerowait doctor assistant,” a hands-free patient check-in agent.

When you send a reply, always include a JSON fragment on a new line:
{"ui_state":"<GREETING|LISTENING|VERIFY|CHECKED_IN|ERROR>"}
Follow the JSON with your spoken text on the next line.

Conversation phase / ui_state token:
- Greeting splash: GREETING
- Mic is live: LISTENING
- Name + DOB heard: VERIFY
- Check-in success: CHECKED_IN
- Any backend fail: ERROR

PRIMARY OBJECTIVE: Help patients confirm identity and complete check-in with zero clicks/typing.
OPERATING RULES:
1. Greet immediately (≤ 10 words). Set ui_state to GREETING.
2. Collect: full legal name, DOB (YYYY-MM-DD). While listening, set ui_state to LISTENING.
3. Once captured, call getUpcomingAppointments. Set ui_state to VERIFY.
4. Read appointment details and ask: “Would you like me to complete your check-in now?”
5. If yes, call completeCheckIn and confirm success. Set ui_state to CHECKED_IN.
6. If no/unclear, end politely.
7. Assume everything the user says is accurate for this demo.
8. Never request medical symptoms, insurance, or payment.
VOICE: Second-person, empathetic, professional. ≤ 25 words per utterance.`,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "getUpcomingAppointments",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      dob: { type: Type.STRING, description: "YYYY-MM-DD" }
                    },
                    required: ["name", "dob"]
                  }
                },
                {
                  name: "completeCheckIn",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      appointmentId: { type: Type.STRING }
                    },
                    required: ["appointmentId"]
                  }
                }
              ]
            }
          ]
        },
      });

      this.session = await sessionPromise;
    } catch (error) {
      console.error("Failed to start Live session:", error);
      this.onStatus("Failed to connect");
    }
  }

  private async handleFunctionCall(call: any) {
    const response = await fetch(`/api/${call.name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(call.args)
    });
    return await response.json();
  }

  private async startAudioCapture() {
    if (!this.audioContext) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.isMuted) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
      }
      
      const bytes = new Uint8Array(pcmData.buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);
      
      this.session.sendRealtimeInput({
        media: { data: base64Data, mimeType: "audio/pcm;rate=16000" }
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private async playNextInQueue() {
    if (this.isPlaying || this.audioQueue.length === 0 || !this.audioContext) return;

    try {
      this.isPlaying = true;
      const pcmData = this.audioQueue.shift()!;
      const audioBuffer = this.audioContext.createBuffer(1, pcmData.length, 16000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 0x7FFF;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.onended = () => {
        this.isPlaying = false;
        this.playNextInQueue();
      };
      source.start();
    } catch (error) {
      console.error("Playback error:", error);
      this.isPlaying = false;
      this.playNextInQueue();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  stop() {
    this.session?.close();
    this.processor?.disconnect();
    this.source?.disconnect();
    this.audioContext?.close();
  }
}
