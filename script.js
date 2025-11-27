let originalImageData = null;
let processedImageData = null;
let currentTool = null;
let canvas = null;
let ctx = null;
let isVideoMode = false;
let videoFile = null;
let processedVideoBlob = null;
let videoProcessingMode = 'auto';
let selectedBackgroundColor = null;

const USE_REMOVEBG_API = true;
const REMOVEBG_API_KEY = 'z2bdovUZwzRxgBwWrRPqwMYm';

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const previewZone = document.getElementById('previewZone');
const editingZone = document.getElementById('editingZone');
const originalImage = document.getElementById('originalImage');
const resultImage = document.getElementById('resultImage');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const removeBtn = document.getElementById('removeBtn');

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
});

function setupEventListeners() {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);

    removeBtn.addEventListener('click', processImage);

    document.getElementById('eraseBtn').addEventListener('click', () => toggleTool('erase'));
    document.getElementById('refineBtn').addEventListener('click', () => toggleTool('refine'));
    document.getElementById('restoreBtn').addEventListener('click', () => toggleTool('restore'));
    document.getElementById('bgBtn').addEventListener('click', toggleBgOptions);

    document.getElementById('brushSize').addEventListener('input', (e) => {
        document.getElementById('brushSizeValue').textContent = e.target.value + 'px';
    });

    document.querySelectorAll('.color-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const color = e.target.dataset.color;
            applyBackgroundColor(color);
            document.querySelectorAll('.color-preset').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
        });
    });

    document.getElementById('colorPicker').addEventListener('change', (e) => {
        applyBackgroundColor(e.target.value);
    });

    document.getElementById('uploadBgBtn').addEventListener('click', () => {
        document.getElementById('bgImageInput').click();
    });
    document.getElementById('bgImageInput').addEventListener('change', applyBackgroundImage);

    document.getElementById('downloadBtn').addEventListener('click', () => downloadImage('png'));
    document.getElementById('downloadJpg').addEventListener('click', () => downloadImage('jpg'));
    document.getElementById('downloadWebp').addEventListener('click', () => downloadImage('webp'));
    document.getElementById('downloadPdf').addEventListener('click', () => downloadImage('pdf'));

    document.getElementById('startOverBtn').addEventListener('click', startOver);
    document.getElementById('editAgainBtn').addEventListener('click', editAgain);

    document.getElementById('removeVideoBtn').addEventListener('click', processVideo);
    document.getElementById('downloadVideoBtn').addEventListener('click', downloadVideo);
    document.getElementById('downloadVideoMp4').addEventListener('click', downloadVideoAsMp4);
    document.getElementById('startOverVideoBtn').addEventListener('click', startOver);

    document.getElementById('autoModeBtn').addEventListener('click', () => setVideoMode('auto'));
    document.getElementById('colorPickModeBtn').addEventListener('click', () => setVideoMode('colorPick'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.style.borderColor = '#1d4ed8';
    uploadZone.style.backgroundColor = '#eff6ff';
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.style.borderColor = '#2563eb';
    uploadZone.style.backgroundColor = '';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    if (file.type.match('video/(mp4|webm)')) {
        isVideoMode = true;
        videoFile = file;

        if (file.size > 50 * 1024 * 1024) {
            alert('Video file size must be less than 50MB.');
            return;
        }

        displayVideoPreview(file);
        return;
    }

    if (!file.type.match('image/(jpeg|png|webp)')) {
        alert('Please upload a JPG, PNG, WEBP image or MP4, WEBM video.');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert('Image file size must be less than 10MB.');
        return;
    }

    isVideoMode = false;

    const reader = new FileReader();
    reader.onload = (e) => {
        originalImageData = e.target.result;
        displayPreview();
    };
    reader.readAsDataURL(file);
}

function displayVideoPreview(file) {
    uploadZone.classList.add('hidden');
    document.getElementById('videoPreviewZone').classList.remove('hidden');

    const videoPreview = document.getElementById('videoPreview');
    videoPreview.src = URL.createObjectURL(file);

    setupVideoColorPicker();
}

function setVideoMode(mode) {
    videoProcessingMode = mode;

    const autoBtn = document.getElementById('autoModeBtn');
    const colorPickBtn = document.getElementById('colorPickModeBtn');
    const colorPickerInfo = document.getElementById('colorPickerInfo');
    const videoPickCanvas = document.getElementById('videoColorPickCanvas');

    if (mode === 'auto') {
        autoBtn.classList.add('active');
        colorPickBtn.classList.remove('active');
        colorPickerInfo.classList.add('hidden');
        videoPickCanvas.classList.add('hidden');
        selectedBackgroundColor = null;
    } else {
        autoBtn.classList.remove('active');
        colorPickBtn.classList.add('active');
        colorPickerInfo.classList.remove('hidden');
        videoPickCanvas.classList.remove('hidden');
    }
}

function setupVideoColorPicker() {
    const video = document.getElementById('videoPreview');
    const canvas = document.getElementById('videoColorPickCanvas');
    const ctx = canvas.getContext('2d');

    video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    });

    canvas.addEventListener('click', (e) => {
        if (videoProcessingMode !== 'colorPick') return;

        video.pause();

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];

        selectedBackgroundColor = { r, g, b };

        const colorHex = rgbToHex(r, g, b);
        document.getElementById('colorSwatch').style.backgroundColor = colorHex;
        document.getElementById('colorValue').textContent = colorHex;
        document.getElementById('selectedColorDisplay').classList.remove('hidden');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

async function removeBackgroundByColor(imageData, targetColor) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');

            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);

            const imageDataObj = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imageDataObj.data;
            const width = tempCanvas.width;
            const height = tempCanvas.height;

            const tolerance = 90;
            const edgeTolerance = 100;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const diff = colorDistance(r, g, b, targetColor.r, targetColor.g, targetColor.b);

                if (diff < tolerance) {
                    data[i + 3] = 0;
                } else if (diff < edgeTolerance) {
                    const alpha = ((diff - tolerance) / (edgeTolerance - tolerance)) * 255;
                    data[i + 3] = Math.floor(alpha);
                }
            }

            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    const alpha = data[idx + 3];

                    if (alpha > 0 && alpha < 255) {
                        const r = data[idx];
                        const g = data[idx + 1];
                        const b = data[idx + 2];

                        const spillAmount = 1 - (colorDistance(r, g, b, targetColor.r, targetColor.g, targetColor.b) / edgeTolerance);

                        if (spillAmount > 0) {
                            const targetMax = Math.max(targetColor.r, targetColor.g, targetColor.b);

                            if (targetColor.r === targetMax) {
                                data[idx] = Math.floor(r * (1 - spillAmount * 0.7));
                            }
                            if (targetColor.g === targetMax) {
                                data[idx + 1] = Math.floor(g * (1 - spillAmount * 0.7));
                            }
                            if (targetColor.b === targetMax) {
                                data[idx + 2] = Math.floor(b * (1 - spillAmount * 0.7));
                            }
                        }
                    }
                }
            }

            tempCtx.putImageData(imageDataObj, 0, 0);
            resolve(tempCanvas.toDataURL('image/png'));
        };
        img.src = imageData;
    });
}

