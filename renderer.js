const { ipcRenderer } = require('electron');
const React = require('react');
const ReactDOM = require('react-dom/client');
const ReactFlow = require('reactflow').ReactFlow;
const { Controls, applyNodeChanges, applyEdgeChanges, addEdge } = require('reactflow');
require('reactflow/dist/style.css');

let currentPdfPath = null;
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionArea = null;
let currentPageCanvas = null;

// React App Component
function App() {
    const [nodes, setNodes] = React.useState([]);
    const [edges, setEdges] = React.useState([]);
    const [pdfPages, setPdfPages] = React.useState([]);
    const [currentPageIndex, setCurrentPageIndex] = React.useState(0);

    const pdfViewerRef = React.useRef(null);

    const onDragOver = React.useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = React.useCallback((event) => {
        event.preventDefault();

        const reactFlowBounds = event.target.getBoundingClientRect();
        const position = {
             x: event.clientX - reactFlowBounds.left,
             y: event.clientY - reactFlowBounds.top,
        };

        const draggedData = JSON.parse(event.dataTransfer.getData('application/json'));

        if (draggedData && draggedData.type === 'pdf-selection') {
            const newNode = {
                id: Date.now().toString(),
                type: 'default',
                position,
                data: {
                    label: draggedData.text,
                    image: draggedData.imageData
                },
            };
            setNodes((nds) => nds.concat(newNode));
        }

    }, [setNodes]);

    const openPdf = async () => {
        const filePath = await ipcRenderer.invoke('select-pdf');
        if (filePath) {
            currentPdfPath = filePath;
            await loadPdfDocument(filePath);
        }
    };

    const loadPdfDocument = async (filePath) => {
        try {
            await renderPdfPage(filePath, 1);
        } catch (error) {
            console.error('Error loading PDF document:', error);
        }
    };

    const renderPdfPage = async (filePath, pageNumber) => {
        try {
            const imageDataUrl = await ipcRenderer.invoke('render-pdf-page', {
                filePath: filePath,
                pageNumber: pageNumber
            });

            const img = new Image();
            img.onload = () => {
                const pdfViewer = pdfViewerRef.current;
                 if (pdfViewer) {
                    pdfViewer.innerHTML = '';
                    pdfViewer.appendChild(img);

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    ctx.drawImage(img, 0, 0);
                    currentPageCanvas = canvas;

                    img.addEventListener('mousedown', startSelection);
                    img.addEventListener('mousemove', updateSelection);
                    img.addEventListener('mouseup', endSelection);
                 }
            };
            img.src = imageDataUrl;

        } catch (error) {
            console.error('Error rendering PDF page:', error);
        }
    };

    const startSelection = (e) => {
        if (e.target.tagName !== 'IMG' || !currentPageCanvas) return;

        isSelecting = true;
        const rect = e.target.getBoundingClientRect();
        selectionStart = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        selectionArea = document.createElement('div');
        selectionArea.className = 'selection-area';
        selectionArea.style.position = 'absolute';
        selectionArea.style.border = '2px solid #4CAF50';
        selectionArea.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        selectionArea.style.pointerEvents = 'none';
        selectionArea.style.left = `${selectionStart.x}px`;
        selectionArea.style.top = `${selectionStart.y}px`;
        selectionArea.style.width = `0px`;
        selectionArea.style.height = `0px`;

        e.target.parentNode.appendChild(selectionArea);
    };

    const updateSelection = (e) => {
        if (!isSelecting || e.target.tagName !== 'IMG') return;

        const rect = e.target.getBoundingClientRect();
        const current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        const left = Math.min(selectionStart.x, current.x);
        const top = Math.min(selectionStart.y, current.y);
        const width = Math.abs(current.x - selectionStart.x);
        const height = Math.abs(current.y - selectionStart.y);

        if (selectionArea) {
            selectionArea.style.left = `${left}px`;
            selectionArea.style.top = `${top}px`;
            selectionArea.style.width = `${width}px`;
            selectionArea.style.height = `${height}px`;
        }
    };

    const endSelection = async (e) => {
        if (!isSelecting || e.target.tagName !== 'IMG' || !currentPageCanvas) return;
        isSelecting = false;

        if (selectionArea) {
             const img = e.target;
             const imgRect = img.getBoundingClientRect();
             const scaleX = img.naturalWidth / imgRect.width;
             const scaleY = img.naturalHeight / imgRect.height;

             const selectionRect = {
                 x: (parseFloat(selectionArea.style.left)) * scaleX,
                 y: (parseFloat(selectionArea.style.top)) * scaleY,
                 width: parseFloat(selectionArea.style.width) * scaleX,
                 height: parseFloat(selectionArea.style.height) * scaleY
             };

             const cropCanvas = document.createElement('canvas');
             const cropCtx = cropCanvas.getContext('2d');
             cropCanvas.width = selectionRect.width;
             cropCanvas.height = selectionRect.height;

              if (currentPageCanvas) {
                  cropCtx.drawImage(
                      currentPageCanvas,
                      selectionRect.x,
                      selectionRect.y,
                      selectionRect.width,
                      selectionRect.height,
                      0,
                      0,
                      cropCanvas.width,
                      cropCanvas.height
                  );

                  const imageDataUrl = cropCanvas.toDataURL();

                   const text = await ipcRenderer.invoke('perform-ocr', { imageData: imageDataUrl });

                   selectionArea.style.pointerEvents = 'auto';
                   selectionArea.setAttribute('draggable', true);
                   selectionArea.addEventListener('dragstart', (dragEvent) => {
                       const dataToTransfer = {
                           type: 'pdf-selection',
                           text: text,
                           imageData: imageDataUrl
                       };
                       dragEvent.dataTransfer.setData('application/json', JSON.stringify(dataToTransfer));
                        dragEvent.dataTransfer.effectAllowed = 'move';
                   });

                   selectionArea.style.cursor = 'grab';

              }

        }
    };

    const saveMindmap = async () => {
        await ipcRenderer.invoke('save-mindmap', { data: { nodes, edges } });
    };

    const nodeTypes = React.useMemo(() => ({
        default: ({ data }) => (
            <div style={{ border: '1px solid #ddd', padding: 10, borderRadius: 5, background: '#fff' }}>
                {data.image && <img src={data.image} alt="selection" style={{ maxWidth: 200, maxHeight: 150, marginBottom: 5 }} />}
                <div>{data.label}</div>
            </div>
        ),
    }), []);

    React.useEffect(() => {
        const openPdfButton = document.getElementById('openPdf');
        if (openPdfButton) {
            openPdfButton.addEventListener('click', openPdf);
        }

        const saveMindmapButton = document.getElementById('saveMindmap');
         if (saveMindmapButton) {
             saveMindmapButton.addEventListener('click', saveMindmap);
         }

        return () => {
            if (openPdfButton) {
                openPdfButton.removeEventListener('click', openPdf);
            }
             if (saveMindmapButton) {
                saveMindmapButton.removeEventListener('click', saveMindmap);
            }
        };
    }, []);

    return (
        <div id="app">
            <div className="toolbar">
                <button id="openPdf">打开 PDF</button>
                <button id="saveMindmap">保存思维导图</button>
            </div>
            <div className="main-container">
                <div className="pdf-sidebar">
                    <div className="pdf-viewer" ref={pdfViewerRef}>
                    </div>
                </div>

                <div
                    id="mindmap-container"
                    className="mindmap-container"
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                >
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={(changes) => setNodes((nds) => applyNodeChanges(changes, nds))}
                        onEdgesChange={(changes) => setEdges((eds) => applyEdgeChanges(changes, eds))}
                        onConnect={(connection) => setEdges((eds) => addEdge(connection, eds))}
                        nodeTypes={nodeTypes}
                        fitView
                    >
                        <Controls />
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
}

const container = document.getElementById('app');
const root = ReactDOM.createRoot(container);
root.render(<App />); 