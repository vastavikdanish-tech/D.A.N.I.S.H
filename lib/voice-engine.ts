// ---------------------------------------------------------------------------
// D.A.N.I.S.H VoiceEngine v2
// ---------------------------------------------------------------------------
// Architecture:
//   AudioController    – queues & plays audio chunks, stop/fade/clear/resume
//   SpeechDetector     – Web Audio AnalyserNode for barge-in
//   VoiceStateMachine  – OFF | LISTENING | THINKING | SPEAKING
//   TTSProvider        – edge-tts backend (or fallback browser synth)
//   STTProvider        – abstraction for speech-to-text engines
//   VoiceEngine        – single orchestration entrypoint
// ---------------------------------------------------------------------------

// ---------- Types ----------

declare const SpeechRecognition: {
  new(): SpeechRecognition;
  prototype: SpeechRecognition;
};

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export type VoiceState = "off" | "listening" | "thinking" | "speaking";

export type TTSVoice = "en-US-BrianNeural" | "en-US-GuyNeural" | "en-US-AriaNeural" | "en-IN-PrabhatNeural";

export interface TTSOptions {
  voice?: TTSVoice;
  rate?: string;
  pitch?: string;
}

export type STTEngine = "browser" | "whisper";

export type STTHypothesis = { text: string; isFinal: boolean };

export interface STTProvider {
  start: (onResult: (h: STTHypothesis) => void, onEnd?: () => void) => void;
  stop: () => void;
  abort: () => void;
  readonly isRunning: boolean;
}

export type VoiceStateListener = (state: VoiceState) => void;

// ---------- AudioController ----------

export interface AudioQueueItem {
  id: string;
  blob: Blob;
}

export class AudioController {
  private queue: AudioQueueItem[] = [];
  private audioEl: HTMLAudioElement | null = null;
  private _isPlaying = false;
  private _isPaused = false;
  private _volume = 1;
  private onEnded: (() => void) | null = null;
  private currentId: string | null = null;

  get isPlaying() {
    return this._isPlaying;
  }
  get volume() {
    return this._volume;
  }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.audioEl) this.audioEl.volume = this._volume;
  }

  enqueue(id: string, blob: Blob) {
    this.queue.push({ id, blob });
    if (!this._isPlaying) this.playNext();
  }

  enqueueFront(id: string, blob: Blob) {
    this.queue.unshift({ id, blob });
    if (!this._isPlaying) this.playNext();
  }

  clear() {
    this.queue = [];
    this.stopCurrent();
  }

  stopCurrent() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = "";
      this.audioEl = null;
    }
    this._isPlaying = false;
    this._isPaused = false;
    this.currentId = null;
  }

  pause() {
    if (this.audioEl && !this._isPaused) {
      this.audioEl.pause();
      this._isPaused = true;
    }
  }

  resume() {
    if (this.audioEl && this._isPaused) {
      this.audioEl.play().catch(() => {});
      this._isPaused = false;
    } else if (!this._isPlaying && this.queue.length > 0) {
      this.playNext();
    }
  }

  fadeOut(durationMs = 300) {
    if (!this.audioEl) return;
    const startVol = this._volume;
    const steps = 10;
    const stepMs = durationMs / steps;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      const t = i / steps;
      if (this.audioEl) this.audioEl.volume = startVol * (1 - t);
      if (i >= steps) {
        clearInterval(iv);
        if (this.audioEl) this.stopCurrent();
        this.audioEl = null;
        this._volume = startVol;
      }
    }, stepMs);
  }

  onAllEnded(cb: () => void) {
    this.onEnded = cb;
  }

  private playNext() {
    if (this.queue.length === 0) {
      this._isPlaying = false;
      this.currentId = null;
      this.onEnded?.();
      return;
    }

    const item = this.queue.shift()!;
    this.currentId = item.id;
    this._isPlaying = true;
    this._isPaused = false;

    const url = URL.createObjectURL(item.blob);
    const audio = new Audio(url);
    this.audioEl = audio;
    audio.volume = this._volume;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      this.audioEl = null;
      this.currentId = null;
      this._isPlaying = false;
      this.playNext();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      this.audioEl = null;
      this.currentId = null;
      this._isPlaying = false;
      this.playNext();
    };

    audio.play().catch(() => {
      URL.revokeObjectURL(url);
      this.audioEl = null;
      this.currentId = null;
      this._isPlaying = false;
      this.playNext();
    });
  }
}

