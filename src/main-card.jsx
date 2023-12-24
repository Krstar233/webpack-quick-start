import React from "react";
import * as PropTypes from "prop-types";
import ClipboardJS from "clipboard";
import {
  Button,
  FileUploader,
  Pane,
  FileCard,
  Card,
  Heading,
  Pre,
  TextInput,
  toaster,
  TrashIcon,
  TickCircleIcon,
} from "evergreen-ui";
import { FileReceiver, FileSender } from "./file-conn.js";
import { Log } from "./log.js";

import "./main-card.less";

//////////////////////////GLOBAL///////////////////////////////////////

const fileSender = new FileSender();
const fileReceiver = new FileReceiver();

////////////////////// SendFileButton //////////////////////////////////

function SendFileButton({ onSend }) {
  const TAG = "$SendFileButton";
  const [isLoading, setIsLoading] = React.useState(false);

  const handleButtonClick = () => {
    setIsLoading(true);
    fileSender
      .createSession()
      .then((sessionID) => {
        setIsLoading(false);
        onSend(sessionID);
      })
      .catch((err) => {
        Log.error(TAG, err);
      });
  };

  return (
    <>
      <Button
        appearance="primary"
        size="large"
        onClick={handleButtonClick}
        width={100}
        isLoading={isLoading}
      >
        Send
      </Button>
    </>
  );
}
SendFileButton.propTypes = {
  onSend: PropTypes.func.isRequired,
};

//////////////////////// ReceiveFileFeild ////////////////////////////////

function ReceiveFileFeild({
  onReceiveSuccess,
  onReceiveError,
  onStartReceive,
  onReceiveProgress,
}) {
  const [receiveCode, setReceiveCode] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleRecevieFile = () => {
    setIsLoading(true);
    fileReceiver.receive(receiveCode, {
      startReceiveCallback: () => {
        setIsLoading(false);
        onStartReceive();
      },
      successCallback: () => {
        onReceiveSuccess();
      },
      progressCallback: (progress) => {
        onReceiveProgress(progress);
      },
      errorCallback: () => {
        onReceiveError();
      },
    });
  };

  return (
    <>
      <Pane flex={1} alignItems="flex-end" display="flex">
        <TextInput
          name="receive-code-input"
          placeholder="File code for receiving here."
          onChange={(e) => {
            setReceiveCode(e.target.value);
          }}
          value={receiveCode}
          marginRight={18}
          height={40}
        />
        <Button
          appearance="primary"
          size="large"
          margin={0}
          onClick={handleRecevieFile}
          isLoading={isLoading}
        >
          Receive
        </Button>
      </Pane>
    </>
  );
}

ReceiveFileFeild.propTypes = {
  onReceiveSuccess: PropTypes.func.isRequired,
  onReceiveError: PropTypes.func.isRequired,
  onStartReceive: PropTypes.func.isRequired,
  onReceiveProgress: PropTypes.func.isRequired,
};

//////////////////////// FileProgress ////////////////////////////////

export function FileProgress({ title, percentage, done, theme }) {
  const percentageNumber = Math.min(100, Math.max(0, percentage));
  const percentageNumberFixed = percentageNumber.toFixed(2);
  const selectProgressCardStyle = () => {
    if (theme === "blue") {
      return done ? "blue-progress-bar-done" : "blue-progress-bar";
    }
    return done ? "progress-bar-done" : "progress-bar";
  };

  const selectTickCircleIconColor = () => {
    if (theme === "blue") {
      return "#3366FF";
    }
    return "#52BD95";
  };

  return (
    <>
      <Pane display="flex" justifyContent="space-between">
        <Heading
          marginBottom={20}
          fontSize={20}
          color="#474d66"
          fontWeight="border"
        >
          {title}
        </Heading>
        <Pane display="flex">
          <Heading
            marginBottom={20}
            fontSize={20}
            color="#474d66"
            fontWeight="border"
          >
            {`${percentageNumberFixed}%`}
          </Heading>
          {done ? (
            <TickCircleIcon
              marginLeft={8}
              size={22}
              color={selectTickCircleIconColor()}
            />
          ) : null}
        </Pane>
      </Pane>
      <Card background="gray75" height={30}>
        <Card
          className={selectProgressCardStyle()}
          height={30}
          width={`${percentageNumber}%`}
        ></Card>
      </Card>
    </>
  );
}

FileProgress.propTypes = {
  title: PropTypes.string.isRequired,
  percentage: PropTypes.number.isRequired,
  done: PropTypes.bool.isRequired,
  theme: PropTypes.string,
};

//////////////////////// MainCard ///////////////////////////////////

