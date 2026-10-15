
const API_BASE = "http://127.0.0.1:8000";
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["wav", "mp3", "m4a", "flac", "ogg"];

const statusDot = document.getElementById("statusDot");
const audioFile = document.getElementById("audioFile");
const dropZone = document.getElementById("dropZone");
const uploadTitle = document.getElementById("uploadTitle");
const uploadSubtitle = document.getElementById("uploadSubtitle");
const selectedFile = document.getElementById("selectedFile");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeFile = document.getElementById("removeFile");
const transcribeBtn = document.getElementById("transcribeBtn");
const progressArea = document.getElementById("progressArea");
const progressMessage = document.getElementById("progressMessage");
const statusMessage = document.getElementById("statusMessage");
const resultSection = document.getElementById("resultSection");
const resultMeta = document.getElementById("resultMeta");
const transcript = document.getElementById("transcript");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");

const startTabBtn = document.getElementById("startTabBtn");
const stopTabBtn = document.getElementById("stopTabBtn");
const tabStatus = document.getElementById("tabStatus");

let selectedAudio = null;
let currentTranscript = "";
let currentFilename = "transcript.txt";
let tabActionInProgress = false;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function setApiStatus(online) {
  statusDot.classList.toggle("online", online);
  statusDot.classList.toggle("offline", !online);
  statusDot.title = online ? "Local API connected" : "Local API offline";
}

async function checkApi() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error("API is unavailable.");

    setApiStatus(true);
    statusMessage.textContent = "Local transcription service is ready.";
    return true;
  } catch {
    setApiStatus(false);
    statusMessage.textContent =
      "Start your local Python API to begin transcribing.";
    return false;
  }
}

function setSelectedFile(file) {
  if (!file) return;

  const extension = file.name.split(".").pop().toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    statusMessage.textContent =
      "Unsupported file. Choose WAV, MP3, M4A, FLAC or OGG.";
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    statusMessage.textContent = "File exceeds the 100 MB limit.";
    return;
  }

  selectedAudio = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  selectedFile.hidden = false;
  uploadTitle.textContent = "Audio file selected";
  uploadSubtitle.textContent = "Choose another file to replace it";
  transcribeBtn.disabled = false;
  statusMessage.textContent = "Ready to transcribe.";
}

audioFile.addEventListener("change", () => {
  setSelectedFile(audioFile.files[0]);
});

removeFile.addEventListener("click", () => {
  selectedAudio = null;
  audioFile.value = "";
  selectedFile.hidden = true;
  uploadTitle.textContent = "Choose an audio file";
  uploadSubtitle.textContent = "Click here to browse your files";
  transcribeBtn.disabled = true;
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag-over");
  setSelectedFile(event.dataTransfer.files[0]);
});

function showTranscript(text, meta, filename = "transcript.txt") {
  currentTranscript = text || "";
  currentFilename = filename;
  transcript.value = currentTranscript;
  resultMeta.textContent = meta;
  resultSection.hidden = false;
}

transcribeBtn.addEventListener("click", async () => {
  if (!selectedAudio) return;

  transcribeBtn.disabled = true;
  progressArea.hidden = false;
  progressMessage.textContent = "Uploading and transcribing...";
  statusMessage.textContent = "Transcription in progress...";

  const formData = new FormData();
  formData.append("file", selectedAudio);

  try {
    const response = await fetch(`${API_BASE}/transcribe`, {
      method: "POST",
      body: formData
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || "Transcription failed.");
    }

    const seconds = Number(data.processing_time_seconds || 0).toFixed(2);

    showTranscript(
      data.transcript,
      `Language: ${data.language || "Unknown"} · Model: ${data.model || "Faster-Whisper"} · ${seconds}s`,
      selectedAudio.name.replace(/\.[^.]+$/, "") + "-transcript.txt"
    );

    statusMessage.textContent = "Transcription completed successfully.";
  } catch (error) {
    statusMessage.textContent = error.message || "Transcription failed.";
  } finally {
    progressArea.hidden = true;
    transcribeBtn.disabled = !selectedAudio;
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentTranscript);
    copyBtn.textContent = "Copied!";
    setTimeout(() => { copyBtn.textContent = "Copy text"; }, 1500);
  } catch {
    transcript.focus();
    transcript.select();
    document.execCommand("copy");
  }
});

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([currentTranscript], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = currentFilename;
  link.click();
  URL.revokeObjectURL(url);
});

