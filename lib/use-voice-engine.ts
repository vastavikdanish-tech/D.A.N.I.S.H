import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceEngine, type VoiceState } from "@/lib/voice-engine";

export function useVoiceEngine() {
  const engineRef = useRef<VoiceEngine | null>(null);
  const [state, setState] = useState<VoiceState>("off");
  const [voiceServiceOnline, setVoiceServiceOnline] = useState(false);
  const stateRef = useRef<VoiceState>("off");
  const onTranscriptRef = useRef<(text: string) => void>(() => {});
  const wakeWordSetRef = useRef(false);

  useEffect(() => {
    const engine = new VoiceEngine();
    engineRef.current = engine;
    stateRef.current = "off";

    const unsub = engine.state.onChange((s) => {
      stateRef.current = s;
      setState(s);
    });

    engine.onVoiceServiceOnlineChange(setVoiceServiceOnline);
    setVoiceServiceOnline(engine.voiceServiceOnline);
    engine.setupBargeIn();

    return () => {
      unsub();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    await engineRef.current?.speak(text);
  }, []);

  const speakStream = useCallback(async (text: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      await engine.speakStream(text);
    } catch {
      engine.speakBrowser(text);
    }
  }, []);

  const speakSentences = useCallback(async (fullText: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.state.transition("speaking");
    const sentences = splitSentences(fullText);
    for (const s of sentences) {
      if (stateRef.current !== "speaking") break;
      await engine.speakStream(s).catch(() => engine.speakBrowser(s));
    }
    if (stateRef.current === "speaking") {
      if (wakeWordSetRef.current) {
        engine.startWakeWordDetection();
      } else {
        engine.state.transition("listening");
      }
    }
  }, []);

  const interrupt = useCallback(() => {
    engineRef.current?.interrupt();
  }, []);

  const startListening = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.state.transition("listening");
    engine.stt.start(
      (hyp) => {
        if (hyp.isFinal) {
          engine.state.transition("thinking");
          engine.stt.stop();
          setState("thinking");
          onTranscriptRef.current?.(hyp.text);
          return hyp.text;
        }
        return null;
      },
      () => {
        if (stateRef.current === "listening") {
          engine.state.transition("off");
        }
      }
    );
  }, []);

  const stopListening = useCallback(() => {
    engineRef.current?.stt.stop();
    if (stateRef.current === "listening" || stateRef.current === "thinking") {
      engineRef.current?.state.transition("off");
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (stateRef.current === "listening" || stateRef.current === "thinking") {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  return {
    state,
    voiceServiceOnline,
    speak,
    speakStream,
    speakSentences,
    interrupt,
    startListening,
    stopListening,
    toggleListening,
    setOnTranscript: (cb: (text: string) => void) => { onTranscriptRef.current = cb; },
    setWakeWord: (wakeWord: string) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.stopWakeWordDetection();
      if (!wakeWord) { wakeWordSetRef.current = false; return; }
      wakeWordSetRef.current = true;
      engine.setWakeWord(wakeWord, (text) => onTranscriptRef.current(text));
      engine.startWakeWordDetection();
    },
    engine: engineRef.current,
  };
}

function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    current += text[i];
    if (".!?".includes(text[i]) && (i === text.length - 1 || text[i + 1] === " ")) {
      sentences.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) sentences.push(current.trim());
  return sentences.filter(Boolean);
}
