
import os
import tempfile
import time

import pandas as pd
import soundfile as sf
import streamlit as st
from jiwer import wer
from faster_whisper import WhisperModel


# --------------------------------------------------
# 1. Page configuration and session state
# --------------------------------------------------
st.set_page_config(
    page_title="Open-Source Speech Recognition",
    page_icon="🎙️",
    layout="wide"
)

if "benchmark_history" not in st.session_state:
    st.session_state.benchmark_history = []

if "last_result" not in st.session_state:
    st.session_state.last_result = None


# --------------------------------------------------
# 2. Application heading
# --------------------------------------------------
st.title("🎙️ Open-Source Speech Recognition")
st.caption(
    "Local AI transcription and performance benchmarking"
)


# --------------------------------------------------
# 3. Load models
# --------------------------------------------------
@st.cache_resource
def load_model(model_name):
    return WhisperModel(
        model_name,
        device="cpu",
        compute_type="int8",
        cpu_threads=4
    )


# --------------------------------------------------
# 4. User inputs
# --------------------------------------------------
st.sidebar.header("Settings")

model_name = st.sidebar.selectbox(
    "Choose speech recognition model",
    ["small", "large-v3-turbo"]
)

uploaded_file = st.file_uploader(
    "Upload audio",
    type=["wav", "mp3", "m4a", "flac", "ogg"]
)

reference = st.text_area(
    "Reference transcript (optional)",
    placeholder="Paste the verified correct transcript here to calculate WER.",
    height=120
)


# --------------------------------------------------
# 5. Transcription
# --------------------------------------------------
if uploaded_file is not None:
    st.audio(uploaded_file)

    if st.button("Transcribe Audio", type="primary"):
        temp_path = None

        try:
            suffix = (
                os.path.splitext(uploaded_file.name)[1]
                or ".wav"
            )

            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=suffix
            ) as temp_file:
                temp_file.write(uploaded_file.getvalue())
                temp_path = temp_file.name

            with st.spinner(
                f"Loading {model_name} and transcribing audio..."
            ):
                model = load_model(model_name)

                start = time.perf_counter()

                segments, info = model.transcribe(
                    temp_path,
                    beam_size=1,
                    vad_filter=True
                )

                # Consume the generator to complete inference.
                transcript = " ".join(
                    segment.text.strip()
                    for segment in segments
                )

                elapsed = time.perf_counter() - start

            # Obtain audio duration.
            # soundfile does not support every audio format.
            try:
                audio_duration = sf.info(temp_path).duration
            except (RuntimeError, ValueError, OSError):
                audio_duration = None

            if audio_duration is None:
                st.warning(
                    "Transcription succeeded, but audio duration "
                    "could not be read by soundfile. Install FFmpeg "
                    "or use a supported WAV file to measure duration."
                )
                rtf = None
            else:
                rtf = (
                    elapsed / audio_duration
                    if audio_duration > 0
                    else None
                )

            # Calculate WER only with a supplied reference.
            error_rate = None

            if reference.strip():
                error_rate = wer(
                    reference.strip(),
                    transcript
                )

            # Keep the full transcript and its preview separately.
            result = {
                "Model": model_name,
                "Transcript": transcript,
                "Transcript preview": (
                    transcript[:100] + "..."
                    if len(transcript) > 100
                    else transcript
                ),
                "Language": info.language,
                "Processing time (sec)": round(elapsed, 2),
                "Audio duration (sec)": (
                    round(audio_duration, 2)
                    if audio_duration is not None
                    else None
                ),
                "RTF": round(rtf, 3) if rtf is not None else None,
                "WER (%)": (
                    round(error_rate * 100, 2)
                    if error_rate is not None
                    else None
                )
            }

            st.session_state.last_result = result

            # Record this actual run.
            st.session_state.benchmark_history.append(result.copy())

        except Exception as error:
            st.error(f"Transcription failed: {error}")

        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)