function displayPreview() {
    uploadZone.classList.add('hidden');
    previewZone.classList.remove('hidden');
    originalImage.src = originalImageData;
    resultImage.src = originalImageData;
    loadingOverlay.classList.add('hidden');
}

async function processImage() {
    removeBtn.disabled = true;
    removeBtn.textContent = 'Processing...';
    loadingOverlay.classList.remove('hidden');
    loadingText.textContent = 'AI is analyzing your image...';

    await sleep(1500);
    loadingText.textContent = 'Removing background...';
    await sleep(2000);

    processedImageData = await simulateBackgroundRemoval(originalImageData);

    previewZone.classList.add('hidden');
    editingZone.classList.remove('hidden');

    document.getElementById('editOriginalImage').src = originalImageData;
    setupCanvas();
}

function setupCanvas() {
    canvas = document.getElementById('editCanvas');
    ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });

    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };
    img.src = processedImageData;

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    function startDrawing(e) {
        if (!currentTool) return;
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        lastX = (e.clientX - rect.left) * (canvas.width / rect.width);
        lastY = (e.clientY - rect.top) * (canvas.height / rect.height);
    }

    function draw(e) {
        if (!isDrawing || !currentTool) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        const brushSize = document.getElementById('brushSize').value;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (currentTool === 'erase' || currentTool === 'refine') {
            ctx.globalCompositeOperation = 'destination-out';
        } else if (currentTool === 'restore') {
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();

        lastX = x;
        lastY = y;
    }

    function stopDrawing() {
        isDrawing = false;
    }
}

