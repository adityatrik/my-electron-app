const { app, BrowserWindow } = require('electron')

const url = require('url');
const path = require('path');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  })

  win.loadURL(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow()
})