// ---------- SpeechDetector (Web Audio AnalyserNode) ----------

export class SpeechDetector {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private onSpeechStart: (() => void) | null = null;
  private onSpeechEnd: (() => void) | null = null;
  private threshold = 0.02;
  private silenceTimeoutMs = 400;
  private isSpeaking = false;
  private silenceStart = 0;
  private _running = false;

  get running() {
    return this._running;
  }

  setThreshold(t: number) {
    this.threshold = t;
  }

  onUserSpeechStart(cb: () => void) {
    this.onSpeechStart = cb;
  }

  onUserSpeechEnd(cb: () => void) {
    this.onSpeechEnd = cb;
  }

  async start() {
    if (this._running) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioCtx = new AudioContext();
      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.source.connect(this.analyser);
      this._running = true;
      this.poll();
    } catch {
      this._running = false;
    }
  }

  stop() {
    this._running = false;
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close();
    this.audioCtx = null;
    this.source = null;
    this.analyser = null;
    this.stream = null;
    this.isSpeaking = false;
  }

  private poll() {
    if (!this._running || !this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);

    let max = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i] - 128) / 128;
      if (v > max) max = v;
    }

    if (max > this.threshold) {
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.onSpeechStart?.();
      }
      this.silenceStart = 0;
    } else {
      if (this.isSpeaking) {
        const now = performance.now();
        if (this.silenceStart === 0) this.silenceStart = now;
        if (now - this.silenceStart > this.silenceTimeoutMs) {
          this.isSpeaking = false;
          this.silenceStart = 0;
          this.onSpeechEnd?.();
        }
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.poll());
  }
}

// ---------- VoiceStateMachine ----------

export class VoiceStateMachine {
  private _state: VoiceState = "off";
  private listeners: Set<VoiceStateListener> = new Set();

  get state() {
    return this._state;
  }

  onChange(cb: VoiceStateListener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  transition(newState: VoiceState) {
    if (newState === this._state) return;
    this._state = newState;
    this.listeners.forEach((cb) => cb(newState));
  }

  reset() {
    this.transition("off");
  }
}

// ---------- TTSProvider ----------

const DEFAULT_VOICE_SERVICE_URL = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_VOICE_SERVICE_URL) || "http://localhost:8765";

export class TTSProvider {
  private voiceServiceUrl: string;
  private cache = new Map<string, Blob>();
  private cacheSize = 0;
  private readonly MAX_CACHE_SIZE = 50;

  constructor(serviceUrl = DEFAULT_VOICE_SERVICE_URL) {
    this.voiceServiceUrl = serviceUrl;
  }

