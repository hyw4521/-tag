// 全局变量
let currentVideoFile = null;
let tags = [];
let mediaRecorder = null;
let audioChunks = [];
let currentTagId = null;

// DOM 元素
const videoPlayer = document.getElementById('videoPlayer');
const playbackRate = document.getElementById('playbackRate');
const skipBackwardBtn = document.getElementById('skipBackwardBtn');
const skipForwardBtn = document.getElementById('skipForwardBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const openFileBtn = document.getElementById('openFileBtn');
const openFolderBtn = document.getElementById('openFolderBtn');
const videoFileInput = document.getElementById('videoFile');
const tagDescription = document.getElementById('tagDescription');
const addTagBtn = document.getElementById('addTagBtn');
const tagsList = document.getElementById('tagsList');
const folderContents = document.getElementById('folderContents');
const folderPath = document.getElementById('folderPath');

// 标签笔记模态框相关元素
const tagNoteModal = new bootstrap.Modal(document.getElementById('tagNoteModal'));
const tagNoteText = document.getElementById('tagNoteText');
const startRecordingBtn = document.getElementById('startRecordingBtn');
const stopRecordingBtn = document.getElementById('stopRecordingBtn');
const audioPlayer = document.getElementById('audioPlayer');
const saveTagNoteBtn = document.getElementById('saveTagNoteBtn');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadTags();
    setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
    // 播放速度控制
    playbackRate.addEventListener('change', () => {
        videoPlayer.playbackRate = parseFloat(playbackRate.value);
    });

    // 快进快退
    skipBackwardBtn.addEventListener('click', () => {
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
    });

    skipForwardBtn.addEventListener('click', () => {
        videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 10);
    });

    // 截图
    screenshotBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoPlayer.videoWidth;
        canvas.height = videoPlayer.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
        
        const link = document.createElement('a');
        link.download = `screenshot_${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });

    // 文件选择
    openFileBtn.addEventListener('click', () => {
        videoFileInput.click();
    });

    videoFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const filePath = await window.electron.getFilePath(file.path);
                await handleOpenFile(filePath);
            } catch (error) {
                console.error('Error opening file:', error);
                alert('无法打开文件: ' + error.message);
            }
        }
    });

    openFolderBtn.addEventListener('click', async () => {
        try {
            const folderPath = await window.electron.ipcRenderer.invoke('select-directory');
            if (folderPath) {
                await displayFolderContents(folderPath);
            }
        } catch (error) {
            console.error('Error opening folder:', error);
            alert('无法打开文件夹: ' + error.message);
        }
    });

    // 标签相关
    addTagBtn.addEventListener('click', handleAddTag);

    // 录音相关
    startRecordingBtn.addEventListener('click', startRecording);
    stopRecordingBtn.addEventListener('click', stopRecording);
    saveTagNoteBtn.addEventListener('click', saveTagNote);

    // 视频播放器事件
    videoPlayer.addEventListener('error', (e) => {
        console.error('视频播放器错误:', e);
        alert('视频播放出错: ' + (videoPlayer.error?.message || '未知错误'));
    });
    
    videoPlayer.addEventListener('waiting', () => {
        console.log('视频正在缓冲...');
    });
    
    videoPlayer.addEventListener('playing', () => {
        console.log('视频开始播放');
    });
}

// 处理打开文件
async function handleOpenFile(filePath) {
    try {
        currentVideoFile = filePath;
        
        // 重置视频播放器状态
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
        
        // 设置新的视频源
        videoPlayer.src = `file://${filePath}`;
        
        // 等待视频加载完成
        await new Promise((resolve, reject) => {
            videoPlayer.onloadeddata = resolve;
            videoPlayer.onerror = reject;
            
            // 设置超时
            const timeout = setTimeout(() => {
                reject(new Error('视频加载超时'));
            }, 10000);
            
            videoPlayer.onloadeddata = () => {
                clearTimeout(timeout);
                resolve();
            };
        });
        
        // 尝试播放视频
        try {
            await videoPlayer.play();
        } catch (playError) {
            console.warn('自动播放失败，等待用户交互:', playError);
            // 不抛出错误，让用户手动点击播放
        }
        
        renderTags();
    } catch (error) {
        console.error('Error opening file:', error);
        alert('无法打开文件: ' + error.message);
    }
}

