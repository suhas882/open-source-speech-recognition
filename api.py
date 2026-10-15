
import os
import tempfile
import time
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, File, HTTPException, UploadFile
from faster_whisper import WhisperModel

app = FastAPI(title="Open-Source Speech Recognition API")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
ALLOWED_EXTENSIONS = {
    ".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm"
}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB

# Load the model once, when the first transcription is requested.
_model = None


def get_model():
    global _model

    if _model is None:
        _model = WhisperModel(
            "large-v3-turbo",
            device="cpu",
            compute_type="int8",
            cpu_threads=4,
        )

    return _model


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "Open-Source Speech Recognition",
    }


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported audio format.",
        )

    temp_path = None

    try:
        # Read in chunks and enforce a maximum upload size.
        total_size = 0

        with tempfile.NamedTemporaryFile(
            suffix=suffix, delete=False
        ) as temp_file:
            temp_path = temp_file.name

            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Audio file exceeds the 100 MB limit.",
                    )

                temp_file.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        model = get_model()
        start_time = time.perf_counter()

        segments, info = model.transcribe(
            temp_path,
            beam_size=5,
            vad_filter=True,
        )

        # Segments are generated lazily; consume them to finish inference.
        transcript = " ".join(
            segment.text.strip() for segment in segments
        ).strip()

        processing_time = time.perf_counter() - start_time

        return {
            "transcript": transcript,
            "language": info.language,
            "language_probability": round(
                info.language_probability, 4
            ),
            "processing_time_seconds": round(processing_time, 2),
            "model": "large-v3-turbo",
            "file_size_bytes": total_size,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {type(exc).__name__}",
        ) from exc
    finally:
        await file.close()

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
