const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.querySelector("#mute");
const cameraBtn = document.querySelector("#camera");
const title = document.querySelector("#title");
const camerasSelect = document.getElementById("cameras");
const welcomeContainer = document.getElementById("welcomeContainer");
const call = document.getElementById("call");
const peersStream = document.getElementById("peerFace");
const googleStunList = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun2.l.google.com:19302",
  "stun:stun3.l.google.com:19302",
  "stun:stun4.l.google.com:19302",
];

/*Forms and inputs in WelcomeContainer*/
const welcomeForm = welcomeContainer.querySelector("#welcomeForm");
const nicknameInput = welcomeForm.querySelector("#nicknameInput");
const roomInput = welcomeForm.querySelector("#roomInput");

call.hidden = true;

/*하나의 스트림을 글로벌 변수로 선언해줬다. */
let myStream;
/*처음에는 muted와 cameroff 모두 false (default setting)*/
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChannel;

async function getCameras() {
  try {
    /*mediaDevices라는 web api를 이용해서 이 함수를 실행 완료하기 전까지 다음 코드들 await!*/
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label == camera.label) {
        option.selcted = true;
      }
      camerasSelect.append(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstraints = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraints
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handlemuteBtn() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerHTML = '<i class="fa fa-microphone"></i>';
    muted = true;
  } else {
    muteBtn.innerHTML = '<i class="fa fa-microphone-slash"></i>';
    muted = false;
  }
}

async function handlecameraBtn() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
    cameraOff = false;
  } else {
    cameraBtn.innerHTML = '<i class="fas fa-video"></i>';
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handlemuteBtn);
cameraBtn.addEventListener("click", handlecameraBtn);
camerasSelect.addEventListener("input", handleCameraChange);

/*when the welcomeform is submitted*/
async function initCall() {
  title.hidden = true;
  call.hidden = false;
  welcomeContainer.style.display = "none";
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  await initCall();
  socket.emit("join_room", roomInput.value);
  roomName = roomInput.value;
  roomInput.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

socket.on("welcome", async () => {
  myDataChannel = myPeerConnection.createDataChannel("chat");
  myDataChannel.addEventListener("message", console.log);
  console.log("made data channel");
  const offer = await myPeerConnection.createOffer();
  /*send the description of browser 1*/
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});

socket.on("ice", (ice) => {
  myPeerConnection.addIceCandidate(ice);
  console.log("just received ICE candidates!");
});

socket.on("offer", async (offer) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", console.log);
  });
  console.log("received an offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  console.log("sent the answer");
});

socket.on("answer", (answer, roomName) => {
  console.log("received an answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("left", () => {
  myPeerConnection.removeStream(myStream);
  peersStream.style.display = "none";
});

//RTC code와 함께 makeConnection 함수

function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: googleStunList,
      },
    ],
  });

  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleaddStream);

  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  socket.emit("ice", data.candidate, roomName);
  console.log("sent candidates");
}

function handleaddStream(data) {
  peersStream.srcObject = data.stream;
}