  setServiceUrl(url: string) {
    this.voiceServiceUrl = url;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.voiceServiceUrl}/health`, { signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  clearCache() {
    this.cache.clear();
    this.cacheSize = 0;
  }

  private cacheKey(text: string, options: TTSOptions): string {
    return `${options.voice ?? "default"}:${text}`;
  }

  private cacheSet(key: string, blob: Blob) {
    if (this.cacheSize >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) { this.cache.delete(firstKey); this.cacheSize--; }
    }
    this.cache.set(key, blob);
    this.cacheSize++;
  }

  async synthesize(text: string, options: TTSOptions = {}): Promise<Blob> {
    const key = this.cacheKey(text, options);
    const cached = this.cache.get(key);
    if (cached) return cached;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${this.voiceServiceUrl}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: options.voice ?? "en-US-AriaNeural",
          rate: options.rate ?? "+0%",
          pitch: options.pitch ?? "+0Hz",
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`TTS request failed: ${res.status}`);
      const blob = await res.blob();
      this.cacheSet(key, blob);
      return blob;
    } catch {
      return this.fallbackSynthesize(text);
    } finally {
      clearTimeout(timeout);
    }
  }

  private fallbackSynthesize(text: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        return reject(new Error("No TTS available"));
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = /[\u0900-\u097F]/.test(text) ? "hi-IN" : "en-US";
      u.onend = () => resolve(new Blob([text], { type: "audio/mpeg" }));
      u.onerror = () => reject(new Error("Fallback TTS failed"));
      window.speechSynthesis.speak(u);
    });
  }

  async *stream(text: string, options: TTSOptions = {}): AsyncGenerator<Blob> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(`${this.voiceServiceUrl}/tts/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: options.voice ?? "en-US-AriaNeural",
          rate: options.rate ?? "+0%",
          pitch: options.pitch ?? "+0Hz",
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`TTS stream request failed: ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No readable stream");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        yield new Blob([buffer], { type: "audio/mpeg" });
        buffer = "";
      }
    } catch {
      const blob = await this.fallbackSynthesize(text);
      yield blob;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ---------- STTProvider: Android Bridge ----------

declare global {
  interface Window {
    AndroidBridge?: {
      isOnline: () => boolean;
      getAppVersion: () => string;
      getPlatform: () => string;
      hasMicPermission: () => boolean;
      hasNotificationPermission: () => boolean;
      startVoiceInput: (callbackId: string) => void;
      stopVoiceInput: () => void;
      speak: (text: string, callbackId: string) => void;
      stopSpeaking: () => void;
    };
  }
}

export class AndroidSTTProvider implements STTProvider {
  private _isRunning = false;
  private bridge: NonNullable<Window["AndroidBridge"]>;
  private onResultCb: ((h: STTHypothesis) => void) | null = null;
  private onEndCb: (() => void) | null = null;

  constructor() {
    this.bridge = window.AndroidBridge!;
  }

  get isRunning() {
    return this._isRunning;
  }

  start(onResult: (h: STTHypothesis) => void, onEnd?: () => void) {
    this.stop();
    this.onResultCb = onResult;
    this.onEndCb = onEnd ?? null;
    this._isRunning = true;

    try {
      this.bridge.startVoiceInput("danish_stt_" + Date.now());
    } catch {
      this._isRunning = false;
    }
  }

  setTranscript(text: string) {
    if (!this._isRunning) return;
    this.onResultCb?.({ text, isFinal: true });
    this._isRunning = false;
    this.onEndCb?.();
  }

  stop() {
    this._isRunning = false;
    try { this.bridge.stopVoiceInput(); } catch { /* ignore */ }
  }

  abort() {
    this._isRunning = false;
    try { this.bridge.stopVoiceInput(); } catch { /* ignore */ }
  }
}

// ---------- STTProvider: Browser ----------

export class BrowserSTTProvider implements STTProvider {
  private recognition: SpeechRecognition | null = null;
  private _isRunning = false;
  private onResultCb: ((h: STTHypothesis) => void) | null = null;
  private onEndCb: (() => void) | null = null;

  get isRunning() {
    return this._isRunning;
  }

  start(onResult: (h: STTHypothesis) => void, onEnd?: () => void) {
    this.stop();
    this.onResultCb = onResult;
    this.onEndCb = onEnd ?? null;

    const SpeechRecognitionCtor: typeof SpeechRecognition | undefined = (window as unknown as Record<string, typeof SpeechRecognition | undefined>).SpeechRecognition || (window as unknown as Record<string, typeof SpeechRecognition | undefined>).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition: SpeechRecognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        this.onResultCb?.({ text: event.results[i][0].transcript, isFinal: event.results[i].isFinal });
      }
    };

    recognition.onend = () => {
      this._isRunning = false;
      this.onEndCb?.();
    };

    recognition.onerror = () => {
      this._isRunning = false;
    };

    this.recognition = recognition;
    this._isRunning = true;
    recognition.start();
  }

  stop() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ignore */ }
      this.recognition = null;
    }
    this._isRunning = false;
  }

  abort() {
    if (this.recognition) {
      try { this.recognition.abort(); } catch { /* ignore */ }
      this.recognition = null;
    }
    this._isRunning = false;
  }
}

// ---------- VoiceEngine ----------

export class VoiceEngine {
  readonly audio: AudioController;
  readonly detector: SpeechDetector;
  readonly state: VoiceStateMachine;
  readonly tts: TTSProvider;
  readonly stt: STTProvider;

  private currentSentenceController: AbortController | null = null;
  private _voiceServiceOnline = false;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private onOnlineChangeCb: ((online: boolean) => void) | null = null;
  private _wakeWord: string = "";
  private _wakeCallback: ((text: string) => void) | null = null;
  private _wakeActive = false;
  private _isAndroid = false;

  get voiceServiceOnline() {
    return this._voiceServiceOnline;
  }

  get isAndroid() {
    return this._isAndroid;
  }

  constructor() {
    this._isAndroid = typeof window !== "undefined" && !!window.AndroidBridge;
    this.audio = new AudioController();
    this.detector = new SpeechDetector();
    this.state = new VoiceStateMachine();
    this.tts = new TTSProvider();
    this.stt = this._isAndroid ? new AndroidSTTProvider() : new BrowserSTTProvider();
    if (this._isAndroid) {
      this.audio.onAllEnded(() => {
        if (this.state.state === "speaking") this.state.transition("listening");
      });
    }
    this.startHealthChecks();
  }

  onVoiceServiceOnlineChange(cb: (online: boolean) => void) {
    this.onOnlineChangeCb = cb;
  }

  private async startHealthChecks() {
    const check = async () => {
      const online = await this.tts.healthCheck();
      if (online !== this._voiceServiceOnline) {
        this._voiceServiceOnline = online;
        this.onOnlineChangeCb?.(online);
      }
    };
    await check();
    this.healthCheckInterval = setInterval(check, 15000);
  }

  private stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  setVoiceServiceUrl(url: string) {
    this.tts.setServiceUrl(url);
  }

  async speak(text: string, options: TTSOptions = {}) {
    this.state.transition("speaking");
    try {
      const blob = await this.tts.synthesize(text, options);
      this.audio.enqueue(crypto.randomUUID(), blob);
    } catch {
      this.speakBrowser(text);
    }
  }

  async speakStream(text: string, options: TTSOptions = {}) {
    this.state.transition("speaking");
    this.currentSentenceController?.abort();
    this.currentSentenceController = new AbortController();
    const signal = this.currentSentenceController.signal;

    try {
      const res = await fetch(`${this.tts["voiceServiceUrl"]}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: options.voice ?? "en-US-AriaNeural",
          rate: options.rate ?? "+0%",
          pitch: options.pitch ?? "+0Hz",
        }),
        signal,
      });
      if (!res.ok) throw new Error("TTS failed");
      if (signal.aborted) return;
      const blob = await res.blob();
      this.audio.enqueue(crypto.randomUUID(), blob);
    } catch {
      this.speakBrowser(text);
    }
  }

  interrupt() {
    this.currentSentenceController?.abort();
    this.audio.clear();
    this.state.transition("listening");
    this.stt.start(
      (hyp) => {
        if (hyp.isFinal) {
          this.state.transition("thinking");
          this.stt.stop();
          return hyp.text;
        }
        return null;
      }
    );
  }

  speakBrowser(text: string) {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      if (this.state.state === "speaking") this.state.transition("listening");
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async startListening() {
    this.stopWakeWordDetection();
    this.state.transition("listening");
    this.stt.start(
      (hyp) => {
        if (hyp.isFinal) {
          this.state.transition("thinking");
          this.stt.stop();
          return hyp.text;
        }
        return null;
      },
      () => {
        if (this.state.state === "listening") this.state.transition("off");
      }
    );
  }

  stopListening() {
    this.stt.stop();
    if (this.state.state === "listening") this.state.transition("off");
  }

  setWakeWord(wakeWord: string, onWake: (text: string) => void) {
    this._wakeWord = wakeWord.toLowerCase().trim();
    this._wakeCallback = onWake;
  }

  private onWakeEnd = () => {
    if (this._wakeActive) {
      this.startWakeWordDetection();
    }
  };

  startWakeWordDetection() {
    if (this._wakeActive || !this._wakeWord) return;
    this._wakeActive = true;
    const wakeLower = this._wakeWord;
    this.stt.start(
      (hyp) => {
        if (hyp.isFinal) {
          const text = hyp.text.toLowerCase().trim();
          if (text.startsWith(wakeLower)) {
            const remainder = hyp.text.trim().slice(wakeLower.length).trim();
            this._wakeActive = false;
            this.stt.stop();
            this.state.transition("thinking");
            this._wakeCallback?.(remainder || hyp.text.trim());
          }
        }
      },
      this.onWakeEnd
    );
  }

  stopWakeWordDetection() {
    this._wakeActive = false;
    this.stt.stop();
  }

  async setupBargeIn() {
    await this.detector.start();
    this.detector.onUserSpeechStart(() => {
      if (this.state.state === "speaking") {
        this.interrupt();
      }
    });
  }

  destroy() {
    this.stopHealthChecks();
    this.stopWakeWordDetection();
    this.audio.clear();
    this.audio.stopCurrent();
    this.detector.stop();
    this.stt.abort();
    this.state.reset();
  }
}