async function simulateBackgroundRemoval(imageData) {
    if (USE_REMOVEBG_API) {
        return await removeBackgroundWithAPI(imageData);
    } else {
        return await removeBackgroundClientSide(imageData);
    }
}

async function removeBackgroundClientSide(imageData) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');

            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);

            const imageDataObj = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imageDataObj.data;
            const width = tempCanvas.width;
            const height = tempCanvas.height;

            const edgeSamples = [];
            const sampleSize = 20;

            for (let x = 0; x < width; x += Math.floor(width / sampleSize)) {
                edgeSamples.push(getPixel(data, x, 0, width));
                edgeSamples.push(getPixel(data, x, height - 1, width));
            }

            for (let y = 0; y < height; y += Math.floor(height / sampleSize)) {
                edgeSamples.push(getPixel(data, 0, y, width));
                edgeSamples.push(getPixel(data, width - 1, y, width));
            }

            let bgR = 0, bgG = 0, bgB = 0;
            edgeSamples.forEach(pixel => {
                bgR += pixel.r;
                bgG += pixel.g;
                bgB += pixel.b;
            });
            bgR = Math.floor(bgR / edgeSamples.length);
            bgG = Math.floor(bgG / edgeSamples.length);
            bgB = Math.floor(bgB / edgeSamples.length);

            const variance = calculateVariance(edgeSamples, bgR, bgG, bgB);
            const baseTolerance = 40;
            const tolerance = Math.min(baseTolerance + variance / 2, 80);

            const mask = new Uint8Array(width * height);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];

                    const diff = colorDistance(r, g, b, bgR, bgG, bgB);

                    if (diff < tolerance) {
                        mask[y * width + x] = 0;
                    } else if (diff < tolerance * 1.8) {
                        mask[y * width + x] = Math.floor(((diff - tolerance) / (tolerance * 0.8)) * 255); // Edge
                    } else {
                        mask[y * width + x] = 255;
                    }
                }
            }

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const maskValue = mask[y * width + x];

                    if (maskValue > 0 && maskValue < 255) {
                        const neighbors = getNeighborMask(mask, x, y, width, height);
                        const avgMask = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
                        data[idx + 3] = Math.floor(avgMask);
                    } else {
                        data[idx + 3] = maskValue;
                    }
                }
            }

            tempCtx.putImageData(imageDataObj, 0, 0);
            resolve(tempCanvas.toDataURL('image/png'));
        };
        img.src = imageData;
    });
}

function getPixel(data, x, y, width) {
    const idx = (y * width + x) * 4;
    return {
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2]
    };
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
    return Math.sqrt(
        Math.pow(r1 - r2, 2) * 0.3 +
        Math.pow(g1 - g2, 2) * 0.59 +
        Math.pow(b1 - b2, 2) * 0.11
    );
}

function calculateVariance(samples, avgR, avgG, avgB) {
    let variance = 0;
    samples.forEach(pixel => {
        variance += colorDistance(pixel.r, pixel.g, pixel.b, avgR, avgG, avgB);
    });
    return variance / samples.length;
}

function getNeighborMask(mask, x, y, width, height) {
    const neighbors = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                neighbors.push(mask[ny * width + nx]);
            }
        }
    }
    return neighbors;
}

