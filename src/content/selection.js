let overlay = null;
let box = null;
let toast = null;
let icon = null;
let toastMsg = null;
let isShowingToast = false;
let toastTimer = null;

let startX = 0;
let startY = 0;
let isSelecting = false;

window.onload = () => {
  toast = document.createElement("div");
  toast.className = "qrbox-toast";
  icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.textContent = "info";
  toastMsg = document.createElement("p");
  toastMsg.className = "qrbox-toastmsg";
  toast.appendChild(icon);
  toast.appendChild(toastMsg);
  document.body.appendChild(toast);
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "readQr") return;
  startSelectionMode();
  sendResponse({ ok: true });
  //return true;
});
function showToast(msg, mode = "info", toastTime = 2000) {
  if (!toast) return;
  toastMsg.textContent = msg;
  toast.classList.remove("qrbox-info", "qrbox-success", "qrbox-error");
  if (mode === "success") {
    icon.textContent = "check_circle";
    toast.classList.add("qrbox-success");
  } else if (mode === "error") {
    icon.textContent = "error";
    toast.classList.add("qrbox-error");
  } else {
    icon.textContent = "info";
    toast.classList.add("qrbox-info");
  }
  toast.classList.add("qrbox-show");
  if (isShowingToast) {
    window.clearTimeout(toastTimer);
  }
  isShowingToast = true;
  if (isShowingToast)
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("qrbox-show");
      isShowingToast = false;
    }, toastTime);
}
function startSelectionMode() {
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.className = "qrbox-overlay";
  document.body.appendChild(overlay);

  box = document.createElement("div");
  box.className = "qrbox-selection";
  document.body.appendChild(box);

  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("keydown", onKeyDown);

  overlay.addEventListener("mousedown", (e) => e.preventDefault());
  overlay.addEventListener("mousemove", (e) => e.preventDefault());
  overlay.addEventListener("mouseup", (e) => e.preventDefault());
}
function onMouseDown(e) {
  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;

  box.style.left = `${startX}px`;
  box.style.top = `${startY}px`;
  box.style.width = "0px";
  box.style.height = "0px";
  box.style.display = "block";
}
function onMouseMove(e) {
  if (!isSelecting) return;

  const x = Math.min(e.clientX, startX);
  const y = Math.min(e.clientY, startY);
  const w = Math.abs(e.clientX - startX);
  const h = Math.abs(e.clientY - startY);

  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;
}
function onMouseUp(e) {
  if (!isSelecting) return;
  isSelecting = false;

  const rect = {
    left: parseInt(box.style.left),
    top: parseInt(box.style.top),
    width: parseInt(box.style.width),
    height: parseInt(box.style.height),
  };

  cleanupSelectionUI();

  analyzeQR(rect);
}
function onKeyDown(e) {
  if (e.key === "Escape") {
    cleanupSelectionUI();
  }
}

function cleanupSelectionUI() {
  if (overlay) overlay.remove();
  if (box) box.remove();
  overlay = null;
  box = null;

  document.removeEventListener("mousedown", onMouseDown);
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
  document.removeEventListener("keydown", onKeyDown);
}

function analyzeQR({ left: x, top: y, width: w, height: h }) {
  chrome.runtime.sendMessage(
    { action: "captureVisibleTab", rect: { x, y, w, h } },
    (response) => {
      if (!response || !response.dataUrl) {
        console.error("capture failed");
        showToast("画像の取得に失敗しました", (mode = "error"));
        return;
      }
      const img = new Image();
      img.onload = () => {
        // スケーリングに対応
        const scaleX = img.width / window.innerWidth;
        const scaleY = img.height / window.innerHeight;
        const sw = Math.round(w * scaleX);
        const sh = Math.round(h * scaleY);
        const sx = Math.round(x * scaleX);
        const sy = Math.round(y * scaleY);

        const canvas = document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

        const imageData = ctx.getImageData(0, 0, sw, sh);
        const code = jsQR(imageData.data, sw, sh, {
          inversionAttempts: "dontInvert",
        });
        if (code && code.data) {
          const now = new Date();
          const timeStr = now.toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          chrome.storage.local
            .set({
              lastRead: { time: timeStr, content: code.data },
            })
            .then(() => {
              console.log(`${timeStr} ${code.data}`);
              showToast(`読み取り結果: ${code.data}`, (mode = "success"));
              chrome.storage.local.get(["auto"]).then((result) => {
                if (result.auto === undefined) return;
                if (!navigator.clipboard) {
                  showMsg("コピーに対応していません");
                  return;
                }
                if (result.auto) navigator.clipboard.writeText(code.data);
              });
            });
        } else {
          console.log("QR NotFound");
          showToast("QRコードが見つかりませんでした", (mode = "error"));
        }
      };
      img.src = response.dataUrl;
    },
  );
}