export function MainCard() {
  const TAG = "$FileUploaderCard";

  const [step, setStep] = React.useState("default");
  const [files, setFiles] = React.useState([]);
  const [fileRejections, setFileRejections] = React.useState([]);
  const [sendCode, setSendCode] = React.useState("");
  const [sendPercentage, setSendPercentage] = React.useState(0);
  const [sendFileDone, setSendFileDone] = React.useState(false);
  const [receivePercentage, setReceivePercentage] = React.useState(0);
  const [receiveFileDone, setReceiveFileDone] = React.useState(false);

  const handleChange = React.useCallback((fs) => {
    setFiles([fs[0]]);
    setStep("confirmSendFile");
  }, []);
  const handleRejected = React.useCallback(
    (fileRejections) => setFileRejections([fileRejections[0]]),
    [],
  );
  const handleRemove = React.useCallback(() => {
    setFiles([]);
    setFileRejections([]);
    setStep("default");
  }, []);
  const renderFile = React.useCallback((file) => {
    const { name, size, type } = file;
    const fileRejection = fileRejections.find(
      (fileRejection) => fileRejection.file === file,
    );
    const { message } = fileRejection || {};

    return (
      <Pane key={name}>
        <FileCard
          isInvalid={fileRejection != null}
          name={name}
          onRemove={handleRemove}
          sizeInBytes={size}
          type={type}
          validationMessage={message}
        />
      </Pane>
    );
  }, []);

  const onStartSend = () => {
    if (step !== "sending") {
      setSendFileDone(false);
      setSendPercentage(0);
      setStep("sending");
    }
  };

  const onSendSuccess = () => {
    toaster.success("File sent successfully!", {
      duration: 3,
    });
    setSendFileDone(true);
  };

  const onSendError = () => {
    toaster.danger("Receive File Error", {
      duration: 3,
    });
    // TODO: Error Display //////////////////////////////////////
    ///////////////////////////////////////////////////////
  };

  const onSendProgress = (progress) => {
    setSendPercentage(progress);
  };

  const onSend = (sendCode) => {
    setStep("waitingSendFile");
    setSendCode(sendCode);

    fileSender.send(files[0], {
      startSendCallback: onStartSend,
      successCallback: onSendSuccess,
      errorCallback: onSendError,
      progressCallback: onSendProgress,
    });
  };

  const onClickSendCodeBox = () => {
    if (!ClipboardJS.isSupported()) {
      toaster.danger("Your browser does not support click copy strings.", {
        duration: 1,
      });
      return;
    }

    const clipboard = new ClipboardJS("#send-code-box");
    clipboard.on("success", function (e) {
      Log.info(TAG, "Action:", e.action);
      Log.info(TAG, "Text:", e.text);
      Log.info(TAG, "Trigger:", e.trigger);

      e.clearSelection();

      toaster.success("Code successfully copied to clipboard.", {
        duration: 1,
      });
      clipboard.destroy();
    });

    clipboard.on("error", function (e) {
      Log.error(TAG, "Action:", e.action);
      Log.error(TAG, "Trigger:", e.trigger);

      toaster.danger("Cannot copy code to clipboard.", {
        duration: 1,
      });
      clipboard.destroy();
    });
  };

  const onTrashSendCode = () => {
    setSendCode("");
    setStep("default");
    setFiles([]);
  };

  const onReceiveSuccess = () => {
    setReceivePercentage(100);
    setReceiveFileDone(true);
    toaster.success("File received successfully!", {
      duration: 3,
    });
  };

  const onReceiveError = () => {
    toaster.danger("Receive File Error", {
      duration: 3,
    });

    // TODO: Error Display //////////////////////////////////////
    ///////////////////////////////////////////////////////
  };

  const onReceiveProgress = (progress) => {
    setReceivePercentage(progress);
  };

  const onStartReceive = () => {
    setStep("receiving");
  };

  return (
    <>
      <Pane maxWidth={900}>
        {step === "default" || step === "confirmSendFile" ? (
          <Card>
            <Heading fontSize={30} marginBottom={18}>
              Send File
            </Heading>
            <Pre fontSize={20} marginBottom={5} color="#696f8c">
              You can send one file, and there is no limit on file size !
            </Pre>
            <FileUploader
              height={400}
              maxFiles={1}
              onChange={handleChange}
              onRejected={handleRejected}
              renderFile={renderFile}
              values={files}
            />
            {step === "confirmSendFile" ? (
              <SendFileButton onSend={onSend}></SendFileButton>
            ) : null}
          </Card>
        ) : null}

        {step === "default" ? (
          <Card height={200} marginTop={50}>
            <Heading fontSize={30} marginBottom={18}>
              Receive File
            </Heading>
            <Pre fontSize={20} marginBottom={10} color="#696f8c">
              Accept files by inputting code.
            </Pre>
            <ReceiveFileFeild
              onReceiveSuccess={onReceiveSuccess}
              onReceiveError={onReceiveError}
              onStartReceive={onStartReceive}
              onReceiveProgress={onReceiveProgress}
            ></ReceiveFileFeild>
          </Card>
        ) : null}

        {step === "waitingSendFile" ? (
          <Pane>
            <Pane display="flex" justifyContent="space-between">
              <Heading
                marginBottom={20}
                fontSize={20}
                color="#474d66"
                fontWeight="border"
              >
                Click to copy your file code.
              </Heading>
              <Button
                intent="info"
                size="medium"
                padding={1}
                onClick={onTrashSendCode}
              >
                <TrashIcon color="#474d66" />
              </Button>
            </Pane>
            <Card
              id="send-code-box"
              background="gray75"
              display="flex"
              alignItems="center"
              padding={30}
              style={{
                cursor: "pointer",
              }}
              onClick={onClickSendCodeBox}
              data-clipboard-text={sendCode}
            >
              <Heading fontSize={50} fontWeight="bolder" margin="auto">
                {sendCode}
              </Heading>
            </Card>
          </Pane>
        ) : null}

        {step === "sending" ? (
          <FileProgress
            title="Send Progress"
            percentage={sendPercentage}
            done={sendFileDone}
            theme="blue"
          ></FileProgress>
        ) : null}

        {step === "receiving" ? (
          <FileProgress
            title="Receive Progress"
            percentage={receivePercentage}
            done={receiveFileDone}
          ></FileProgress>
        ) : null}
      </Pane>
    </>
  );
}
