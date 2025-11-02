document.getElementById("defaultBtn").addEventListener("click", () => inject("default"));
document.getElementById("o365Btn").addEventListener("click", () => inject("o365"));
document.getElementById("pwBtn").addEventListener("click", () => inject("passwordstate"));
document.getElementById("dotIT").addEventListener("click", () => inject("dotIT"));	


function inject(service) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["injector.js"]
    }, () => {
      chrome.tabs.sendMessage(tabs[0].id, { type: "INJECT_TOTP", service });
    });
  });
}