// 显示文件夹内容
async function displayFolderContents(folderPath) {
    try {
        const files = await window.electron.fs.readdir(folderPath);
        folderContents.innerHTML = '';
        
        // 更新面包屑导航
        const pathParts = folderPath.split(window.electron.path.sep);
        folderPath.innerHTML = '';
        let currentPath = '';
        
        pathParts.forEach((part, index) => {
            if (part) {
                currentPath += (index === 0 ? '' : window.electron.path.sep) + part;
                const li = document.createElement('li');
                li.className = 'breadcrumb-item' + (index === pathParts.length - 1 ? ' active' : '');
                li.innerHTML = index === pathParts.length - 1 ? part : `<a href="#" data-path="${currentPath}">${part}</a>`;
                folderPath.appendChild(li);
            }
        });

        // 显示文件列表
        for (const file of files) {
            const filePath = window.electron.path.join(folderPath, file);
            const stats = await window.electron.fs.stat(filePath);
            
            if (stats.isDirectory() || file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.avi')) {
                const item = document.createElement('div');
                item.className = 'folder-item';
                item.innerHTML = `
                    <i class="bi ${stats.isDirectory() ? 'bi-folder' : 'bi-file-earmark-play'}"></i>
                    <span>${file}</span>
                `;
                
                item.addEventListener('click', async () => {
                    if (stats.isDirectory()) {
                        await displayFolderContents(filePath);
                    } else {
                        await handleOpenFile(filePath);
                    }
                });
                
                folderContents.appendChild(item);
            }
        }
    } catch (error) {
        console.error('Error displaying folder contents:', error);
        alert('无法显示文件夹内容: ' + error.message);
    }
}

// 处理添加标签
function handleAddTag() {
    const description = tagDescription.value.trim();
    if (!description || !currentVideoFile) return;

    const tag = {
        id: Date.now(),
        videoFile: currentVideoFile,
        description,
        timestamp: videoPlayer.currentTime,
        note: '',
        audioNote: null
    };

    tags.push(tag);
    saveTags();
    renderTags();
    tagDescription.value = '';
}

// 渲染标签列表
function renderTags() {
    tagsList.innerHTML = '';
    const currentTags = tags.filter(tag => tag.videoFile === currentVideoFile);
    
    currentTags.forEach(tag => {
        const item = document.createElement('div');
        item.className = 'list-group-item';
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <span class="badge bg-primary me-2">${formatTime(tag.timestamp)}</span>
                    <span>${tag.description}</span>
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary toggle-notes" data-id="${tag.id}">
                        <i class="bi bi-chevron-down"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary edit-tag" data-id="${tag.id}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-tag" data-id="${tag.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            <div class="tag-notes mt-2 d-none" id="notes-${tag.id}">
                <div class="text-note mb-2">${tag.note || '无文本笔记'}</div>
                <div class="audio-note">
                    ${tag.audioNote ? `
                        <div class="audio-player-wrapper">
                            <audio controls class="w-100">
                                <source src="" type="audio/wav">
                                您的浏览器不支持音频播放
                            </audio>
                        </div>
                    ` : '无语音笔记'}
                </div>
            </div>
        `;

        // 切换笔记显示
        item.querySelector('.toggle-notes').addEventListener('click', async (e) => {
            e.preventDefault();
            const notesDiv = item.querySelector(`#notes-${tag.id}`);
            const icon = e.currentTarget.querySelector('i');
            
            if (notesDiv.classList.contains('d-none')) {
                notesDiv.classList.remove('d-none');
                icon.classList.replace('bi-chevron-down', 'bi-chevron-up');
                
                // 加载音频
                if (tag.audioNote) {
                    try {
                        const audioData = await window.electronAPI.readAudio(tag.audioNote);
                        if (audioData) {
                            const audioElement = notesDiv.querySelector('audio');
                            if (audioElement) {
                                audioElement.src = audioData;
                                // 确保音频控件可见
                                audioElement.controls = true;
                                audioElement.style.display = 'block';
                            }
                        }
                    } catch (error) {
                        console.error('加载音频失败:', error);
                    }
                }
            } else {
                notesDiv.classList.add('d-none');
                icon.classList.replace('bi-chevron-up', 'bi-chevron-down');
            }
        });

        // 编辑标签
        item.querySelector('.edit-tag').addEventListener('click', () => {
            openTagNoteModal(tag);
        });

        // 删除标签
        item.querySelector('.delete-tag').addEventListener('click', () => {
            deleteTag(tag.id);
        });

        // 点击标签跳转到对应时间点
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-group') && !e.target.closest('.tag-notes')) {
                videoPlayer.currentTime = tag.timestamp;
            }
        });

        tagsList.appendChild(item);
    });
}

