# Tab Recorder

A lightweight Chromium browser extension to record video and audio from a selected browser tab and save the recording as a WebM file.

Built using Chrome Extension Manifest V3, MediaRecorder API and the Origin Private File System (OPFS).

## Features

- **Browser Tab Selection:** Choose which browser tab to record.
- **Video Recording:** Capture tab content at up to 1080p and 30 FPS.
- **Audio Recording:** Capture audio playing within the selected tab.
- **Background Recording:** Recording continues even after closing the extension popup.
- **Chunked File Writing:** Write recording data incrementally to disk instead of accumulating the entire recording in memory.
- **Persistent Temporary Storage:** Uses the browser's Origin Private File System (OPFS).
- **WebM Output:** Save recordings in WebM format.
- **MP4 Conversion:** Convert recorded WebM files to MP4 using FFmpeg.

## Architecture

```text
              Browser Extension
                     |
                     v
             Tab Selection UI
                     |
                     v
              Background Worker
                     |
                     v
             Offscreen Document
                     |
             +-------+-------+
             |               |
             v               v
        Video Capture    Audio Capture
             |               |
             +-------+-------+
                     |
                     v
                MediaRecorder
                     |
                     v
             Recording Chunks
                     |
                     v
                   OPFS
                     |
                     v
              Completed WebM
                     |
                     v
              Chrome Downloads
```

## Technology Stack

| Technology | Purpose |
|---|---|
| JavaScript | Application logic |
| HTML/CSS | Extension interface |
| Chrome Extensions API | Browser integration |
| Chrome Tab Capture API | Capturing browser tab content |
| MediaRecorder API | Recording audio and video |
| Offscreen Documents API | Background recording |
| Origin Private File System (OPFS) | Incremental file storage |
| FFmpeg | WebM to MP4 conversion |

## Project Structure

```text
TabRecorder/
│
├── manifest.json
├── popup.html
├── popup.js
├── background.js
├── offscreen.html
└── offscreen.js
```

### File Responsibilities

| File | Responsibility |
|---|---|
| `manifest.json` | Extension configuration and permissions |
| `popup.html` | Recording interface |
| `popup.js` | Tab selection and recording controls |
| `background.js` | Background processing and downloads |
| `offscreen.html` | Offscreen document container |
| `offscreen.js` | Audio/video capture and file writing |

## Installation

### Prerequisites

- Google Chrome or Microsoft Edge
- Windows, macOS or Linux
- FFmpeg (optional, for MP4 conversion)

### Install the Extension

1. Clone this repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/TabRecorder.git
   ```

2. Open the browser extensions page:

   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`

3. Enable **Developer Mode**.

4. Click **Load unpacked**.

5. Select the cloned `TabRecorder` directory.

The extension should now appear in your browser toolbar.

## Usage

1. Open the browser tab containing the content you want to record.
2. Click the Tab Recorder extension icon.
3. Select the desired browser tab.
4. Click **Start Recording**.
5. Close the extension popup if desired. Recording continues in the background.
6. Reopen the extension popup to check recording status.
7. Click **Stop Recording** when finished.
8. Choose where to save the generated WebM file.

## Recording Configuration

The current implementation uses the following configuration:

| Parameter | Value |
|---|---|
| Video codec | VP9 (fallback: VP8) |
| Audio codec | Opus |
| Maximum requested resolution | 1920 × 1080 |
| Requested frame rate | 30 FPS |
| Video bitrate | 5 Mbps |
| Audio bitrate | 128 Kbps |
| Recording chunk interval | 5 seconds |
| Output format | WebM |

Actual resolution and frame rate depend on the source tab and browser capabilities.

## Storage Management

The recorder uses the Origin Private File System (OPFS) to avoid retaining the entire recording in JavaScript memory.

Instead of storing all recording chunks in an array until recording finishes, the application:

1. Creates a temporary file in OPFS.
2. Receives recording chunks from MediaRecorder.
3. Appends each chunk to the temporary file.
4. Waits for pending writes when recording stops.
5. Closes the file.
6. Initiates a browser download.
7. Deletes the temporary file after a successful download.

This approach significantly reduces memory pressure during long recording sessions.

**Note:** OPFS storage is subject to browser storage quotas and available disk space.

## Converting WebM to MP4

The recorder generates WebM files. To convert them into MP4, install [FFmpeg](https://ffmpeg.org/download.html).

Run:

```bash
ffmpeg -i recording.webm \
  -c:v libx264 \
  -preset medium \
  -crf 23 \
  -c:a aac \
  -b:a 192k \
  -movflags +faststart \
  recording.mp4
```

### Conversion Parameters

| Parameter | Description |
|---|---|
| `libx264` | H.264 video encoder |
| `preset medium` | Encoding speed/compression balance |
| `crf 23` | Video quality setting |
| `aac` | Audio encoder |
| `192k` | Audio bitrate |
| `faststart` | Optimizes MP4 for progressive playback |

## Limitations

- This extension captures browser tab content, not the entire desktop.
- Only audio from the selected tab is captured.
- The browser must remain running during recording.
- DRM-protected content may produce a black screen or prevent capture.
- This project does not bypass DRM or protected-content restrictions.
- Browser storage quotas and available disk space limit recording capacity.
- Browser crashes or unexpected termination may prevent proper finalization of the recording.
- MP4 conversion is currently a separate FFmpeg operation.

## Future Improvements

- [ ] Add recording duration and file-size indicators.
- [ ] Add pause and resume functionality.
- [ ] Allow configurable resolution and bitrate.
- [ ] Add automatic MP4 conversion.
- [ ] Add recording history.
- [ ] Add crash recovery and incomplete-recording recovery.
- [ ] Add configurable chunk intervals.
- [ ] Improve error handling and recording status notifications.
- [ ] Add support for recording selected desktop windows.

## Contributing

Contributions, bug reports and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a pull request.

## License

Choose an appropriate open-source license before publishing. MIT is one option if you want others to freely use, modify and distribute the project.

---

**Disclaimer:** This project is intended for recording content that you own or are authorized to capture. Respect copyright laws, platform terms of service and applicable privacy regulations.
