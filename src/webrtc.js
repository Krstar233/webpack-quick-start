import Parse from "parse";
import "./config.js";
import { stunServer } from "./stun.js";

const configuration = {
  iceServers: [
    {
      urls: stunServer,
    },
  ],
  iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let roomDialog = null;
let roomId = null;
let subscription = null;
const callerName = "callerCandidates";
const calleeName = "calleeCandidates";

async function initSubscription(roomId) {
  const query = new Parse.Query("Rooms");
  query.ascending("objectId").equalTo(roomId);
  subscription = await query.subscribe();
}

async function init() {
  document.querySelector("#cameraBtn").addEventListener("click", openUserMedia);
  document.querySelector("#createBtn").addEventListener("click", createRoom);
  document.querySelector("#hangupBtn").addEventListener("click", hangUp);
  document.querySelector("#joinBtn").addEventListener("click", joinRoom);
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector("#room-dialog"));
}

async function collectIceCandidates(
  roomRef,
  peerConnection,
  localName,
  remoteName,
) {
  console.log("collectIceCandidates " + localName);
  const localCandidate = [];
  const remoteCandidate = [];

  peerConnection.addEventListener("icecandidate", async (event) => {
    if (event.candidate) {
      console.log("onicecandidate ", event.candidate);
      const json = event.candidate.toJSON();
      localCandidate.push(json);
      roomRef.set(localName, localCandidate);
      roomRef = await roomRef.save();
    }
  });

  subscription.on("update", (object) => {
    const data = object.attributes;
    if (!data[remoteName]) {
      return;
    }
    data[remoteName].forEach((candidate) => {
      if (!remoteCandidate.includes(candidate)) {
        remoteCandidate.push(candidate);
        console.log("remote icecandidate ", candidate);
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });
  });
}

async function createRoom() {
  document.querySelector("#createBtn").disabled = true;
  document.querySelector("#joinBtn").disabled = true;

  console.log("Create PeerConnection with configuration: ", configuration);
  peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners();

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Add code for creating a room here
  const offer = await peerConnection.createOffer();
  console.log("Set local description: ", offer);

  const roomWithOffer = {
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
  };
  const roomRef = await saveData("Rooms", roomWithOffer);
  const roomId = roomRef.id;
  document.querySelector("#currentRoom").innerText =
    `Current room is ${roomId} - You are the caller!`;

  await initSubscription(roomId);
  collectIceCandidates(roomRef, peerConnection, callerName, calleeName);

  await peerConnection.setLocalDescription(offer);
  subscription.on("update", async (object) => {
    const data = object.attributes;
    console.log("Got updated room:", data);
    if (!peerConnection.currentRemoteDescription && data.answer) {
      const answer = new RTCSessionDescription(data.answer);
      console.log("Set remote description: ", answer);
      await peerConnection.setRemoteDescription(answer);
    }
  });
}

function joinRoom() {
  document.querySelector("#createBtn").disabled = true;
  document.querySelector("#joinBtn").disabled = true;

  document.querySelector("#confirmJoinBtn").addEventListener(
    "click",
    async () => {
      roomId = document.querySelector("#room-id").value;
      console.log("Join room: ", roomId);
      document.querySelector("#currentRoom").innerText =
        `Current room is ${roomId} - You are the callee!`;
      await joinRoomById(roomId);
    },
    { once: true },
  );
  roomDialog.open();
}

async function getParseObject(tableName, objectId) {
  const Table = Parse.Object.extend(tableName);
  const query = new Parse.Query(Table);
  return query.get(objectId);
}

async function updateParseObject(parseObject, lineValue) {
  for (const k in lineValue) {
    parseObject.set(k, lineValue[k]);
  }
  return parseObject.save();
}

async function joinRoomById(roomId) {
  const parseObject = await getParseObject("Rooms", roomId);

  console.log("Got room:", parseObject.attributes);

  if (parseObject.existed() && parseObject.attributes.offer) {
    await initSubscription(roomId);
    console.log("Create PeerConnection with configuration: ", configuration);
    peerConnection = new RTCPeerConnection(configuration);

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    registerPeerConnectionListeners();
    collectIceCandidates(parseObject, peerConnection, calleeName, callerName);

    const offer = new RTCSessionDescription(parseObject.attributes.offer);
    console.log("Set remote description: ", offer);
    await peerConnection.setRemoteDescription(offer);

    const answer = await peerConnection.createAnswer();
    console.log("Set local description: ", answer);
    await peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    };
    await updateParseObject(parseObject, roomWithAnswer);
  }
}

async function openUserMedia(_e) {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });
  document.querySelector("#localVideo").srcObject = stream;
  localStream = stream;
  remoteStream = new MediaStream();
  document.querySelector("#remoteVideo").srcObject = remoteStream;

  console.log("Stream:", document.querySelector("#localVideo").srcObject);
  document.querySelector("#cameraBtn").disabled = true;
  document.querySelector("#joinBtn").disabled = false;
  document.querySelector("#createBtn").disabled = false;
  document.querySelector("#hangupBtn").disabled = false;
}

async function hangUp(_e) {
  const tracks = document.querySelector("#localVideo").srcObject.getTracks();
  tracks.forEach((track) => {
    track.stop();
  });

  if (remoteStream) {
    remoteStream.getTracks().forEach((track) => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
  }

  document.querySelector("#localVideo").srcObject = null;
  document.querySelector("#remoteVideo").srcObject = null;
  document.querySelector("#cameraBtn").disabled = false;
  document.querySelector("#joinBtn").disabled = true;
  document.querySelector("#createBtn").disabled = true;
  document.querySelector("#hangupBtn").disabled = true;
  document.querySelector("#currentRoom").innerText = "";

  // Delete room on hangup
  if (roomId) {
    const parseObject = await getParseObject("Rooms", roomId);
    await parseObject.destroy();
  }

  document.location.reload(true);
}

function registerPeerConnectionListeners() {
  peerConnection.addEventListener("icegatheringstatechange", () => {
    console.log(
      `ICE gathering state changed: ${peerConnection.iceGatheringState}`,
    );
  });

  peerConnection.addEventListener("connectionstatechange", () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
  });

  peerConnection.addEventListener("signalingstatechange", () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener("iceconnectionstatechange ", () => {
    console.log(
      `ICE connection state change: ${peerConnection.iceConnectionState}`,
    );
  });

  peerConnection.addEventListener("track", (event) => {
    // console.log('Got remote track:', event.track);
    console.log("Add a track to the remoteStream:", event.track);
    remoteStream.addTrack(event.track);
  });
}

function saveData(tableName, lineValue) {
  const Table = Parse.Object.extend(tableName);
  const table = new Table();
  for (const k in lineValue) {
    table.set(k, lineValue[k]);
  }
  return table.save();
}

async function main() {
  await init();
}

function uninit() {
  subscription.unsubscribe();
  Parse.LiveQuery.close();
}

window.onload = main;
window.onunload = uninit;
