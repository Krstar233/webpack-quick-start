import { stunServer } from "./stun.js";
import Parse from "parse";
import { CALLER_NAME, CALLEE_NAME } from "./config.js";
import { Log } from "./log.js";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("1234567890", 6);

class RTC {
  TAG = "RTC";
  peerConnection = null;
  subscription = null;
  dataChannel = null;

  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this._configuration);
    this._registerPeerConnectionListeners();
  }

  async collectIceCandidates(roomRef, localName, remoteName) {
    Log.info(this.TAG, "collectIceCandidates " + localName);
    const localCandidate = [];
    const remoteCandidate = [];
    const peerConnection = this.peerConnection;

    peerConnection.addEventListener("icecandidate", async (event) => {
      if (event.candidate) {
        Log.info(this.TAG, `${localName} - onicecandidate `, event.candidate);
        const json = event.candidate.toJSON();
        localCandidate.push(json);
        roomRef.set(localName, localCandidate);
        roomRef = await roomRef.save();
      }
    });

    this.subscription.on("update", (object) => {
      const data = object.attributes;
      if (!data[remoteName]) {
        return;
      }
      data[remoteName].forEach((candidate) => {
        if (!remoteCandidate.includes(candidate)) {
          remoteCandidate.push(candidate);
          Log.info(this.TAG, `${localName} - remote icecandidate `, candidate);
          peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });
    });
  }

  async initSubscription(roomId) {
    const query = new Parse.Query("Rooms");
    query.ascending("objectId").equalTo(roomId);
    this.subscription = await query.subscribe();
  }

  saveData(tableName, lineValue) {
    const Table = Parse.Object.extend(tableName);
    const table = new Table();
    for (const k in lineValue) {
      table.set(k, lineValue[k]);
    }
    return table.save();
  }

  async getParseObject(tableName, objectId) {
    const Table = Parse.Object.extend(tableName);
    const query = new Parse.Query(Table);
    return query.get(objectId);
  }

  async updateParseObject(parseObject, lineValue) {
    for (const k in lineValue) {
      parseObject.set(k, lineValue[k]);
    }
    return parseObject.save();
  }

  close() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (!this.subscription) {
      return;
    }
    this.subscription.unsubscribe();
    this.subscription = null;
  }

  ////////////////////////////////////////////////////////////////////////////

  _configuration = {
    iceServers: [
      {
        urls: stunServer,
      },
    ],
    iceCandidatePoolSize: 10,
  };

  _registerPeerConnectionListeners() {
    this.peerConnection.addEventListener("icegatheringstatechange", () => {
      Log.info(
        this.TAG,
        `ICE gathering state changed: ${this.peerConnection.iceGatheringState}`,
      );
    });

    this.peerConnection.addEventListener("connectionstatechange", () => {
      Log.info(
        this.TAG,
        `Connection state change: ${this.peerConnection.connectionState}`,
      );
    });

    this.peerConnection.addEventListener("signalingstatechange", () => {
      Log.info(
        this.TAG,
        `Signaling state change: ${this.peerConnection.signalingState}`,
      );
    });

    this.peerConnection.addEventListener("iceconnectionstatechange ", () => {
      Log.info(
        this.TAG,
        `ICE connection state change: ${this.peerConnection.iceConnectionState}`,
      );
    });

    this.peerConnection.addEventListener("track", (event) => {
      // Log.info('Got remote track:', event.track);
      Log.info(this.TAG, "Add a track to the remoteStream:", event.track);
    });
  }
}

//////////////////////////////////////////////////////////////////////////////////////////

class CacheFileBuffer {
  constructor() {
    this.buffers = [];
  }

  add(arrayBuffer) {
    this.buffers.push(arrayBuffer);
  }

