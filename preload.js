const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, func) => {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        },
        removeListener: (channel, func) => {
            ipcRenderer.removeListener(channel, func);
        }
    },
    fs: {
        readdir: (dirPath) => fs.promises.readdir(dirPath),
        stat: (filePath) => fs.promises.stat(filePath),
        readFile: (filePath) => fs.promises.readFile(filePath),
        writeFile: (filePath, data) => fs.promises.writeFile(filePath, data)
    },
    path: {
        join: (...args) => path.join(...args),
        basename: (filePath) => path.basename(filePath),
        dirname: (filePath) => path.dirname(filePath),
        sep: path.sep
    },
    getFilePath: (filePath) => ipcRenderer.invoke('get-file-path', filePath),
    saveData: (type, data) => ipcRenderer.invoke('save-data', { type, data }),
    loadData: (type) => ipcRenderer.invoke('load-data', type)
}); 