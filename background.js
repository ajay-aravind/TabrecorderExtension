
const activeDownloads = new Map();

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (message.target !== "background") return;

    if (message.action === "SAVE_RECORDING") {

      (async () => {

        try {

          const downloadId = await chrome.downloads.download({
            url: message.url,
            filename: message.filename,
            saveAs: true
          });

          activeDownloads.set(downloadId, {
            url: message.url
          });

          sendResponse({
            success: true,
            downloadId
          });

        } catch (error) {

          console.error("Download failed:", error);

          sendResponse({
            success: false,
            error: error.message
          });
        }

      })();

      return true;
    }
  }
);

chrome.downloads.onChanged.addListener(delta => {

  if (!delta.state) return;

  const completed =
    delta.state.current === "complete";

  const interrupted =
    delta.state.current === "interrupted";

  if (!completed && !interrupted) return;

  const download = activeDownloads.get(delta.id);

  if (!download) return;

  activeDownloads.delete(delta.id);

  chrome.runtime.sendMessage({
    target: "offscreen",
    action: "DOWNLOAD_FINISHED",
    url: download.url,
    completed
  }).catch(error => {
    console.error("Could not notify offscreen:", error);
  });

});
