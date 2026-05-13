// main.js
$(document).ready(function () {
    const worker = new SharedWorker('worker.js');
    const port = worker.port;

    // 全域參數
    const globalParam = { deviceOptions: [] };

    // --- 訊息處理 ---
    port.onmessage = function (e) {
        const { action, payload } = e.data;

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
                globalParam.deviceOptions = payload.data.options;
                view.setDeviceOpts(globalParam.deviceOptions);
                break;
            case 'SCAN_RESULT':
                view.displayLoadingMask(false);
                if (payload.result) {
                    // 顯示第一張掃描結果
                    $("#img-zone").attr("src", payload.data[0].base64);
                    $("#total-pages").text(payload.data.length);
                    $("#current-page-input").val(1);
                }
                break;
            case 'ERROR':
                view.displayLoadingMask(false);
                alert("錯誤: " + JSON.stringify(payload));
                break;
        }
    };

    // --- UI 事件 ---
    $("#scan").on("click", function () {
        view.displayLoadingMask(true);
        port.postMessage({ action: 'SCAN', payload: {} });
    });

    $("#device-name").on("change", function () {
        const device = globalParam.deviceOptions.find(d => d.deviceName === this.value);
        if (device) {
            view.setSourceOpts(device.source.value);
            port.postMessage({ action: 'SET_SCANNER', payload: { deviceName: this.value } });
        }
    });

    $("#clear-message").on("click", () => $("#log-container").empty());

    // --- 初始化 ---
    const view = {
        setDeviceOpts: (list) => {
            const $el = $("#device-name").empty();
            list.forEach(d => $el.append(`<option value="${d.deviceName}">${d.deviceName}</option>`));
        },
        setSourceOpts: (list) => {
            const $el = $("#source").empty();
            list.forEach(s => $el.append(`<option value="${s}">${s}</option>`));
        },
        addLogEntry: (log, type) => {
            const color = type === 'up' ? 'bg-info' : 'bg-success';
            $("#log-container").append(`<div class="p-1 mb-1 ${color} text-white small">${log.substring(0, 50)}...</div>`);
        },
        displayLoadingMask: (show) => $(".custom-loading-mask").toggleClass("d-none", !show)
    };

    port.start();
    port.postMessage({ action: 'CONNECT', payload: { ip: "localhost", port: "17778" } });
});