  read(maxBytes) {
    let bytesRead = 0;
    let result = new Uint8Array(maxBytes);

    while (bytesRead < maxBytes && this.buffers.length > 0) {
      const currentBuffer = this.buffers[0];
      const remainingBytes = maxBytes - bytesRead;

      if (currentBuffer.byteLength <= remainingBytes) {
        // 如果当前缓冲区的字节数小于等于需要读取的字节数，将整个缓冲区读取并移除
        result.set(new Uint8Array(currentBuffer), bytesRead);
        bytesRead += currentBuffer.byteLength;
        this.buffers.shift();
      } else {
        // 如果当前缓冲区的字节数大于需要读取的字节数，只读取部分并保留剩余部分
        result.set(
          new Uint8Array(currentBuffer.slice(0, remainingBytes)),
          bytesRead,
        );
        this.buffers[0] = currentBuffer.slice(remainingBytes);
        bytesRead += remainingBytes;
      }
    }

    // 返回读取的数据
    return result.buffer.slice(0, bytesRead);
  }

  clear() {
    this.buffers = [];
  }

  empty() {
    return this.buffers.length <= 0;
  }
}

//////////////////////////// FileSender ///////////////////////////////////////////////

export class FileSender {
  TAG = "FileSender";
  roomID = null;

  setFileList() {}

  async createSession() {
    if (this.roomID && this._rtc.peerConnection.connectionState !== "closed") {
      return roomId;
    }

    this._rtc.createPeerConnection();
    this._rtc.dataChannel = this._rtc.peerConnection.createDataChannel(
      this.TAG,
    );

    // Enable textarea and button when opened
    this._rtc.dataChannel.addEventListener("open", async (event) => {
      Log.info(this.TAG, "DataChannel Open");
      for (const task of this._cachedSendFileTask) {
        await this._sendFile(task);
      }
    });

    // Disable input when closed
    this._rtc.dataChannel.addEventListener("close", (event) => {
      Log.info(this.TAG, "DataChannel Closed");
    });

    this._rtc.dataChannel.addEventListener("error", (event) => {
      Log.info(this.TAG, "DataChannel Error", event);
    });

    // Append new messages to the box of incoming messages
    this._rtc.dataChannel.addEventListener("message", (event) => {
      const message = event.data;
      Log.info(this.TAG, "DataChannel Receive Message: " + message);
    });

    // Add code for creating a room here
    const offer = await this._rtc.peerConnection.createOffer();
    Log.info(this.TAG, "Set local description: ", offer);

    const roomWithOffer = {
      offer: {
        type: offer.type,
        sdp: offer.sdp,
      },
    };
    const roomRef = await this._rtc.saveData("Rooms", roomWithOffer);
    const roomId = roomRef.id;
    this.roomID = roomId;

    await this._rtc.initSubscription(roomId);
    this._rtc.collectIceCandidates(roomRef, CALLER_NAME, CALLEE_NAME);

    await this._rtc.peerConnection.setLocalDescription(offer);
    this._rtc.subscription.on("update", async (object) => {
      const data = object.attributes;
      Log.info(this.TAG, "Got updated room:", data);
      if (!this._rtc.peerConnection.currentRemoteDescription && data.answer) {
        const answer = new RTCSessionDescription(data.answer);
        Log.info(this.TAG, "Set remote description: ", answer);
        await this._rtc.peerConnection.setRemoteDescription(answer);
      }
    });

    return this.roomID;
  }

  send(
    fileBlob,
    { startSendCallback, successCallback, errorCallback, progressCallback },
  ) {
    const sendFileTask = {
      fileBlob,
      startSendCallback,
      successCallback,
      errorCallback,
      progressCallback,
    };
    if (this._rtc.dataChannel.readyState !== "open") {
      this._cachedSendFileTask.push(sendFileTask);
      return;
    }
    this._sendFile(sendFileTask);
  }

  async close() {
    this._hangUp();
    this._rtc.close();
  }

  ///////////////////////// PRIVATE //////////////////////////////////////
  _rtc = new RTC();
  _cachedSendFileTask = [];
  _maxChunkBytesPerSend = 1024 * 256; // 256 KB

