$(document).ready(function () {
  const isDebug = false;
  const worker = new SharedWorker('worker.js');
  const port = worker.port;

  /*** 1. 影像代理與操作 (保持原本邏輯) ***/
  const imageData = {
    imageCache: [],
    index: 0,
    total: 0,
  };

  let proxyImageHandler = {
    set: function (obj, prop, value) {
      if (prop === "index") {
        const pageIndex = parseInt(value);
        if (isNaN(pageIndex) || pageIndex < 1 || pageIndex > obj.total) return false;
        obj[prop] = pageIndex;
        view.showPic(obj.imageCache[pageIndex - 1]);
        view.updatePageIndex(pageIndex);
        return true;
      } else if (prop === "imageCache" && Array.isArray(value)) {
        obj[prop] = value;
        obj.total = value.length;
        view.updatePageTotal(value.length);
        return true;
      } else if (prop === "newImage") {
        obj.imageCache.push(value);
        obj.total = obj.imageCache.length;
        obj.index = obj.imageCache.length;
        view.updatePageTotal(obj.imageCache.length);
        view.showPic(obj.imageCache[obj.imageCache.length - 1]);
        view.updatePageIndex(obj.imageCache.length);
        return true;
      }
      return false;
    }
  };
  let proxyImageData = new Proxy(imageData, proxyImageHandler);

  let imageAction = {
    prev: () => { proxyImageData.index = proxyImageData.index - 1; },
    next: () => { proxyImageData.index = proxyImageData.index + 1; },
    to: (page) => { proxyImageData.index = page; },
    addImage: (fileObj) => { proxyImageData.newImage = fileObj; },
    clear: () => {
      proxyImageData.imageCache = [];
      view.updatePageTotal(0);
      view.updatePageIndex(0);
      $("#img-zone").attr("src", "");
      $("#sample-bg").removeClass("d-none");
    },
  };

  /*** 2. UI 渲染函式 (完整還原原本功能) ***/
  const view = {
    showPic(file) {
      const { base64, ocrText } = file;
      $("#sample-bg").addClass("d-none");
      $("#img-zone").attr("src", base64);
      $(".custom-button-recognize").attr("disabled", ocrText === "");
    },
    addLogEntry(log, msgType) {
      const logId = Date.now();
      const isSendType = msgType === "up";
      const logTitle = log.substring(0, 100);
      const accordionItem = `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <div class="${isSendType ? "custom-message-up-bg-color" : "custom-message-down-bg-color"} custom-accordion-button p-1 ps-2" type="button" data-log='${log}'>
            <div class="${isSendType ? "custom-arrow-up" : "custom-arrow-down"}">${isSendType ? "↑" : "↓"}</div>
            <div class="custom-text-line-2 custom-font-size-mid">${logTitle}</div>
          </div>
        </h2>
      </div>`;
      $("#log-container").append(accordionItem);
      $("#message-container").scrollTop($("#message-container")[0].scrollHeight);
    },
    displayOcrTextWindow(title, contentObj) {
      $("#ocrtext-window .custom-window-title").text(title);
      $("#ocrtext-window .custom-window-content").jsonViewer(contentObj, { collapsed: true });
      $("#ocrtext-window").removeClass("d-none");
    },
    updatePageIndex: (i) => $("#current-page-input").val(i),
    updatePageTotal: (t) => $("#total-pages").text(t),
    setDeviceOpts: (list) => {
      $("#device-name").empty();
      list.forEach(d => $("#device-name").append(`<option value="${d.deviceName}">${d.deviceName}</option>`));
    },
    setSourceOpts: (list) => {
      $("#source").empty();
      list.forEach(s => $("#source").append(`<option value="${s}">${s}</option>`));
    },
    displayLoadingMask: (isVisible) => $(".custom-loading-mask").toggleClass("d-none", !isVisible)
  };

  /*** 3. Shared Worker 訊息接收 ***/
  port.onmessage = function (e) {
    const { action, payload, result } = e.data;
    switch (action) {
      case 'LOG':
        view.addLogEntry(payload.log, payload.type);
        break;
      case 'STATUS':
        if (payload.connected) {
          $("#version").text(payload.version);
          port.postMessage({ action: 'GET_DEVICE_LIST' });
        }
        break;
      case 'DEVICE_LIST':
        if (result !== false) {
          const options = payload.data.options;
          view.setDeviceOpts(options);
          if (options.length > 0) $("#device-name").trigger('change');
        }
        break;
      case 'SCAN_RESULT':
        view.displayLoadingMask(false);
        if (payload.result) {
          imageAction.clear();
          payload.data.forEach(file => imageAction.addImage(file));
        }
        break;
    }
  };

  /*** 4. UI 事件綁定 ***/
  $("#scan").on("click", () => {
    view.displayLoadingMask(true);
    port.postMessage({ action: 'SCAN', payload: {} });
  });

  $("#device-name").on("change", function () {
    // 這裡我們需要向 Worker 請求當前設備的支援選項
    port.postMessage({ action: 'SET_SCANNER', payload: { deviceName: this.value } });
    // 簡易處理：從先前存下來的清單找 source
    const portData = e => { if(e.data.action === 'DEVICE_LIST') { /* 更新 source UI */ } };
  });

  $("#page-prev").on("click", () => imageAction.prev());
  $("#page-next").on("click", () => imageAction.next());
  
  // 顯示 OCR 視窗
  $("#show-recognize").on("click", function() {
    const imageObj = imageData.imageCache[imageData.index - 1];
    if(imageObj) view.displayOcrTextWindow("Recognize Data", imageObj.ocrText);
  });

  // 點擊 Log 顯示 JSON
  $("#log-container").on("click", ".custom-accordion-button", function() {
    const logData = $(this).data('log');
    view.displayOcrTextWindow("Message Detail", typeof logData === 'object' ? logData : JSON.parse(logData));
  });

  $("#clear-message").on("click", () => $("#log-container").empty());

  // 關閉視窗邏輯
  $(".custom-close-btn, .custom-modal-mask").on("click", () => $(".custom-modal-container").addClass("d-none"));

  port.start();
  port.postMessage({ action: 'CONNECT', payload: { ip: "localhost", port: "17778" } });
});