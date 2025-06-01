# 网页视频播放器接口文档

## 视频播放器接口

### 1. 视频文件操作
```javascript
// 打开本地视频文件
function openLocalVideo(file) {
    // 参数：file - File对象
    // 返回：Promise<void>
}

// 获取当前视频信息
function getVideoInfo() {
    // 返回：{
    //     duration: number,    // 视频总时长（秒）
    //     currentTime: number, // 当前播放时间（秒）
    //     fileName: string,    // 视频文件名
    //     playbackRate: number // 当前播放速度
    // }
}

// 设置播放速度
function setPlaybackRate(rate) {
    // 参数：rate - number (0.5 - 2.0)
    // 返回：void
}
```

### 2. 文件系统接口
```javascript
// 请求文件夹访问权限
async function requestFolderAccess() {
    // 返回：Promise<FileSystemDirectoryHandle>
}

// 获取文件夹内容
async function getFolderContents(dirHandle) {
    // 参数：dirHandle - FileSystemDirectoryHandle
    // 返回：Promise<Array<{
    //     name: string,
    //     type: 'file' | 'directory',
    //     handle: FileSystemHandle
    // }>>
}

// 打开文件夹中的视频文件
async function openVideoFromFolder(fileHandle) {
    // 参数：fileHandle - FileSystemFileHandle
    // 返回：Promise<void>
}

// 保存最近访问的文件夹路径
function saveRecentFolder(dirHandle) {
    // 参数：dirHandle - FileSystemDirectoryHandle
    // 返回：Promise<void>
}

// 获取最近访问的文件夹
function getRecentFolder() {
    // 返回：Promise<FileSystemDirectoryHandle | null>
}
```

### 3. 标签管理接口
```javascript
// 添加标签
function addTag(tag) {
    // 参数：tag - {
    //     time: number,    // 时间戳（秒）
    //     description: string, // 标签描述
    //     videoFileName: string // 关联的视频文件名
    // }
    // 返回：Promise<void>
}

// 删除标签
function deleteTag(tagId) {
    // 参数：tagId - string
    // 返回：Promise<void>
}

// 获取视频的所有标签
function getTags(videoFileName) {
    // 参数：videoFileName - string
    // 返回：Promise<Array<Tag>>
}

// 跳转到指定标签时间点
function jumpToTag(tag) {
    // 参数：tag - Tag对象
    // 返回：void
}
```

### 4. 数据存储接口
```javascript
// 保存标签数据
function saveTags(tags) {
    // 参数：tags - Array<Tag>
    // 返回：Promise<void>
}

// 加载标签数据
function loadTags() {
    // 返回：Promise<Array<Tag>>
}
```

## 数据结构

### Tag对象
```typescript
interface Tag {
    id: string;           // 标签唯一标识
    time: number;         // 时间戳（秒）
    description: string;  // 标签描述
    videoFileName: string; // 关联的视频文件名
    createdAt: Date;      // 创建时间
}
```

### 播放设置对象
```typescript
interface PlaybackSettings {
    rate: number;        // 播放速度
    volume: number;      // 音量
    muted: boolean;      // 是否静音
}
``` 