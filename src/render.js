const { createWriteStream } = require('fs');
const { desktopCapturer, remote } = require('electron')
const { Menu, dialog } = remote;

const videoElement = document.querySelector("video");
const toggleRecordBtn = document.getElementById("toggleRecordBtn");
const sourceSelectBtn = document.getElementById("sourceSelectBtn");
sourceSelectBtn.onclick = getVideoSources;
toggleRecordBtn.onclick = toggleRecord;

let mediaRecorder;
let blobReader;
let storageStream;
let mediaStream;
let dataCollectionTimer;


async function toggleRecord(e) {
    if (!mediaRecorder) {
        constructMediaRecorder(mediaStream);
        constructBlobReader();
    }

    if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        process.nextTick(() => {
            dispose();
        })
        toggleRecordBtn.classList.add("is-light");
        toggleRecordBtn.innerText = "Record";
    } else {
        try {
            await requestWriteStreamDestination();
            mediaRecorder.start();

            toggleRecordBtn.classList.remove("is-light");
            toggleRecordBtn.innerText = "Recording";
        } catch (err) {
            dialog.showErrorBox('Recordingo', err.message);
        }
    }
}

function constructMediaRecorder(mediaStream) {
    var options = {
        mimeType: "video/webm; codecs=vp9"
    };
    mediaRecorder = new MediaRecorder(mediaStream, options);
    mediaRecorder.ondataavailable = handleMediaRecorderDataAvailable;
    mediaRecorder.onstart = handleMediaRecorderStart;
    mediaRecorder.onstop = handleMediaRecorderStop;
}

function handleMediaRecorderDataAvailable(e) {
    blobReader.readAsArrayBuffer(e.data);
}

async function handleMediaRecorderStart(e) {
    sourceSelectBtn.disabled = true;
    dataCollectionTimer = setInterval(() => {
        mediaRecorder.requestData();
    }, 8000);
}

function handleMediaRecorderStop(e) {
    sourceSelectBtn.disabled = false;
    clearInterval(dataCollectionTimer);
}

function constructBlobReader() {
    blobReader = new FileReader();
    blobReader.onload = handleBlobReaderLoad;
}

function handleBlobReaderLoad(e) {
    storageStream.write(Buffer.from(e.currentTarget.result));
}

async function requestWriteStreamDestination() {
    const { filePath } = await dialog.showSaveDialog({
        buttonLabel: "Save video",
        defaultPath: `vid-${Date.now()}.webm`
    });
    if (!filePath) {
        throw new Error('You should select a place to save recording')
    }
    storageStream = createWriteStream(filePath);
}

async function getVideoSources() {
    const inputSources = await desktopCapturer.getSources({
        types: ["window", "screen"]
    });
    const videoOptionsMenu = Menu.buildFromTemplate(
        inputSources.map(source => {
            return {
                label: source.name,
                click: () => selectSource(source)
            };
        })
    );
    videoOptionsMenu.popup();
}

async function selectSource(source) {
    sourceSelectBtn.innerText = source.name;

    const mediaStreamConstraints = {
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: source.id,
                minWidth: 1280,
                minHeight: 720,
                maxFrameRate: 30,

            },
        }
    };

    mediaStream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints);
    previewStream(mediaStream);
}

function previewStream(mediaStream) {
    videoElement.srcObject = mediaStream;
    videoElement.play();
}

function dispose() {
    mediaRecorder = null;
    blobReader = null;
}