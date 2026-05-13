// worker.js
importScripts('scan.js'); // 載入原始 SDK 邏輯

let scanner = null;
let ports = [];

onconnect = function(e) {
    const port = e.ports[0];
    ports.push(port);

    port.onmessage = async function(event) {
        const { action, payload } = event.data;

        switch (action) {
            case 'CONNECT':
                if (!scanner) {
                    scanner = new WebFxScan({ mode: "dev" });
                    // 設置通訊收集器並廣播給所有分頁
                    scanner.setSocketMsgCollector({
                        callback: (log, type) => broadcast({ action: 'LOG', payload: { log, type } })
                    });

                    try {
                        await scanner.connect({
                            ...payload,
                            eventCallback: (code, data) => broadcast({ action: 'EVENT', payload: { code, data } }),
                            ipExceptionCallback: (data) => broadcast({ action: 'EXCEPTION', payload: data })
                        });
                        await scanner.init();
                        const ver = scanner.getVersion();
                        broadcast({ action: 'STATUS', payload: { connected: true, version: ver } });
                    } catch (err) {
                        port.postMessage({ action: 'STATUS', payload: { connected: false, error: err } });
                    }
                } else {
                    // 如果已經連線，回傳目前的狀態給新分頁
                    port.postMessage({ action: 'STATUS', payload: { connected: true, version: scanner.getVersion() } });
                }
                break;

            case 'GET_DEVICE_LIST':
                try {
                    const res = await scanner.getDeviceList();
                    port.postMessage({ action: 'DEVICE_LIST', payload: res });
                } catch (err) {
                    port.postMessage({ action: 'ERROR', payload: err });
                }
                break;

            case 'SCAN':
                try {
                    // 使用當前設定進行掃描，結果廣播給所有人
                    const res = await scanner.scan(payload);
                    broadcast({ action: 'SCAN_RESULT', payload: res });
                } catch (err) {
                    broadcast({ action: 'ERROR', payload: err });
                }
                break;

            case 'SET_SCANNER':
                await scanner.setScanner(payload);
                break;
        }
    };
};

function broadcast(msg) {
    ports.forEach(p => p.postMessage(msg));
}