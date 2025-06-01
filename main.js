const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// 确保数据目录存在
const userDataPath = path.join(app.getPath('userData'), 'data');
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');

    // 开发时打开开发者工具
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

// 处理文件选择
ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Videos', extensions: ['mp4', 'webm', 'ogg', 'mkv', 'avi', 'mov'] }
        ]
    });
    return result.filePaths;
});

// 处理获取文件路径
ipcMain.handle('get-file-path', async (event, filePath) => {
    return filePath;
});

// 处理文件夹选择
ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});

// 处理文件读取
ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const data = await fs.promises.readFile(filePath);
        return data;
    } catch (error) {
        console.error('Error reading file:', error);
        throw error;
    }
});

// 处理文件保存
ipcMain.handle('save-file', async (event, { filePath, data }) => {
    try {
        await fs.promises.writeFile(filePath, data);
        return true;
    } catch (error) {
        console.error('Error saving file:', error);
        throw error;
    }
});

// 保存数据
ipcMain.handle('save-data', async (event, { type, data }) => {
    try {
        const filePath = path.join(userDataPath, `${type}.json`);
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving data:', error);
        throw error;
    }
});

// 加载数据
ipcMain.handle('load-data', async (event, type) => {
    try {
        const filePath = path.join(userDataPath, `${type}.json`);
        if (fs.existsSync(filePath)) {
            const data = await fs.promises.readFile(filePath, 'utf8');
            return JSON.parse(data);
        }
        return null;
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}); 