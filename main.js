// main.js
$(document).ready(function () {
  const isDebug = false;
  
  // 初始化 Shared Worker
  const worker = new SharedWorker('worker.js');
  const port = worker.port;

  /*** 1. 監聽來自 Worker 的所有訊息 (廣播機制) ***/
  port.onmessage = function (e) {
    const { action, payload, result, error } = e.data;

    switch (action) {
      case 'LOG':
        // 接收來自 Worker 的 WebSocket 原始 Log
        view.addLogEntry(payload.log, payload.type);
        break;

      case 'EVENT':
        // 接收來自 scan.js eventCallback 的事件 (如掃描進度)
        console.log("Worker Event:", payload.code, payload.data);
        break;

      case 'CONNECTED':
        if (result) {
          console.log("WebSocket connected via Worker");
          // 連線成功後請求設備清單
          port.postMessage({ action: 'GET_DEVICE_LIST' });
        } else {
          alert(`連線失敗: ${error}`);
        }
        break;

      case 'DEVICE_LIST':
        if (payload.result) {
          globalParam.deviceOptions = payload.data.options;
          view.setDeviceOpts(globalParam.deviceOptions);
          // 預設選取第一個設備
          if (globalParam.deviceOptions.length > 0) {
            $("#device-name").val(globalParam.deviceOptions[0].deviceName).change();
          }
        }
        break;

      case 'SCAN_RESULT':
        view.displayLoadingMask(false);
        if (payload.result) {
          imageAction.clear();
          payload.data.map((file) => {
            imageAction.addImage(file);
          });
          imageAction.updateTotal(payload.data.length);
          imageAction.to(1);
        } else {
          alert(`掃描失敗: ${payload.error || '未知錯誤'}`);
        }
        break;

      case 'ERROR':
        view.displayLoadingMask(false);
        console.error("Worker Error:", payload);
        break;
    }
  };

  /*** 2. UI 事件綁定 (改為傳送指令給 Worker) ***/

  // 執行掃描
  $("#scan").on("click", function () {
    view.displayLoadingMask(true);
    // 獲取當前 UI 設定的參數
    const config = {
      // 可以在這裡加入從 UI 取得的參數，例如解析度、色彩模式等
      // 這裡示範傳送空物件，由 Worker 使用預設值
    };
    port.postMessage({ action: 'SCAN', payload: config });
  });

  // 切換設備
  $("#device-name").on("change", function () {
    const selectedDeviceName = this.value;
    const selectedDevice = globalParam.deviceOptions.find(d => d.deviceName === selectedDeviceName);
    
    if (selectedDevice) {
      const { source = {} } = selectedDevice;
      const { value: sourceAry = [] } = source;
      view.setSourceOpts(sourceAry);
      
      // 通知 Worker 切換當前使用的設備
      port.postMessage({ 
        action: 'SET_SCANNER', 
        payload: { deviceName: selectedDeviceName } 
      });
    }
  });

  // 退紙功能 (如果 scan.js 有實作)
  $("#eject").on("click", function () {
    port.postMessage({ action: 'EJECT', payload: { isBackward: false } });
  });

  /*** 3. 啟動通訊與連線 ***/
  port.start();

  // 通知 Worker 初始化 WebSocket 連線 (如果尚未連線)
  port.postMessage({ 
    action: 'CONNECT', 
    payload: { ip: "localhost", port: "17778" } 
  });

  /*** 輔助工具 (保留原本的序列化邏輯，供偵錯使用) ***/
  function serialize(obj) {
    if (obj instanceof Error) {
      return { name: obj.name, message: obj.message, stack: obj.stack };
    }
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => serialize(item));
    }
    const serializedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serializedObj[key] = serialize(obj[key]);
      }
    }
    return serializedObj;
  }
});