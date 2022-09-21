import React from "react";
import ReactDOM from "react-dom";

const clickHandler = async () => {
  const result = await window.myApp.sayHello("I'm React!");
  console.log(result);
};

ReactDOM.render(
  <div>
    <h1>React App</h1>
    <button onClick={clickHandler}>Click</button>
  </div>,
  document.getElementById("root")
);
