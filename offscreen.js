
let mediaRecorder = null;
let mediaStream = null;
let audioContext = null;

let recording = false;
let saving = false;
let recordingStartedAt = null;

// OPFS file handling
let fileHandle = null;
let fileWriter = null;
let recordingFileName = null;

// Serializes writes so chunks are written in order.
let writeQueue = Promise.resolve();
let writeError = null;

// Tracks Blob URLs awaiting download completion.
const pendingUrls = new Map();

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (message.target === "offscreen") {

      if (message.action === "GET_STATUS") {
        sendResponse({
          recording,
          saving,
          startedAt: recordingStartedAt
        });
        return;
      }

      if (message.action === "START") {
        startRecording(message.streamId)
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            console.error("START FAILED:", error);
            sendResponse({
              success: false,
              error: error.message
            });
          });

        return true;
      }

      if (message.action === "STOP") {
        stopRecording()
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            sendResponse({
              success: false,
              error: error.message
            });
          });

        return true;
      }

      if (message.action === "DOWNLOAD_FINISHED") {
        finishDownload(message);
      }
    }
  }
);

async function startRecording(streamId) {

  if (recording || saving) {
    throw new Error("A recording is already active");
  }

  if (!streamId) {
    throw new Error("Missing stream ID");
  }

  const constraints = {
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    },
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
        maxFrameRate: 30,
        maxWidth: 1920,
        maxHeight: 1080
      }
    }
  };

  mediaStream = await navigator.mediaDevices.getUserMedia(
    constraints
  );

  try {

    // Create a file in the browser's private filesystem.
    const root = await navigator.storage.getDirectory();

    recordingFileName = `recording-${Date.now()}.webm`;

    fileHandle = await root.getFileHandle(
      recordingFileName,
      { create: true }
    );

    fileWriter = await fileHandle.createWritable();

    writeQueue = Promise.resolve();
    writeError = null;

    audioContext = new AudioContext();

    const audioSource =
      audioContext.createMediaStreamSource(mediaStream);

    audioSource.connect(audioContext.destination);

    const mimeType = MediaRecorder.isTypeSupported(
      "video/webm;codecs=vp9,opus"
    ) ? "video/webm;codecs=vp9,opus"
      : "video/webm;codecs=vp8,opus";

    mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType,
      videoBitsPerSecond: 5000000,
      audioBitsPerSecond: 128000
    });

    // Every five seconds, persist the next chunk.
    mediaRecorder.ondataavailable = event => {

      if (event.data.size === 0) return;

      writeQueue = writeQueue.then(async () => {

        if (writeError) {
          throw writeError;
        }

        await fileWriter.write(event.data);

      }).catch(error => {

        writeError = error;
        console.error("File write failed:", error);

      });
    };

    mediaRecorder.onstop = () => {
      finalizeRecording().catch(error => {
        console.error("FINALIZATION FAILED:", error);
        saving = false;
      });
    };

    mediaRecorder.start(5000);

    recording = true;
    saving = false;
    recordingStartedAt = Date.now();

    console.log("Recording started:", recordingFileName);

  } catch (error) {

    mediaStream?.getTracks().forEach(track => track.stop());

    await audioContext?.close().catch(() => {});

    if (fileWriter) {
      await fileWriter.abort().catch(() => {});
    }

    mediaStream = null;
    audioContext = null;
    fileWriter = null;
    fileHandle = null;

    throw error;
  }
}

async function stopRecording() {

  if (!recording || !mediaRecorder) {
    throw new Error("No active recording");
  }

  recording = false;
  saving = true;

  if (mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

async function finalizeRecording() {

  console.log("Finalizing recording...");

  try {

    // Wait until every pending chunk has been written.
    await writeQueue;

    if (writeError) {
      throw writeError;
    }

    // Close the file and flush pending data.
    await fileWriter.close();
    fileWriter = null;

    const file = await fileHandle.getFile();

    if (file.size === 0) {
      throw new Error("Recording file is empty");
    }

    console.log("File finalized:", file.size, "bytes");

    // Create a download URL without assembling all chunks.
    const url = URL.createObjectURL(file);

    pendingUrls.set(url, recordingFileName);

    const result = await chrome.runtime.sendMessage({
      target: "background",
      action: "SAVE_RECORDING",
      url,
      filename: recordingFileName
    });

    if (!result?.success) {
      URL.revokeObjectURL(url);
      pendingUrls.delete(url);

      throw new Error(result?.error || "Download failed");
    }

    console.log("Download started:", result.downloadId);

  } finally {

    mediaStream?.getTracks().forEach(track => track.stop());

    await audioContext?.close().catch(() => {});

    mediaStream = null;
    audioContext = null;
    mediaRecorder = null;

    recordingStartedAt = null;
    saving = false;

    fileWriter = null;
    fileHandle = null;
    recordingFileName = null;

  }
}

async function finishDownload(message) {

  const url = message.url;

  if (!pendingUrls.has(url)) return;

  URL.revokeObjectURL(url);

  const filename = pendingUrls.get(url);
  pendingUrls.delete(url);

  // Delete the temporary recording only after a successful download.
  if (message.completed) {

    try {
      const root = await navigator.storage.getDirectory();

      await root.removeEntry(filename);

      console.log("Temporary file deleted:", filename);

    } catch (error) {
      console.error("Could not delete temporary file:", error);
    }

  } else {
    console.warn(
      "Download interrupted. Temporary recording retained:",
      filename
    );
  }
}
