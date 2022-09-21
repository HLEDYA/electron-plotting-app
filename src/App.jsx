import React from "react";
import ReactDOM from "react-dom";
import TimeSeriesChart from "./components/TimeSeriesChart.jsx";

const clickHandler = async () => {
  const result = await window.myApp.sayHello("I'm React!");
  console.log(result);
};

ReactDOM.render(
  <div>
    <h1>Plotting App</h1>
    <TimeSeriesChart />
    <button onClick={clickHandler}>Click</button>
  </div>,
  document.getElementById("root")
);
