import React, { useEffect } from "react";
import "./webrtc.js";

export function WebRTC() {
  return (
    <>
      <h1>Welcome to WebRTC!</h1>
      <div id="buttons">
        <button className="mdc-button mdc-button--raised" id="cameraBtn">
          <span className="mdc-button__label">Open camera & microphone</span>
        </button>
        <button
          className="mdc-button mdc-button--raised"
          disabled
          id="createBtn"
        >
          <span className="mdc-button__label">Create room</span>
        </button>
        <button className="mdc-button mdc-button--raised" disabled id="joinBtn">
          <span className="mdc-button__label">Join room</span>
        </button>
        <button
          className="mdc-button mdc-button--raised"
          disabled
          id="hangupBtn"
        >
          <span className="mdc-button__label">Hangup</span>
        </button>
      </div>
      <div>
        <span id="currentRoom"></span>
      </div>
      <div id="videos">
        <video id="localVideo" muted autoPlay playsInline controls></video>
        <video id="remoteVideo" muted autoPlay playsInline></video>
      </div>
      <div
        className="mdc-dialog"
        id="room-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="my-dialog-title"
        aria-describedby="my-dialog-content"
      >
        <div className="mdc-dialog__container">
          <div className="mdc-dialog__surface">
            <h2 className="mdc-dialog__title" id="my-dialog-title">
              Join room
            </h2>
            <div className="mdc-dialog__content" id="my-dialog-content">
              Enter ID for room to join:
              <div className="mdc-text-field">
                <input
                  type="text"
                  id="room-id"
                  className="mdc-text-field__input"
                ></input>
                <div className="mdc-line-ripple"></div>
              </div>
            </div>
            <footer className="mdc-dialog__actions">
              <button
                type="button"
                className="mdc-button mdc-dialog__button"
                data-mdc-dialog-action="no"
              >
                <span className="mdc-button__label">Cancel</span>
              </button>
              <button
                id="confirmJoinBtn"
                type="button"
                className="mdc-button mdc-dialog__button"
                data-mdc-dialog-action="yes"
              >
                <span className="mdc-button__label">Join</span>
              </button>
            </footer>
          </div>
        </div>
        <div className="mdc-dialog__scrim"></div>
      </div>
    </>
  );
}
