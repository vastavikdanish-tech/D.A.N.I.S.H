import asyncio
import json
import logging
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from edge_tts import Communicate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-service")

app = FastAPI(title="D.A.N.I.S.H Voice Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VOICES = {
    "en-US-BrianNeural": "en-US-BrianNeural",
    "en-US-GuyNeural": "en-US-GuyNeural",
    "en-US-AriaNeural": "en-US-AriaNeural",
    "en-IN-PrabhatNeural": "en-IN-PrabhatNeural",
}

class TTSRequest(BaseModel):
    text: str
    voice: str = "en-US-AriaNeural"
    rate: str = "+0%"
    pitch: str = "+0Hz"

class TTSStreamRequest(BaseModel):
    text: str
    voice: str = "en-US-AriaNeural"
    rate: str = "+0%"
    pitch: str = "+0Hz"


@app.get("/health")
async def health():
    return {"status": "ok", "service": "danish-voice-service"}


@app.get("/voices")
async def list_voices():
    return {"voices": list(VOICES.keys())}


@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    if req.voice not in VOICES:
        raise HTTPException(status_code=400, detail=f"Unsupported voice. Choose from: {', '.join(VOICES.keys())}")

    try:
        communicate = Communicate(req.text, voice=req.voice, rate=req.rate, pitch=req.pitch)
        audio_chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])

        audio_data = b"".join(audio_chunks)

        return StreamingResponse(
            iter([audio_data]),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"inline; filename=\"tts-{uuid4().hex[:8]}.mp3\"",
                "Content-Length": str(len(audio_data)),
            },
        )
    except Exception as e:
        logger.error(f"TTS generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@app.post("/tts/stream")
async def text_to_speech_stream(req: TTSStreamRequest):
    if req.voice not in VOICES:
        raise HTTPException(status_code=400, detail=f"Unsupported voice. Choose from: {', '.join(VOICES.keys())}")

    async def generate():
        try:
            communicate = Communicate(req.text, voice=req.voice, rate=req.rate, pitch=req.pitch)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
                elif chunk["type"] == "WordBoundary":
                    yield json.dumps({"type": "boundary", "offset": chunk.get("offset", 0), "duration": chunk.get("duration", 0)}).encode() + b"\n"
        except Exception as e:
            logger.error(f"Stream error: {e}")

    return StreamingResponse(
        generate(),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Content-Type-Options": "nosniff",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
