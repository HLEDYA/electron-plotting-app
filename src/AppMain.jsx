import React, { useState } from "react";
import TimeSeriesChart from "./components/TimeSeriesChart.jsx";
import FileReader from "./components/FileReader.jsx";

const AppMain = () => {
  const [dataReady, setDataReady] = useState(false);
  const [rcvdData, setRcvdData] = useState([]);

  const dataReadHandler = (data) => {
    console.log("Data Received");
    console.log(data);
    setRcvdData(data);
    setDataReady(true);
  };

  return (
    <div>
      <h1>Plotting App</h1>
      {dataReady && <TimeSeriesChart rcvdData={rcvdData} />}
      {!dataReady && <FileReader onDataRead={dataReadHandler} />}
    </div>
  );
};

export default AppMain;
