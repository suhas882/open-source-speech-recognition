
async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Capture tab audio after the user requests transcription."
  });
}

function sendToOffscreen(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { ...message, target: "offscreen" },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response) {
          reject(new Error("The audio recorder did not respond."));
          return;
        }

        resolve(response);
      }
    );
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message.target === "offscreen") {
    return;
  }

  (async () => {
    if (message.type === "START_TAB_CAPTURE") {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      });

      if (!tab?.id) {
        throw new Error("No active Chrome tab was found.");
      }

      const streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: tab.id
      });

      await ensureOffscreenDocument();

      const result = await sendToOffscreen({
        type: "START_RECORDING",
        streamId
      });

      sendResponse(result);
      return;
    }

    if (message.type === "STOP_TAB_CAPTURE") {
      const result = await sendToOffscreen({
        type: "STOP_RECORDING"
      });

      sendResponse(result);
      return;
    }

    if (message.type === "GET_CAPTURE_STATUS") {
      const result = await sendToOffscreen({
        type: "GET_STATUS"
      });

      sendResponse(result);
      return;
    }

    sendResponse({ ok: false, error: "Unknown command." });
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error.message || "Tab capture failed."
    });
  });

  return true;
});