async function removeBackgroundWithAPI(imageData) {
    try {
        const blob = await fetch(imageData).then(r => r.blob());

        const formData = new FormData();
        formData.append('image_file', blob);
        formData.append('size', 'auto');

        const response = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: {
                'X-Api-Key': REMOVEBG_API_KEY
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const resultBlob = await response.blob();
        return URL.createObjectURL(resultBlob);
    } catch (error) {
        console.error('API Error:', error);
        alert('API background removal failed. Using client-side method as fallback.');
        return await removeBackgroundClientSide(imageData);
    }
}



function toggleTool(tool) {
    const eraseBtn = document.getElementById('eraseBtn');
    const refineBtn = document.getElementById('refineBtn');
    const restoreBtn = document.getElementById('restoreBtn');
    const brushControls = document.getElementById('brushControls');

    if (currentTool === tool) {
        currentTool = null;
        eraseBtn.classList.remove('active');
        refineBtn.classList.remove('active');
        restoreBtn.classList.remove('active');
        brushControls.classList.add('hidden');
        canvas.style.cursor = 'default';
    } else {
        currentTool = tool;
        eraseBtn.classList.toggle('active', tool === 'erase');
        refineBtn.classList.toggle('active', tool === 'refine');
        restoreBtn.classList.toggle('active', tool === 'restore');
        brushControls.classList.remove('hidden');
        canvas.style.cursor = 'crosshair';
    }
}

function toggleBgOptions() {
    const bgOptions = document.getElementById('bgOptions');
    bgOptions.classList.toggle('hidden');
}

function applyBackgroundColor(color) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    tempCtx.fillStyle = color;
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    tempCtx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);

    document.getElementById('bgOptions').classList.add('hidden');
}

function applyBackgroundImage(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const bgImg = new Image();
        bgImg.onload = () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');

            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;

            tempCtx.drawImage(bgImg, 0, 0, tempCanvas.width, tempCanvas.height);

            tempCtx.drawImage(canvas, 0, 0);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempCanvas, 0, 0);

            document.getElementById('bgOptions').classList.add('hidden');
        };
        bgImg.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function downloadImage(format) {
    if (format === 'pdf') {
        downloadAsPDF();
        return;
    }

    const link = document.createElement('a');

    if (format === 'png') {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', { alpha: true });
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;

        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);

        link.download = 'background-removed.png';
        link.href = tempCanvas.toDataURL('image/png');
    } else if (format === 'jpg') {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;

        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);

        link.download = 'background-removed.jpg';
        link.href = tempCanvas.toDataURL('image/jpeg', 0.95);
    } else if (format === 'webp') {
        link.download = 'background-removed.webp';
        link.href = canvas.toDataURL('image/webp', 0.95);
    }

    link.click();
}

function downloadAsPDF() {
    const { jsPDF } = window.jspdf;

    const imgData = canvas.toDataURL('image/png');

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = imgWidth / imgHeight;

    let pdfWidth = 210;
    let pdfHeight = 297;

    let orientation = 'portrait';
    if (ratio > 1) {
        orientation = 'landscape';
        pdfWidth = 297;
        pdfHeight = 210;
    }

    const pdf = new jsPDF(orientation, 'mm', 'a4');

    const margin = 10;
    const maxWidth = pdfWidth - (margin * 2);
    const maxHeight = pdfHeight - (margin * 2);

    let finalWidth = maxWidth;
    let finalHeight = maxWidth / ratio;

    if (finalHeight > maxHeight) {
        finalHeight = maxHeight;
        finalWidth = maxHeight * ratio;
    }

    const x = (pdfWidth - finalWidth) / 2;
    const y = (pdfHeight - finalHeight) / 2;

    pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);

    pdf.save('background-removed.pdf');
}

function startOver() {
    originalImageData = null;
    processedImageData = null;
    currentTool = null;
    isVideoMode = false;
    videoFile = null;
    processedVideoBlob = null;
    videoProcessingMode = 'auto';
    selectedBackgroundColor = null;

    uploadZone.classList.remove('hidden');
    previewZone.classList.add('hidden');
    editingZone.classList.add('hidden');
    document.getElementById('videoPreviewZone').classList.add('hidden');
    document.getElementById('videoResultZone').classList.add('hidden');
    document.getElementById('videoProgress').classList.add('hidden');

    fileInput.value = '';
    removeBtn.disabled = false;
    removeBtn.textContent = 'Remove Background Now';

    const removeVideoBtn = document.getElementById('removeVideoBtn');
    if (removeVideoBtn) {
        removeVideoBtn.disabled = false;
        removeVideoBtn.textContent = 'Remove Background from Video';
    }
}

