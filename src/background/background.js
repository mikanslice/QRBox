chrome.contextMenus.create({
  id: "readQr",
  title: "QRコードを読み込む",
  contexts: ["all"],
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === "readQr") {
    // タブ情報チェック（chrome:// や file: など注入不可のスキームを除外）
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
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "captureVisibleTab") return;
  chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
    sendResponse({ dataUrl });
  });
  return true; // async sendResponse
});
