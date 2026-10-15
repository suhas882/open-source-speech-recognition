
const API_URL = "http://127.0.0.1:8000/transcribe";

let mediaRecorder = null;
let mediaStream = null;
let audioContext = null;
let chunks = [];
let recording = false;
let uploading = false;

function cleanupAudio() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }

  mediaStream = null;
  mediaRecorder = null;
  chunks = [];

  if (audioContext && audioContext.state !== "closed") {
    audioContext.close().catch(() => {});
  }

  audioContext = null;
}

async function transcribeRecording(blob) {
  uploading = true;

  await chrome.storage.local.set({
    tabCaptureError: "",
    tabCaptureStatus: "transcribing"
  });

  try {
    if (!blob || blob.size === 0) {
      throw new Error(
        "No audio was captured. Play audio in the tab while recording."
      );
    }

    const formData = new FormData();
    formData.append("file", blob, "tab-recording.webm");

    const response = await fetch(API_URL, {
      method: "POST",
      body: formData
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.detail || `Transcription failed (HTTP ${response.status}).`
      );
    }

    await chrome.storage.local.set({
      tabCaptureResult: {
        transcript: data.transcript || "",
        language: data.language || "Unknown",
        processing_time_seconds: data.processing_time_seconds,
        model: data.model || "Faster-Whisper",
        completedAt: Date.now()
      },
      tabCaptureError: "",
      tabCaptureStatus: "complete"
    });
  } catch (error) {
    await chrome.storage.local.set({
      tabCaptureError: error.message || "Transcription failed.",
      tabCaptureStatus: "error"
    });
  } finally {
    uploading = false;
    cleanupAudio();

    await chrome.storage.local.set({
      tabCaptureRecording: false,
      tabCaptureUploading: false
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "offscreen") {
    return;
  }

  (async () => {
    if (message.type === "START_RECORDING") {
      if (recording || uploading) {
        throw new Error("A recording or transcription is already in progress.");
      }

      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: message.streamId
          }
        },
        video: false
      });

      audioContext = new AudioContext();

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(mediaStream);

      // Keep tab audio audible while it is being captured.
      source.connect(audioContext.destination);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
      chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onerror = async () => {
        recording = false;
        await chrome.storage.local.set({
          tabCaptureError: "The browser recorder encountered an error.",
          tabCaptureStatus: "error",
          tabCaptureRecording: false
        });
        cleanupAudio();
      };

      mediaRecorder.onstop = async () => {
        recording = false;
        const blob = new Blob(chunks, { type: "audio/webm" });

        await chrome.storage.local.set({
          tabCaptureRecording: false,
          tabCaptureUploading: true,
          tabCaptureStatus: "transcribing"
        });

        // Close the stream only after the recorder has emitted its final data.
        await transcribeRecording(blob);
      };

      mediaRecorder.start(1000);
      recording = true;

      await chrome.storage.local.set({
        tabCaptureRecording: true,
        tabCaptureUploading: false,
        tabCaptureError: "",
        tabCaptureStatus: "recording"
      });

      sendResponse({ ok: true, recording: true });
      return;
    }

    if (message.type === "STOP_RECORDING") {
      if (!recording || !mediaRecorder) {
        throw new Error("No tab recording is currently active.");
      }

      // Let onstop process the final data and clean up safely.
      mediaRecorder.stop();
      recording = false;

      sendResponse({
        ok: true,
        message: "Recording stopped. Transcription is starting."
      });
      return;
    }

    if (message.type === "GET_STATUS") {
      sendResponse({
        ok: true,
        recording,
        uploading
      });
      return;
    }

    sendResponse({ ok: false, error: "Unknown recorder command." });
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error.message || "Audio recorder failed."
    });
  });

  return true;
});