function editAgain() {
    editingZone.classList.add('hidden');
    previewZone.classList.remove('hidden');

    originalImage.src = originalImageData;
    resultImage.src = originalImageData;
    loadingOverlay.classList.add('hidden');

    removeBtn.disabled = false;
    removeBtn.textContent = 'Remove Background Now';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processVideo() {
    const removeVideoBtn = document.getElementById('removeVideoBtn');
    const videoProgress = document.getElementById('videoProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    removeVideoBtn.disabled = true;
    removeVideoBtn.textContent = 'Processing Video...';
    videoProgress.classList.remove('hidden');

    try {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoFile);
        video.muted = true;

        await new Promise(resolve => {
            video.onloadedmetadata = resolve;
        });

        const fps = 30;
        const duration = video.duration;
        const totalFrames = Math.floor(duration * fps);

        const frameCanvas = document.createElement('canvas');
        const frameCtx = frameCanvas.getContext('2d', {
            alpha: true,
            willReadFrequently: true
        });
        frameCanvas.width = video.videoWidth;
        frameCanvas.height = video.videoHeight;

        const processedFrames = [];

        for (let i = 0; i < totalFrames; i++) {
            video.currentTime = i / fps;

            await new Promise(resolve => {
                video.onseeked = resolve;
            });

            frameCtx.drawImage(video, 0, 0);

            const frameData = frameCanvas.toDataURL('image/png');
            let processedFrame;

            if (videoProcessingMode === 'colorPick' && selectedBackgroundColor) {
                processedFrame = await removeBackgroundByColor(frameData, selectedBackgroundColor);
            } else {
                processedFrame = await removeBackgroundClientSide(frameData);
            }

            processedFrames.push(processedFrame);

            const progress = Math.floor(((i + 1) / totalFrames) * 100);
            progressFill.style.width = progress + '%';
            progressText.textContent = `Processing: ${progress}%`;
        }

        progressText.textContent = 'Creating video...';

        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = video.videoWidth;
        outputCanvas.height = video.videoHeight;
        const outputCtx = outputCanvas.getContext('2d', { alpha: true });

        const stream = outputCanvas.captureStream(0);
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 12000000
        });

        const chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

        const recordingPromise = new Promise(resolve => {
            mediaRecorder.onstop = () => {
                processedVideoBlob = new Blob(chunks, { type: 'video/webm' });
                resolve();
            };
        });

        mediaRecorder.start();

        const images = await Promise.all(
            processedFrames.map(src => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.src = src;
                });
            })
        );

        let frameIndex = 0;
        const frameDuration = 1000 / fps;
        let lastFrameTime = performance.now();
        let accumulator = 0;

        const drawNextFrame = (currentTime) => {
            if (frameIndex >= images.length) {
                setTimeout(() => {
                    mediaRecorder.stop();
                }, 100);
                return;
            }

            const deltaTime = currentTime - lastFrameTime;
            lastFrameTime = currentTime;
            accumulator += deltaTime;

            while (accumulator >= frameDuration && frameIndex < images.length) {
                outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
                outputCtx.drawImage(images[frameIndex], 0, 0);

                stream.getTracks()[0].requestFrame();

                frameIndex++;
                accumulator -= frameDuration;
            }

            requestAnimationFrame(drawNextFrame);
        };

        requestAnimationFrame(drawNextFrame);
        await recordingPromise;
        showVideoResult();

    } catch (error) {
        console.error('Video processing error:', error);
        alert('Video processing failed. Please try a shorter video or different format.');
        removeVideoBtn.disabled = false;
        removeVideoBtn.textContent = 'Remove Background from Video';
        videoProgress.classList.add('hidden');
    }
}

function showVideoResult() {
    document.getElementById('videoPreviewZone').classList.add('hidden');
    document.getElementById('videoResultZone').classList.remove('hidden');

    const videoResult = document.getElementById('videoResult');
    videoResult.src = URL.createObjectURL(processedVideoBlob);
}

function downloadVideo() {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(processedVideoBlob);
    link.download = 'background-removed-video.webm';
    link.click();
}

async function downloadVideoAsMp4() {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(processedVideoBlob);
    link.download = 'background-removed-video.mp4';
    link.click();
}
