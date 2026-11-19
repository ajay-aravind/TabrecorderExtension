
const tabSelect = document.getElementById("tabs");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const status = document.getElementById("status");

async function ensureOffscreen() {
  const url = chrome.runtime.getURL("offscreen.html");

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url]
  });

  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Record browser tab audio and video"
    });
  }
}

async function loadTabs() {
  const tabs = await chrome.tabs.query({
    currentWindow: true
  });

  tabSelect.innerHTML = "";

  tabs.forEach(tab => {
    if (!tab.id || !tab.url?.startsWith("http")) return;

    const option = document.createElement("option");
    option.value = tab.id;
    option.textContent = tab.title || tab.url;

    tabSelect.appendChild(option);
  });
}

async function refreshStatus() {
  const url = chrome.runtime.getURL("offscreen.html");

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url]
  });

  if (contexts.length === 0) {
    showIdle();
    return;
  }

  const state = await chrome.runtime.sendMessage({
    target: "offscreen",
    action: "GET_STATUS"
  });

  if (state?.recording) {
    showRecording();
  } else if (state?.saving) {
    showSaving();
  } else {
    showIdle();
  }
}

function showIdle() {
  status.textContent = "Ready";
  startButton.disabled = false;
  stopButton.disabled = true;
}

function showRecording() {
  status.textContent = "🔴 Recording...";
  startButton.disabled = true;
  stopButton.disabled = false;
}

function showSaving() {
  status.textContent = "Saving recording...";
  startButton.disabled = true;
  stopButton.disabled = true;
}

startButton.onclick = async () => {
  try {
    startButton.disabled = true;
    status.textContent = "Preparing...";

    const tabId = Number(tabSelect.value);

    if (!tabId) {
      throw new Error("Select a browser tab");
    }

    await ensureOffscreen();

    const streamId =
      await chrome.tabCapture.getMediaStreamId({
        targetTabId: tabId
      });

    const result = await chrome.runtime.sendMessage({
      target: "offscreen",
      action: "START",
      streamId
    });

    console.log("Offscreen response:", result);

    if (!result) {
      throw new Error(
        "Offscreen document did not respond. Check its console."
      );
    }

    if (!result?.success) {
      throw new Error(result?.error || "Could not start recording");
    }

    showRecording();

  } catch (error) {
    status.textContent = "Error: " + error.message;
    startButton.disabled = false;
  }
};

stopButton.onclick = async () => {
  try {
    showSaving();

    const result = await chrome.runtime.sendMessage({
      target: "offscreen",
      action: "STOP"
    });

    if (!result?.success) {
      throw new Error(result?.error || "Could not stop recording");
    }

  } catch (error) {
    status.textContent = "Error: " + error.message;
    await refreshStatus();
  }
};

async function initialize() {
  await loadTabs();
  await refreshStatus();
}

initialize();