# --------------------------------------------------
# 6. Display the latest transcription
# --------------------------------------------------
if st.session_state.last_result is not None:
    result = st.session_state.last_result

    st.success("Transcription completed!")

    st.subheader("Recognized text")

    st.text_area(
        "Transcript",
        value=result["Transcript"],
        height=220,
        key="latest_transcript"
    )

    col1, col2, col3, col4 = st.columns(4)

    col1.metric("Model", result["Model"])
    col2.metric(
        "Processing time",
        f'{result["Processing time (sec)"]:.2f} sec'
    )

    duration = result["Audio duration (sec)"]
    col3.metric(
        "Audio duration",
        f"{duration:.2f} sec" if duration is not None else "N/A"
    )

    rtf = result["RTF"]
    col4.metric(
        "RTF",
        f"{rtf:.3f}" if rtf is not None else "N/A"
    )

    if result["WER (%)"] is not None:
        col5, col6 = st.columns(2)

        col5.metric(
            "Word Error Rate",
            f'{result["WER (%)"]:.2f}%'
        )

        col6.metric(
            "Derived 1 - WER score",
            f'{100 - result["WER (%)"]:.2f}%'
        )
    else:
        st.info(
            "Enter a verified reference transcript and transcribe again "
            "to calculate WER."
        )

    st.download_button(
        "Download Transcript",
        data=result["Transcript"],
        file_name=f'{result["Model"]}_transcript.txt',
        mime="text/plain",
        key="download_latest"
    )


# --------------------------------------------------
# 7. Dynamic benchmark history
# --------------------------------------------------
st.divider()
st.subheader("📊 Live Benchmark History")

history = st.session_state.benchmark_history

if history:
    df = pd.DataFrame(history)

    # Use shortened previews in the table.
    display_df = df.drop(
        columns=["Transcript"],
        errors="ignore"
    )

    st.dataframe(
        display_df,
        hide_index=True,
        use_container_width=True
    )

    # Processing time chart.
    st.subheader("Processing Time Comparison")

    time_df = df.dropna(subset=["Processing time (sec)"])

    if not time_df.empty:
        chart_data = time_df[
            ["Model", "Processing time (sec)"]
        ].copy()

        chart_data["Run"] = [
            f"{model} #{i + 1}"
            for i, model in enumerate(chart_data["Model"])
        ]

        st.bar_chart(
            chart_data.set_index("Run")[["Processing time (sec)"]]
        )

    # WER chart.
    wer_df = df.dropna(subset=["WER (%)"])

    if not wer_df.empty:
        st.subheader("Word Error Rate Comparison")

        chart_data = wer_df[
            ["Model", "WER (%)"]
        ].copy()

        chart_data["Run"] = [
            f"{model} #{i + 1}"
            for i, model in enumerate(chart_data["Model"])
        ]

        st.bar_chart(
            chart_data.set_index("Run")[["WER (%)"]]
        )

        best_index = wer_df["WER (%)"].idxmin()
        best_run = wer_df.loc[best_index]

        st.info(
            f'Lowest observed WER: {best_run["WER (%)"]:.2f}% '
            f'({best_run["Model"]}). This refers only to the '
            "recorded runs and does not establish general superiority."
        )
    else:
        st.info(
            "No WER results yet. Enter the same verified reference "
            "transcript for each model and transcribe again."
        )

    # Export full benchmark history, including full transcripts.
    csv_data = df.to_csv(index=False)

    st.download_button(
        "Download Benchmark CSV",
        data=csv_data,
        file_name="speech_recognition_benchmarks.csv",
        mime="text/csv",
        key="download_benchmarks"
    )

    if st.button("Clear Benchmark History"):
        st.session_state.benchmark_history = []
        st.session_state.last_result = None
        st.rerun()

else:
    st.info(
        "No benchmark runs yet. Upload audio and click "
        "'Transcribe Audio' to collect your first result."
    )
