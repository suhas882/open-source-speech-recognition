
from faster_whisper import WhisperModel
import time
from pathlib import Path

audio_file = Path("sample.wav")

if not audio_file.exists():
    raise FileNotFoundError(
        "Place sample.wav in the project folder."
    )

print("Loading Whisper large-v3-turbo...")

model = WhisperModel(
    "large-v3-turbo",
    device="cpu",
    compute_type="int8"
)

print("Model loaded. Transcribing audio...")

start_time = time.perf_counter()

segments, info = model.transcribe(
    str(audio_file),
    beam_size=5
)

transcript = " ".join(
    segment.text.strip()
    for segment in segments
)

elapsed = time.perf_counter() - start_time

print("\n--- TRANSCRIPTION RESULTS ---")
print("Detected language:", info.language)
print("Transcript:", transcript)
print(f"Processing time: {elapsed:.2f} seconds")
