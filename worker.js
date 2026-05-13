// worker.js
importScripts('scan.js'); // 載入原本的 WebFxScan 邏輯

let socketInstance = null;
const ports = new Set();

onconnect = function (e) {
  const port = e.ports[0];
  ports.add(port);

  port.onmessage = async function (event) {
    const { action, payload } = event.data;

    switch (action) {
      case 'CONNECT':
        if (!socketInstance) {
          socketInstance = new WebFxScan({ mode: "dev" });
          // 設定全域回傳邏輯：當 WebSocket 有訊息時，廣播給所有分頁
          socketInstance.setSocketMsgCollector({
            callback: (log, type) => broadcast({ action: 'LOG', payload: { log, type } })
          });
          
          try {
            await socketInstance.connect({
              ...payload,
              eventCallback: (code, data) => broadcast({ action: 'EVENT', payload: { code, data } }),
              ipExceptionCallback: (data) => broadcast({ action: 'EXCEPTION', payload: data })
            });
            await socketInstance.init();
            port.postMessage({ action: 'CONNECTED', result: true });
          } catch (err) {
            port.postMessage({ action: 'CONNECTED', result: false, error: err });
          }
        } else {
          port.postMessage({ action: 'CONNECTED', result: true, msg: 'Already connected' });
        }
        break;

      case 'SCAN':
        try {
          const res = await socketInstance.scan(payload);
          port.postMessage({ action: 'SCAN_RESULT', payload: res });
        } catch (err) {
          port.postMessage({ action: 'ERROR', payload: err });
        }
        break;

      case 'GET_DEVICE_LIST':
        const devices = await socketInstance.getDeviceList();
        port.postMessage({ action: 'DEVICE_LIST', payload: devices });
        break;

      // 可依此類推添加 setScanner, ejectPaper 等功能...
    }
  };

  port.start();
};

function broadcast(message) {
  ports.forEach(p => p.postMessage(message));
}