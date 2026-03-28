const time = document.getElementById("time");
const content = document.getElementById("content");
const copyBtn = document.getElementById("copy");
const rstBtn = document.getElementById("reset");
const scanBtn = document.getElementById("scan");
const msgBox = document.getElementById("msg");
const autoCheck = document.getElementById("auto");
let id = null;
let isMsgShowing = false;

window.onload = () => {
  const showMsg = (msg, msgTime = 1000) => {
    msgBox.textContent = msg;
    if (isMsgShowing) {
      window.clearTimeout(id);
    }
    isMsgShowing = true;
    id = window.setTimeout(() => {
      msgBox.textContent = "";
      isMsgShowing = false;
    }, msgTime);
  };

  copyBtn.addEventListener("click", () => {
    if (!navigator.clipboard) {
      showMsg("コピーに対応していません");
      return;
    }
    navigator.clipboard.writeText(content.textContent).then(
      () => {
        showMsg("コピーしました");
      },
      () => {
        showMsg("コピーできませんでした");
      },
    );
  });
  rstBtn.addEventListener("click", () => {
    chrome.storage.local.remove("lastRead");
    if (time) time.textContent = "-";
    if (content) content.textContent = "-";
  });
  autoCheck.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    chrome.storage.local.set({ auto: isChecked }).then(() => {
      console.log("設定を変更しました: ", isChecked);
    });
  });
  scanBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (
      !tab ||
      !tab.id ||
      !tab.url ||
      /^(chrome|about|view-source|file):/.test(tab.url)
    ) {
      console.error("cannot send message to this tab:", tab && tab.url);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "readQr" }, (res) => {
      if (chrome.runtime.lastError) {
        console.error("sendMessage failed:", chrome.runtime.lastError.message);
      } else {
        window.close();
      }
    });
  });

  chrome.storage.local.get(["lastRead"]).then((result) => {
    if (result.lastRead === undefined) return;
    if (time) time.textContent = result.lastRead.time;
    if (content) content.textContent = result.lastRead.content;
  });
  chrome.storage.local.get(["auto"]).then((result) => {
    if (result.auto === undefined) return;
    if (autoCheck) autoCheck.checked = result.auto;
  });
};
