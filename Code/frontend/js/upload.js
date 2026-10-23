const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
  initDropzone();
});

function initDropzone() {
  const dropzone = document.getElementById('dropzoneCard');
  const fileInput = document.getElementById('pdfFileInput');
  const btnSelectPdf = document.getElementById('btnSelectPdf');
  const dropzonePrompt = document.getElementById('dropzonePrompt');
  const dropzoneSelected = document.getElementById('dropzoneSelected');
  const previewFileName = document.getElementById('previewFileName');
  const previewFileSize = document.getElementById('previewFileSize');
  const btnRemoveFile = document.getElementById('btnRemoveFile');

  if (!dropzone || !fileInput) return;

  btnSelectPdf.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', () => {
    if (!selectedFile) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files[0]) {
      handleFile(dt.files[0]);
    }
  });

  if (btnRemoveFile) {
    btnRemoveFile.addEventListener('click', (e) => {
      e.stopPropagation();
      resetFileSelection();
    });
  }

  function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('Vui lòng chỉ tải lên tệp định dạng PDF (.pdf)!');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`Dung lượng tệp (${formatFileSize(file.size)}) vượt quá giới hạn ${MAX_FILE_SIZE_MB}MB!`);
      return;
    }

    selectedFile = file;

    if (previewFileName) previewFileName.textContent = file.name;
    if (previewFileSize) previewFileSize.textContent = formatFileSize(file.size);

    if (dropzonePrompt) dropzonePrompt.style.display = 'none';
    if (dropzoneSelected) dropzoneSelected.classList.add('active');
  }

  function resetFileSelection() {
    selectedFile = null;
    fileInput.value = '';
    if (dropzonePrompt) dropzonePrompt.style.display = 'flex';
    if (dropzoneSelected) dropzoneSelected.classList.remove('active');
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
