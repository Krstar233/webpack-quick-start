import { FileReceiver, FileSender } from "./file-conn";

async function sandboxMain() {
  const fileSender = new FileSender();
  const roomID = await fileSender.createRoom();
  const fileReceiver = new FileReceiver();
  await fileReceiver.joinRoom(roomID);
  fileReceiver.close();
  fileSender.close();
}

// sandboxMain();