  async _hangUp() {
    // Delete room on hangup
    if (this.roomID) {
      const parseObject = await this._rtc.getParseObject("Rooms", this.roomID);
      await parseObject.destroy();
      this.roomID = null;
    }
  }

  async _sendFile(task) {
    const {
      fileBlob,
      startSendCallback,
      successCallback,
      errorCallback,
      progressCallback,
    } = task;
    Log.info(
      this.TAG,
      "Start send file: ",
      fileBlob.name,
      fileBlob.size,
      fileBlob.type,
    );

    // 通过readAsArrayBuffer方法将文件内容读取为ArrayBuffer
    this._rtc.dataChannel.send(
      JSON.stringify({
        type: "hello",
        data: {
          name: fileBlob.name,
          size: fileBlob.size,
          type: fileBlob.type,
        },
      }),
    );

    const readableStream = fileBlob.stream();
    const reader = readableStream.getReader();
    const cacheFileBuffer = new CacheFileBuffer();
    let readingFile = false;
    let fileSentBytes = 0;
    const totalFileSize = fileBlob.size;

    startSendCallback();

    const e = {
      bufferedamountlow: async (event) => {
        const finish = () => {
          readingFile = false;
          this._rtc.dataChannel.send(
            JSON.stringify({
              type: "bye",
            }),
          );
          this._rtc.dataChannel.removeEventListener(
            "bufferedamountlow",
            e.bufferedamountlow,
          );
          reader.releaseLock();
          cacheFileBuffer.clear();
        };

        const sendSomeBuffer = () => {
          const bufferToSend = cacheFileBuffer.read(this._maxChunkBytesPerSend);
          fileSentBytes += bufferToSend.byteLength;
          this._rtc.dataChannel.send(bufferToSend);
          const progress = (fileSentBytes / totalFileSize) * 100;
          progressCallback(progress);
        };

        if (readingFile) {
          return;
        }

        Log.info(this.TAG, "DataChannel Send BufferdMountLow");
        if (!cacheFileBuffer.empty()) {
          sendSomeBuffer();
          return;
        }

        readingFile = true;
        const { done, value } = await reader.read().catch((err) => {
          finish();
          errorCallback();
        });
        readingFile = false;

        if (done) {
          Log.info(this.TAG, "Read File EOF: ", fileBlob.name);
          finish();
          progressCallback(100);
          successCallback();
          return;
        }
        cacheFileBuffer.add(value.buffer);
        sendSomeBuffer();
      },
    };

    this._rtc.dataChannel.addEventListener(
      "bufferedamountlow",
      e.bufferedamountlow,
    );

    e.bufferedamountlow();
  }
}

export class FileReceiver {
  TAG = "FileReceiver";

  // TODO: roomID 改成 file code / session ID
  async receive(
    roomId,
    { startReceiveCallback, successCallback, progressCallback, errorCallback },
  ) {
    this._e = {
      ...this._e,
      startReceiveCallback,
      successCallback,
      progressCallback,
      errorCallback,
    };

    const parseObject = await this._rtc.getParseObject("Rooms", roomId);

    Log.info(this.TAG, "Got room:", parseObject.attributes);

    if (parseObject.existed() && parseObject.attributes.offer) {
      await this._rtc.initSubscription(roomId);
      this._rtc.createPeerConnection();
      this._rtc.collectIceCandidates(parseObject, CALLEE_NAME, CALLER_NAME);

      this._rtc.peerConnection.addEventListener("datachannel", (event) => {
        const dataChannel = event.channel;
        this._rtc.dataChannel = dataChannel;

        // Enable textarea and button when opened
        this._rtc.dataChannel.addEventListener("open", (event) => {
          Log.info(this.TAG, " DataChannel Open");
        });

        this._rtc.dataChannel.addEventListener("error", (event) => {
          Log.info(this.TAG, "DataChannel Error", event);
        });

        // Disable input when closed
        this._rtc.dataChannel.addEventListener("close", (event) => {
          Log.info(this.TAG, " DataChannel Closed");
        });

        // Append new messages to the box of incoming messages
        this._rtc.dataChannel.addEventListener("message", (event) => {
          const message = event.data;
          this._handleDataChanleMessage(message);
        });
      });

      const offer = new RTCSessionDescription(parseObject.attributes.offer);
      Log.info(this.TAG, " Set remote description: ", offer);
      await this._rtc.peerConnection.setRemoteDescription(offer);

      const answer = await this._rtc.peerConnection.createAnswer();
      Log.info(this.TAG, " Set local description: ", answer);
      await this._rtc.peerConnection.setLocalDescription(answer);

      const roomWithAnswer = {
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      };

      await this._rtc.updateParseObject(parseObject, roomWithAnswer);
    }
  }