async function sendCaptureMessage(type) {
  return chrome.runtime.sendMessage({ type });
}

function renderTabResult(result) {
  if (!result) return;

  const seconds = Number(result.processing_time_seconds || 0).toFixed(2);

  showTranscript(
    result.transcript,
    `Browser tab · Language: ${result.language || "Unknown"} · Model: ${result.model || "Faster-Whisper"} · ${seconds}s`,
    "tab-transcript.txt"
  );
}

async function restoreTabState() {
  try {
    const result = await sendCaptureMessage("GET_CAPTURE_STATUS");

    if (result?.ok && result.recording) {
      startTabBtn.disabled = true;
      stopTabBtn.disabled = false;
      tabStatus.textContent =
        "Recording is active. Switch to the tab and play audio, then reopen this popup to stop.";
    } else if (result?.ok && result.uploading) {
      startTabBtn.disabled = true;
      stopTabBtn.disabled = true;
      tabStatus.textContent = "Transcribing recorded tab audio...";
    }

    const stored = await chrome.storage.local.get([
      "tabCaptureResult",
      "tabCaptureError",
      "tabCaptureStatus"
    ]);

    if (stored.tabCaptureResult) {
      renderTabResult(stored.tabCaptureResult);
    }

    if (stored.tabCaptureError) {
      tabStatus.textContent = stored.tabCaptureError;
    } else if (stored.tabCaptureStatus === "complete") {
      tabStatus.textContent = "Browser tab transcription completed.";
    }
  } catch (error) {
    tabStatus.textContent =
      "Tab capture is unavailable: " + (error.message || "Unknown error.");
  }
}

startTabBtn.addEventListener("click", async () => {
  if (tabActionInProgress) return;

  tabActionInProgress = true;
  startTabBtn.disabled = true;
  tabStatus.textContent = "Starting tab audio capture...";

  try {
    const result = await sendCaptureMessage("START_TAB_CAPTURE");

    if (!result?.ok) {
      throw new Error(result?.error || "Could not start tab capture.");
    }

    stopTabBtn.disabled = false;
    tabStatus.textContent =
      "Recording tab audio. Switch to the tab and play the audio. Reopen this popup to stop.";
  } catch (error) {
    startTabBtn.disabled = false;
    tabStatus.textContent = error.message || "Could not start capture.";
  } finally {
    tabActionInProgress = false;
  }
});

stopTabBtn.addEventListener("click", async () => {
  if (tabActionInProgress) return;

  tabActionInProgress = true;
  stopTabBtn.disabled = true;
  tabStatus.textContent = "Stopping recording and starting transcription...";

  try {
    const result = await sendCaptureMessage("STOP_TAB_CAPTURE");

    if (!result?.ok) {
      throw new Error(result?.error || "Could not stop recording.");
    }

    tabStatus.textContent =
      "Recording stopped. Transcription is processing; reopen this popup to see the result.";
  } catch (error) {
    stopTabBtn.disabled = false;
    tabStatus.textContent = error.message || "Could not stop capture.";
  } finally {
    tabActionInProgress = false;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes.tabCaptureResult?.newValue) {
    renderTabResult(changes.tabCaptureResult.newValue);
    tabStatus.textContent = "Browser tab transcription completed.";
    startTabBtn.disabled = false;
    stopTabBtn.disabled = true;
  }

  if (changes.tabCaptureError?.newValue) {
    tabStatus.textContent = changes.tabCaptureError.newValue;
    startTabBtn.disabled = false;
    stopTabBtn.disabled = true;
  }

  if (changes.tabCaptureStatus?.newValue === "transcribing") {
    startTabBtn.disabled = true;
    stopTabBtn.disabled = true;
    tabStatus.textContent = "Transcribing browser tab audio...";
  }
});

checkApi();
restoreTabState();
