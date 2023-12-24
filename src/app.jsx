import React from "react";
import { MainCard } from "./main-card.jsx";

export function App() {
  const styles = {
    fileUploader: {
      position: "absolute",
      width: "900px",
      top: "35%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    },
  };

  return (
    <>
      <div style={styles.fileUploader}>
        <MainCard></MainCard>
      </div>
    </>
  );
}