  close() {
    this._rtc.close();
  }

  ///////////////////////// PRIVATE //////////////////////////////////////
  _rtc = new RTC();
  _fileInfos = null;
  _cacheFileBuffer = [];
  _cacheFileBufferSize = 0;

  _e = {
    startReceiveCallback: () => {},
    successCallback: () => {},
    progressCallback: () => {},
    errorCallback: () => {},
  };

  _combineArrayBuffers(arrayBuffers) {
    // 计算总长度
    let totalLength = 0;
    arrayBuffers.forEach((buffer) => {
      totalLength += buffer.byteLength;
    });

    // 创建一个新的 ArrayBuffer
    let combinedBuffer = new ArrayBuffer(totalLength);

    // 使用 TypedArray 或 DataView 将数据复制到新的 ArrayBuffer
    let offset = 0;
    arrayBuffers.forEach((buffer) => {
      let newUint8Array = new Uint8Array(
        combinedBuffer,
        offset,
        buffer.byteLength,
      );
      let sourceUint8Array = new Uint8Array(buffer);
      newUint8Array.set(sourceUint8Array);
      offset += buffer.byteLength;
    });

    return combinedBuffer;
  }

  _download() {
    const arrayBuffer = this._combineArrayBuffers(this._cacheFileBuffer);
    // 假设你有以下信息
    const fileName = this._fileInfos.name;
    const fileType = this._fileInfos.type;

    // 创建Blob对象
    const blob = new Blob([arrayBuffer], { type: fileType });

    // 创建临时链接
    const url = URL.createObjectURL(blob);

    // 创建下载链接
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = fileName;

    // 添加到DOM中，模拟点击下载
    document.body.appendChild(downloadLink);
    downloadLink.click();

    // 移除临时链接
    document.body.removeChild(downloadLink);

    // 释放Blob对象的URL
    URL.revokeObjectURL(url);
  }

  _handleDataChanleMessage(message) {
    if (typeof message === "string") {
      Log.info(this.TAG, " DataChannel Receive Message: " + message);

      message = JSON.parse(message);

      switch (message.type) {
        case "hello": {
          const { name, size, type } = message.data;
          Log.info(this.TAG, "receive hello ", name, size, type);
          this._fileInfos = {
            name,
            size,
            type,
          };
          this._cacheFileBuffer = [];
          this._cacheFileBufferSize = 0;
          this._e.startReceiveCallback();
          break;
        }
        case "bye": {
          Log.info(this.TAG, "receive file end ");
          this._download();
          this._fileInfos = null;
          this._cacheFileBuffer = [];
          this._cacheFileBufferSize = 0;
          this._e.successCallback();
          break;
        }
      }
    } else {
      if (this._fileInfos) {
        this._cacheFileBuffer.push(message);
        this._cacheFileBufferSize += message.byteLength;
        const progress =
          (this._cacheFileBufferSize / this._fileInfos.size) * 100;
        this._e.progressCallback(progress);
      }
    }
  }
}