// 打开标签笔记模态框
async function openTagNoteModal(tag) {
    currentTagId = tag.id;
    tagNoteText.value = tag.note || '';
    
    // 重置音频播放器状态
    const audioElement = audioPlayer.querySelector('audio');
    audioElement.src = '';
    audioPlayer.classList.add('d-none');
    
    if (tag.audioNote) {
        try {
            const audioData = await window.electronAPI.readAudio(tag.audioNote);
            if (audioData) {
                audioPlayer.classList.remove('d-none');
                audioElement.src = audioData;
            }
        } catch (error) {
            console.error('加载音频失败:', error);
        }
    }
    
    tagNoteModal.show();
}

// 开始录音
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audioElement = audioPlayer.querySelector('audio');
            audioElement.src = audioUrl;
            audioPlayer.classList.remove('d-none');
            console.log('录音完成，音频URL已设置');
        };

        mediaRecorder.start();
        startRecordingBtn.disabled = true;
        stopRecordingBtn.disabled = false;
        console.log('开始录音');
    } catch (error) {
        console.error('开始录音失败:', error);
        alert('无法开始录音: ' + error.message);
    }
}

// 停止录音
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        startRecordingBtn.disabled = false;
        stopRecordingBtn.disabled = true;
        console.log('停止录音');
    }
}

// 保存标签笔记
async function saveTagNote() {
    if (!currentTagId) return;

    const tag = tags.find(t => t.id === currentTagId);
    if (tag) {
        tag.note = tagNoteText.value;

        const audioElement = audioPlayer.querySelector('audio');
        if (audioElement.src && (audioElement.src.startsWith('blob:') || audioElement.src.startsWith('data:'))) {
            const fileName = `audio_${tag.id}.wav`;
            try {
                // 如果是 blob:，需要转成 base64
                let audioData = audioElement.src;
                if (audioData.startsWith('blob:')) {
                    audioData = await fetch(audioData)
                        .then(res => res.blob())
                        .then(blob => new Promise(resolve => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        }));
                }
                const savedPath = await window.electronAPI.saveAudio(audioData, fileName);
                tag.audioNote = fileName;
                audioPlayer.classList.remove('d-none');
            } catch (error) {
                console.error('保存音频笔记失败:', error);
                alert('保存音频笔记失败: ' + error.message);
            }
        }

        try {
            await saveTags();
            renderTags();
            setTimeout(() => {
                const notesDiv = document.getElementById(`notes-${currentTagId}`);
                const toggleBtn = document.querySelector(`.toggle-notes[data-id='${currentTagId}']`);
                if (notesDiv && toggleBtn && notesDiv.classList.contains('d-none')) {
                    toggleBtn.click();
                }
                tagNoteModal.hide();
            }, 100);
        } catch (error) {
            console.error('保存标签失败:', error);
            alert('保存标签失败: ' + error.message);
        }
    }
}

// 删除标签
async function deleteTag(tagId) {
    const tag = tags.find(t => t.id === tagId);
    if (tag && tag.audioNote) {
        try {
            // 删除音频文件
            await window.electronAPI.deleteAudio(tag.audioNote);
            console.log('音频文件删除成功:', tag.audioNote);
        } catch (error) {
            console.error('删除音频文件失败:', error);
            // 即使删除音频文件失败，也继续删除标签
        }
    }
    
    // 从标签数组中删除
    tags = tags.filter(tag => tag.id !== tagId);
    await saveTags();
    renderTags();
}

