1- Install Components

```
npx create-electron-app my-app --template=webpack
npm install --save-dev @babel/core @babel/preset-react babel-loader
npm install --save react react-dom
```

2- Update Webpack Rules

```
module.exports = [
...
{
    test: /\.jsx?$/,
    use: {
        loader: 'babel-loader',
        options: {
            exclude: /node_modules/,
            presets: ['@babel/preset-react']
        }
    }
},
];
```

3- Update src/index.html file

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Your title can go here ...</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

4- Update src/renderer.js file

```js
// Import the required files inside the index.js
import "./App.jsx";
import "./index.css";
```

5- create src/App.jsx file

```js
import React from "react";
import ReactDOM from "react-dom";
ReactDOM.render(
  <div>
    <h2>Hello from React in Electron!</h2>
  </div>,
  document.getElementById("root")
);
```

6- For React(renderer) - Node(main) IPC communication create src/preload.js

```JS
const { ipcRenderer, contextBridge } = require("electron");
const { platform } = require("os");
// can be accessed through window.app
contextBridge.exposeInMainWorld('app', {
        platform: platform(), // create a property oj the app object for
        platform
    }
)
```

Update main.js

```js
const mainWindow = new BrowserWindow({
  // This is needed for safe-cross process communication with ipc
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
  },
});
```
