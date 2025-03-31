const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const video = document.getElementById("video");
const audioCanvas = document.getElementById("audioCanvas");
const audioCtx = audioCanvas.getContext("2d");

let mediaStream = null;
let audioContext = null;
let analyser = null;
let animationFrame = null;

startButton.addEventListener("click", async () => {
  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: {
        width: 1280,
        height: 720,
        frameRate: 30,
      },
    });

    video.srcObject = mediaStream;
    video.onloadedmetadata = () => video.play();

    // Set up audio visualization
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyser);
    analyser.fftSize = 256;

    // Start visualization
    startVisualization();

    startButton.disabled = true;
    stopButton.disabled = false;
  } catch (err) {
    console.error("Error accessing media devices:", err);
  }
});

stopButton.addEventListener("click", () => {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    video.srcObject = null;

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    startButton.disabled = false;
    stopButton.disabled = true;
  }
});

function startVisualization() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    animationFrame = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    audioCtx.fillStyle = "#f8f8f8";
    audioCtx.fillRect(0, 0, audioCanvas.width, audioCanvas.height);

    const barWidth = (audioCanvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i] / 2;

      audioCtx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
      audioCtx.fillRect(x, audioCanvas.height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
    }
  }

  draw();
}