// 保存标签
async function saveTags() {
    try {
        await window.electron.saveData('tags', tags);
    } catch (error) {
        console.error('Error saving tags:', error);
        alert('无法保存标签: ' + error.message);
    }
}

// 加载标签
async function loadTags() {
    try {
        const savedTags = await window.electron.loadData('tags');
        if (savedTags) {
            tags = savedTags;
            renderTags();
        }
    } catch (error) {
        console.error('Error loading tags:', error);
        alert('无法加载标签: ' + error.message);
    }
}

// 格式化时间
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// 文件选择按钮点击事件
document.getElementById('selectFileBtn').addEventListener('click', async () => {
    try {
        const filePaths = await window.electronAPI.selectFiles();
        if (filePaths && filePaths.length > 0) {
            const filePath = filePaths[0];
            const fileName = filePath.split('/').pop();
            currentVideo = {
                path: filePath,
                name: fileName
            };
            videoPlayer.src = `file://${filePath}`;
            videoPlayer.load();
            updateVideoInfo();
            loadTags();
        }
    } catch (error) {
        console.error('选择文件失败:', error);
        alert('选择文件失败: ' + error.message);
    }
});

// 文件夹选择按钮点击事件
document.getElementById('selectFolderBtn').addEventListener('click', async () => {
    try {
        const folderPath = await window.electronAPI.selectDirectory();
        if (folderPath) {
            currentFolder = folderPath;
            await loadFolderContents(folderPath);
        }
    } catch (error) {
        console.error('选择文件夹失败:', error);
        alert('选择文件夹失败: ' + error.message);
    }
});

// 加载文件夹内容
async function loadFolderContents(folderPath) {
    try {
        const files = await window.electronAPI.readFile(folderPath);
        const videoFiles = files.filter(file => 
            file.isFile() && 
            ['.mp4', '.webm', '.ogg', '.mkv', '.avi', '.mov'].includes(path.extname(file.name).toLowerCase())
        );
        
        if (videoFiles.length === 0) {
            alert('所选文件夹中没有视频文件');
            return;
        }
        
        // 更新文件夹浏览器
        updateFolderBrowser(folderPath, videoFiles);
        
        // 自动加载第一个视频
        if (videoFiles.length > 0) {
            const firstVideo = videoFiles[0];
            currentVideo = {
                path: path.join(folderPath, firstVideo.name),
                name: firstVideo.name
            };
            videoPlayer.src = `file://${currentVideo.path}`;
            videoPlayer.load();
            updateVideoInfo();
            loadTags();
        }
    } catch (error) {
        console.error('加载文件夹内容失败:', error);
        alert('加载文件夹内容失败: ' + error.message);
    }
}

// 更新文件夹浏览器
function updateFolderBrowser(folderPath, files) {
    const folderBrowser = document.getElementById('folderBrowser');
    folderBrowser.innerHTML = '';
    
    // 添加面包屑导航
    const breadcrumb = document.createElement('nav');
    breadcrumb.setAttribute('aria-label', 'breadcrumb');
    breadcrumb.innerHTML = `
        <ol class="breadcrumb">
            <li class="breadcrumb-item"><a href="#" data-path="${folderPath}">${path.basename(folderPath)}</a></li>
        </ol>
    `;
    folderBrowser.appendChild(breadcrumb);
    
    // 添加文件列表
    const fileList = document.createElement('div');
    fileList.className = 'list-group';
    
    files.forEach(file => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action folder-item';
        item.innerHTML = `
            <i class="bi bi-file-play"></i>
            ${file.name}
        `;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const filePath = path.join(folderPath, file.name);
            currentVideo = {
                path: filePath,
                name: file.name
            };
            videoPlayer.src = `file://${filePath}`;
            videoPlayer.load();
            updateVideoInfo();
            loadTags();
        });
        fileList.appendChild(item);
    });
    
    folderBrowser.appendChild(fileList);
} 