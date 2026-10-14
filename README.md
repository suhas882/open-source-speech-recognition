# Open-Source Speech Recognition & Benchmarking

A locally running AI speech-to-text application built with **Faster-Whisper**, **Streamlit**, and open-source Whisper models. The project explores how speech recognition can be performed without relying on paid speech-to-text APIs and compares transcription speed and accuracy on consumer hardware.

## Overview

Speech recognition APIs can introduce recurring costs based on usage. This project explores an alternative by running open-source speech recognition models locally, allowing users to transcribe audio files without per-request API charges.

The application also provides benchmarking tools to evaluate processing time, Word Error Rate (WER), and Real-Time Factor (RTF).

## Features

- **Local speech transcription** using Faster-Whisper.
- **Multiple model options:** Whisper `small` and `large-v3-turbo`.
- **Audio file upload** supporting WAV, MP3, M4A, FLAC, and OGG.
- **Word Error Rate (WER)** calculation against a reference transcript.
- **Performance metrics:** processing time, audio duration, and RTF.
- **Interactive benchmark dashboard** with comparison charts.
- **Transcript download** as a text file.
- **Benchmark export** to CSV.

## Technology Stack

| Technology | Purpose |
|---|---|
| Python | Application development |
| Faster-Whisper | Local speech recognition |
| Whisper models | Audio transcription |
| Streamlit | Web interface |
| JiWER | Word Error Rate evaluation |
| Pandas | Benchmark data processing |
| SoundFile | Audio metadata and duration |

## Models Evaluated

| Model | Description |
|---|---|
| Whisper `small` | Smaller model evaluated for faster inference |
| Whisper `large-v3-turbo` | Larger, optimized model evaluated for transcription accuracy |

Both models are run locally using CPU inference with INT8 computation.

## Preliminary Benchmark Results

The following results were observed on a 60.01-second English audio recording.

| Metric | Whisper small | Whisper large-v3-turbo |
|---|---:|---:|
| Processing time | 20.89 seconds | 72.29 seconds |
| Audio duration | 60.01 seconds | 60.01 seconds |
| Word Error Rate | 6.58% | 0.00% |
| Derived 1 − WER score | 93.42% | 100.00% |
| Real-Time Factor | 0.348 | 1.205 |

**Test environment:** Windows, Python 3.11, approximately 16 GB RAM, Intel Iris Xe integrated graphics, CPU inference.

### Preliminary observations

- Whisper `small` processed the recording approximately 3.46 times faster than `large-v3-turbo` in the reported runs.
- Whisper `large-v3-turbo` achieved a lower observed WER on this recording.
- Whisper `small` processed the audio faster than its playback duration, while `large-v3-turbo` took longer than playback.

These are preliminary results from a single recording. They do not establish general model superiority. Additional recordings, repeated runs, and consistent reference transcripts are needed for a reliable evaluation.

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/open-source-speech-recognition.git
cd open-source-speech-recognition
```

Replace `YOUR_USERNAME` with your GitHub username.

### 2. Create a virtual environment

Windows PowerShell:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

The first model execution downloads the selected model files. A working internet connection is required for the initial download.

### 4. Run the application

```powershell
streamlit run app.py
```

Open the local URL displayed in your terminal, typically `http://localhost:8501`.

## How to Use

1. Launch the Streamlit application.
2. Select `small` or `large-v3-turbo` from the sidebar.
3. Upload an audio file.
4. Optionally paste a verified reference transcript.
5. Click **Transcribe Audio**.
6. Review the recognized text and performance metrics.
7. Compare recorded runs in the benchmark history.
8. Download the transcript or export benchmark results to CSV.

For a meaningful WER comparison, use the same verified reference transcript for every model tested on the same audio.

## Evaluation Metrics

**Word Error Rate (WER)** measures the number of word substitutions, deletions, and insertions relative to the reference transcript.

\[
WER = \frac{S + D + I}{N}
\]

Where:
- \(S\) = substitutions
- \(D\) = deletions
- \(I\) = insertions
- \(N\) = number of words in the reference transcript

Lower WER is better. WER can exceed 100% when the number of word errors is greater than the number of reference words.

**Real-Time Factor (RTF)** measures processing time relative to audio duration.

\[
RTF = \frac{\text{Processing Time}}{\text{Audio Duration}}
\]

An RTF below 1 means processing completed faster than playback duration. An RTF above 1 means processing took longer than playback duration.

The displayed `1 − WER` value is a derived score, not a guarantee of general transcription accuracy.

## Limitations

- CPU inference speed depends on hardware, audio length, and decoding settings.
- Model downloads require internet access initially.
- Benchmark history is currently stored in the Streamlit session and may not survive an application restart.
- WER depends on the quality and consistency of the reference transcript.
- The current evaluation uses a limited test sample and is not a comprehensive benchmark.
- Local execution avoids per-request API charges but still uses system resources and storage.

## Future Improvements

- Persist benchmark history using SQLite.
- Evaluate multiple recordings and languages.
- Add repeated-run averages and more detailed comparisons.
- Improve audio-format handling and error reporting.
- Generate downloadable evaluation reports.
- Compare local inference with paid API services using verified pricing and equivalent test conditions.

## License

This project is intended for educational and experimental purposes. Add a project license, such as MIT, if you want to explicitly permit reuse of your code. Check the licenses of the underlying models and dependencies separately.

## Author

Developed as an open-source speech recognition and model benchmarking project using Python and locally executed AI models.
