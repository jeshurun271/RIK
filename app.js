/* =========================================================
   RIK — ROBOT IN KONTROL
   FULL APP.JS
   ESP32 IP CONFIGURATION
   ========================================================= */

(() => {
    "use strict";

    /* =====================================================
       STORAGE
       ===================================================== */

    const ESP32_IP_KEY = "rik_esp32_ip";
    const ESP32_PORT_KEY = "rik_esp32_port";

    const DEFAULT_PORT = "81";


    /* =====================================================
       ESP32 CONFIG
       ===================================================== */

    const ESP32 = {
        socket: null,
        reconnectTimer: null,
        heartbeatTimer: null,
        reconnectDelay: 1000,
        reconnectMax: 10000,
        connectionTimeout: null,
        commandId: 0,
        pending: new Map()
    };


    /* =====================================================
       APP STATE
       ===================================================== */

    const state = {
        connected: false,

        speed: 65,

        driveCommand: null,

        armState: "READY",

        clawState: "READY",

        soil: "--",

        air: "--",

        timer: 0,

        timerRunning: false,

        timerInterval: null
    };


    /* =====================================================
       HELPERS
       ===================================================== */

    const $ = (selector, root = document) =>
        root.querySelector(selector);


    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));


    /* =====================================================
       ESP32 SETTINGS
       ===================================================== */

    function getESP32Settings() {

        return {
            ip:
                localStorage.getItem(
                    ESP32_IP_KEY
                ) || "",

            port:
                localStorage.getItem(
                    ESP32_PORT_KEY
                ) || DEFAULT_PORT
        };

    }


    function saveESP32Settings(ip, port) {

        ip =
            String(ip || "")
                .trim();

        port =
            String(port || DEFAULT_PORT)
                .trim();


        if (!ip) {

            return {
                success: false,
                error: "PLEASE ENTER ESP32 IP ADDRESS"
            };

        }


        if (!/^[0-9a-fA-F:.]+$/.test(ip)) {

            return {
                success: false,
                error: "INVALID IP ADDRESS"
            };

        }


        const portNumber =
            Number(port);


        if (
            !Number.isInteger(portNumber) ||
            portNumber < 1 ||
            portNumber > 65535
        ) {

            return {
                success: false,
                error: "INVALID PORT"
            };

        }


        localStorage.setItem(
            ESP32_IP_KEY,
            ip
        );


        localStorage.setItem(
            ESP32_PORT_KEY,
            String(portNumber)
        );


        return {
            success: true
        };

    }


    function getESP32URL() {

        const settings =
            getESP32Settings();


        if (!settings.ip) {

            return null;

        }


        return (
            "ws://" +
            settings.ip +
            ":" +
            settings.port
        );

    }


    /* =====================================================
       CONNECTION STATUS
       ===================================================== */

    function updateConnectionUI() {

        const connected =
            state.connected;


        const text =
            $("#connectionText");


        if (text) {

            text.textContent =
                connected
                    ? "CONNECTED"
                    : "OFFLINE";

        }


        const dot =
            $("#connectionDot");


        if (dot) {

            dot.classList.toggle(
                "offline",
                !connected
            );

        }


        const status =
            $("#esp32SettingsStatus");


        if (status) {

            if (connected) {

                status.textContent =
                    "CONNECTED";

                status.className =
                    "esp32-status connected";

            } else {

                const settings =
                    getESP32Settings();


                status.textContent =
                    settings.ip
                        ? "OFFLINE"
                        : "ENTER ESP32 IP";

                status.className =
                    "esp32-status offline";

            }

        }


        const robotStatus =
            $("#robotStatus");


        if (robotStatus) {

            robotStatus.textContent =
                connected
                    ? "CONNECTED"
                    : "OFFLINE";

        }


        /*
         * Safety:
         * stop movement immediately when connection disappears.
         */

        if (!connected) {

            stopDrive(
                false
            );

        }

    }


    /* =====================================================
       CREATE ESP32 SETTINGS CARD
       ===================================================== */

    function createESP32SettingsCard() {

        /*
         * If it already exists,
         * don't create another one.
         */

        if (
            document.querySelector(
                "#esp32ConnectionCard"
            )
        ) {

            return;
        }


        const settingsPage =
            document.querySelector(
                "#settingsPage"
            );


        if (!settingsPage) {

            console.warn(
                "[RIK] #settingsPage not found."
            );

            return;

        }


        /*
         * -------------------------------------------------
         * Create CSS
         * -------------------------------------------------
         */

        if (
            !document.querySelector(
                "#rik-esp32-settings-css"
            )
        ) {

            const style =
                document.createElement(
                    "style"
                );


            style.id =
                "rik-esp32-settings-css";


            style.textContent = `

                #esp32ConnectionCard {

                    position: relative;

                    width: 100%;

                    box-sizing: border-box;

                    margin: 0 0 28px 0;

                    padding: 26px;

                    border-radius: 22px;

                    border: 1px solid
                        rgba(255,255,255,0.16);

                    background:
                        linear-gradient(
                            135deg,
                            rgba(30,30,32,0.92),
                            rgba(12,12,14,0.92)
                        );

                    box-shadow:
                        inset 0 1px 0
                            rgba(255,255,255,0.08),
                        0 20px 50px
                            rgba(0,0,0,0.35);

                    color: white;

                    backdrop-filter:
                        blur(18px);

                    -webkit-backdrop-filter:
                        blur(18px);

                }


                #esp32ConnectionCard
                .esp32-card-title {

                    display: flex;

                    align-items: center;

                    justify-content:
                        space-between;

                    gap: 20px;

                    margin-bottom: 8px;

                }


                #esp32ConnectionCard
                .esp32-card-title h3 {

                    margin: 0;

                    font-size: 15px;

                    font-weight: 800;

                    letter-spacing:
                        0.12em;

                }


                #esp32ConnectionCard
                .esp32-card-subtitle {

                    margin: 0 0 22px;

                    color:
                        rgba(255,255,255,0.45);

                    font-size: 11px;

                }


                .esp32-form-row {

                    display: grid;

                    grid-template-columns:
                        minmax(0, 1fr)
                        130px;

                    gap: 14px;

                    margin-bottom: 16px;

                }


                .esp32-field {

                    display: flex;

                    flex-direction: column;

                    gap: 8px;

                }


                .esp32-field label {

                    font-size: 9px;

                    font-weight: 800;

                    letter-spacing:
                        0.12em;

                    color:
                        rgba(255,255,255,0.48);

                }


                .esp32-field input {

                    width: 100%;

                    box-sizing: border-box;

                    height: 46px;

                    padding:
                        0 15px;

                    border-radius: 12px;

                    border: 1px solid
                        rgba(255,255,255,0.14);

                    outline: none;

                    background:
                        rgba(255,255,255,0.055);

                    color: white;

                    font-family:
                        inherit;

                    font-size: 13px;

                    transition:
                        border-color .2s ease,
                        background .2s ease,
                        box-shadow .2s ease;

                }


                .esp32-field input::placeholder {

                    color:
                        rgba(255,255,255,0.25);

                }


                .esp32-field input:focus {

                    border-color:
                        rgba(0,255,120,0.65);

                    background:
                        rgba(255,255,255,0.08);

                    box-shadow:
                        0 0 0 3px
                        rgba(0,255,120,0.08);

                }


                .esp32-buttons {

                    display: flex;

                    gap: 10px;

                    flex-wrap: wrap;

                }


                .esp32-btn {

                    min-height: 42px;

                    padding:
                        0 18px;

                    border-radius: 12px;

                    border: 1px solid
                        rgba(255,255,255,0.12);

                    background:
                        rgba(255,255,255,0.06);

                    color: white;

                    font-family:
                        inherit;

                    font-size: 10px;

                    font-weight: 800;

                    letter-spacing:
                        0.08em;

                    cursor: pointer;

                    transition:
                        transform .15s ease,
                        background .15s ease,
                        border-color .15s ease;

                }


                .esp32-btn:hover {

                    background:
                        rgba(255,255,255,0.11);

                    border-color:
                        rgba(255,255,255,0.25);

                    transform:
                        translateY(-1px);

                }


                .esp32-btn:active {

                    transform:
                        translateY(1px);

                }


                .esp32-btn.primary {

                    background:
                        linear-gradient(
                            135deg,
                            #19e875,
                            #00b95a
                        );

                    border-color:
                        rgba(0,255,120,0.5);

                    color: #00150a;

                    box-shadow:
                        0 8px 25px
                        rgba(0,220,100,0.18);

                }


                .esp32-btn.primary:hover {

                    background:
                        linear-gradient(
                            135deg,
                            #35f58b,
                            #08ce68
                        );

                }


                .esp32-status-row {

                    display: flex;

                    align-items: center;

                    justify-content:
                        space-between;

                    gap: 15px;

                    margin-top: 20px;

                    padding-top: 18px;

                    border-top:
                        1px solid
                        rgba(255,255,255,0.08);

                }


                .esp32-status {

                    display: inline-flex;

                    align-items: center;

                    gap: 8px;

                    font-size: 10px;

                    font-weight: 800;

                    letter-spacing:
                        0.08em;

                }


                .esp32-status::before {

                    content: "";

                    width: 8px;

                    height: 8px;

                    border-radius: 50%;

                    background:
                        #777;

                    box-shadow:
                        0 0 0 5px
                        rgba(255,255,255,0.04);

                }


                .esp32-status.connected {

                    color:
                        #20e878;

                }


                .esp32-status.connected::before {

                    background:
                        #20e878;

                    box-shadow:
                        0 0 0 5px
                        rgba(32,232,120,0.10),
                        0 0 15px
                        rgba(32,232,120,0.7);

                }


                .esp32-status.offline {

                    color:
                        rgba(255,255,255,0.5);

                }


                .esp32-status.testing {

                    color:
                        #ffd84d;

                }


                .esp32-status.testing::before {

                    background:
                        #ffd84d;

                }


                .esp32-status.error {

                    color:
                        #ff5353;

                }


                .esp32-status.error::before {

                    background:
                        #ff5353;

                }


                .esp32-current {

                    font-size: 9px;

                    color:
                        rgba(255,255,255,0.35);

                }


                @media (max-width: 700px) {

                    .esp32-form-row {

                        grid-template-columns:
                            1fr;

                    }

                }

            `;


            document.head.appendChild(
                style
            );

        }


        /*
         * -------------------------------------------------
         * Create card
         * -------------------------------------------------
         */

        const card =
            document.createElement(
                "section"
            );


        card.id =
            "esp32ConnectionCard";


        card.innerHTML = `

            <div class="esp32-card-title">

                <h3>
                    ESP32 CONNECTION
                </h3>

                <div
                    id="esp32SettingsStatus"
                    class="esp32-status offline"
                >
                    ENTER ESP32 IP
                </div>

            </div>


            <p class="esp32-card-subtitle">
                Configure the IP address of your ESP32 robot controller.
            </p>


            <div class="esp32-form-row">

                <div class="esp32-field">

                    <label for="esp32IpInput">
                        ESP32 IP ADDRESS
                    </label>

                    <input
                        id="esp32IpInput"
                        type="text"
                        inputmode="decimal"
                        autocomplete="off"
                        spellcheck="false"
                        placeholder="192.168.1.100"
                    />

                </div>


                <div class="esp32-field">

                    <label for="esp32PortInput">
                        WEBSOCKET PORT
                    </label>

                    <input
                        id="esp32PortInput"
                        type="number"
                        min="1"
                        max="65535"
                        value="81"
                    />

                </div>

            </div>


            <div class="esp32-buttons">

                <button
                    id="saveESP32Button"
                    class="esp32-btn primary"
                    type="button"
                >
                    SAVE & CONNECT
                </button>


                <button
                    id="testESP32Button"
                    class="esp32-btn"
                    type="button"
                >
                    TEST CONNECTION
                </button>


                <button
                    id="disconnectESP32Button"
                    class="esp32-btn"
                    type="button"
                >
                    DISCONNECT
                </button>

            </div>


            <div class="esp32-status-row">

                <div
                    id="esp32ConnectionMessage"
                    class="esp32-current"
                >
                    No ESP32 IP configured.
                </div>

                <div
                    id="esp32CurrentAddress"
                    class="esp32-current"
                >
                    —
                </div>

            </div>

        `;


        /*
         * -------------------------------------------------
         * Insert card BEFORE ROBOT section
         * -------------------------------------------------
         */

        const robotHeading =
            Array.from(
                settingsPage.querySelectorAll(
                    "*"
                )
            ).find(
                element =>
                    element.textContent
                        ?.trim()
                        .toUpperCase() ===
                    "ROBOT"
            );


        if (
            robotHeading &&
            robotHeading.parentElement
        ) {

            robotHeading.parentElement
                .insertBefore(
                    card,
                    robotHeading.parentElement
                        .firstChild
                );

        } else {

            /*
             * Fallback:
             * insert near the top of settings.
             */

            const firstSection =
                settingsPage.firstElementChild;


            if (firstSection) {

                settingsPage.insertBefore(
                    card,
                    firstSection
                );

            } else {

                settingsPage.appendChild(
                    card
                );

            }

        }


        bindESP32Settings();

        loadESP32Settings();

    }


    /* =====================================================
       SET ESP32 STATUS
       ===================================================== */

    function setESP32Status(
        message,
        type = "offline"
    ) {

        const status =
            $("#esp32SettingsStatus");


        if (!status) {

            return;

        }


        status.textContent =
            message;


        status.className =
            `esp32-status ${type}`;

    }


    /* =====================================================
       UPDATE ADDRESS DISPLAY
       ===================================================== */

    function updateESP32Address() {

        const settings =
            getESP32Settings();


        const address =
            $("#esp32CurrentAddress");


        const message =
            $("#esp32ConnectionMessage");


        if (address) {

            address.textContent =
                settings.ip
                    ? `${settings.ip}:${settings.port}`
                    : "—";

        }


        if (message) {

            message.textContent =
                settings.ip
                    ? `Controller: ${settings.ip}:${settings.port}`
                    : "No ESP32 IP configured.";

        }

    }


    /* =====================================================
       LOAD SETTINGS
       ===================================================== */

    function loadESP32Settings() {

        const settings =
            getESP32Settings();


        const ipInput =
            $("#esp32IpInput");


        const portInput =
            $("#esp32PortInput");


        if (ipInput) {

            ipInput.value =
                settings.ip;

        }


        if (portInput) {

            portInput.value =
                settings.port;

        }


        updateESP32Address();


        if (settings.ip) {

            setESP32Status(
                state.connected
                    ? "CONNECTED"
                    : "OFFLINE",
                state.connected
                    ? "connected"
                    : "offline"
            );

        } else {

            setESP32Status(
                "ENTER ESP32 IP",
                "offline"
            );

        }

    }


    /* =====================================================
       BIND SETTINGS BUTTONS
       ===================================================== */

    function bindESP32Settings() {

        const ipInput =
            $("#esp32IpInput");


        const portInput =
            $("#esp32PortInput");


        const saveButton =
            $("#saveESP32Button");


        const testButton =
            $("#testESP32Button");


        const disconnectButton =
            $("#disconnectESP32Button");


        /*
         * SAVE & CONNECT
         */

        saveButton?.addEventListener(
            "click",
            () => {

                const result =
                    saveESP32Settings(
                        ipInput?.value,
                        portInput?.value
                    );


                if (!result.success) {

                    setESP32Status(
                        result.error,
                        "error"
                    );


                    return;

                }


                updateESP32Address();


                setESP32Status(
                    "CONNECTING...",
                    "testing"
                );


                disconnectESP32();


                setTimeout(
                    connectESP32,
                    150
                );

            }
        );


        /*
         * TEST CONNECTION
         */

        testButton?.addEventListener(
            "click",
            () => {

                const result =
                    saveESP32Settings(
                        ipInput?.value,
                        portInput?.value
                    );


                if (!result.success) {

                    setESP32Status(
                        result.error,
                        "error"
                    );


                    return;

                }


                updateESP32Address();


                setESP32Status(
                    "TESTING...",
                    "testing"
                );


                disconnectESP32();


                setTimeout(
                    connectESP32,
                    150
                );

            }
        );


        /*
         * DISCONNECT
         */

        disconnectButton?.addEventListener(
            "click",
            () => {

                disconnectESP32();


                setESP32Status(
                    "OFFLINE",
                    "offline"
                );

            }
        );


        /*
         * ENTER KEY
         */

        ipInput?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    saveButton?.click();

                }

            }
        );


        portInput?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    saveButton?.click();

                }

            }
        );

    }


    /* =====================================================
       CONNECT ESP32
       ===================================================== */

    function connectESP32() {

        const url =
            getESP32URL();


        if (!url) {

            setESP32Status(
                "ENTER ESP32 IP",
                "offline"
            );


            return;

        }


        if (
            ESP32.socket &&
            (
                ESP32.socket.readyState ===
                WebSocket.OPEN ||

                ESP32.socket.readyState ===
                WebSocket.CONNECTING
            )
        ) {

            return;

        }


        console.log(
            "[RIK] Connecting to:",
            url
        );


        setESP32Status(
            "CONNECTING...",
            "testing"
        );


        let socket;


        try {

            socket =
                new WebSocket(
                    url
                );

        } catch (error) {

            console.error(
                "[RIK] WebSocket error:",
                error
            );


            setESP32Status(
                "CONNECTION FAILED",
                "error"
            );


            scheduleReconnect();


            return;

        }


        ESP32.socket =
            socket;


        ESP32.connectionTimeout =
            setTimeout(
                () => {

                    if (
                        socket.readyState ===
                        WebSocket.CONNECTING
                    ) {

                        socket.close();

                    }

                },
                7000
            );


        socket.addEventListener(
            "open",
            () => {

                clearTimeout(
                    ESP32.connectionTimeout
                );


                ESP32.reconnectDelay =
                    1000;


                state.connected =
                    true;


                updateConnectionUI();


                setESP32Status(
                    "CONNECTED",
                    "connected"
                );


                updateESP32Address();


                console.log(
                    "[RIK] ESP32 CONNECTED"
                );


                startHeartbeat();


                sendPacket({

                    type: "hello",

                    client: "RIK",

                    version: 1,

                    timestamp:
                        Date.now()

                });

            }
        );


        socket.addEventListener(
            "message",
            event => {

                handleESP32Message(
                    event.data
                );

            }
        );


        socket.addEventListener(
            "close",
            () => {

                clearTimeout(
                    ESP32.connectionTimeout
                );


                stopHeartbeat();


                if (
                    ESP32.socket ===
                    socket
                ) {

                    ESP32.socket =
                        null;

                }


                state.connected =
                    false;


                updateConnectionUI();


                setESP32Status(
                    "OFFLINE",
                    "offline"
                );


                rejectPending();


                scheduleReconnect();

            }
        );


        socket.addEventListener(
            "error",
            error => {

                console.error(
                    "[RIK] ESP32 socket error:",
                    error
                );


                state.connected =
                    false;


                updateConnectionUI();


                setESP32Status(
                    "CONNECTION ERROR",
                    "error"
                );

            }
        );

    }


    /* =====================================================
       DISCONNECT
       ===================================================== */

    function disconnectESP32() {

        if (
            ESP32.reconnectTimer
        ) {

            clearTimeout(
                ESP32.reconnectTimer
            );


            ESP32.reconnectTimer =
                null;

        }


        stopHeartbeat();


        if (
            ESP32.socket
        ) {

            try {

                ESP32.socket.close();

            } catch (_) {}

        }


        ESP32.socket =
            null;


        state.connected =
            false;


        rejectPending();


        updateConnectionUI();

    }


    /* =====================================================
       RECONNECT
       ===================================================== */

    function scheduleReconnect() {

        if (
            ESP32.reconnectTimer
        ) {

            return;

        }


        if (
            !getESP32URL()
        ) {

            return;

        }


        ESP32.reconnectTimer =
            setTimeout(
                () => {

                    ESP32.reconnectTimer =
                        null;


                    connectESP32();


                    ESP32.reconnectDelay =
                        Math.min(
                            ESP32.reconnectDelay * 2,
                            ESP32.reconnectMax
                        );

                },
                ESP32.reconnectDelay
            );

    }


    /* =====================================================
       HEARTBEAT
       ===================================================== */

    function startHeartbeat() {

        stopHeartbeat();


        ESP32.heartbeatTimer =
            setInterval(
                () => {

                    if (
                        !state.connected ||
                        !ESP32.socket ||
                        ESP32.socket.readyState !==
                            WebSocket.OPEN
                    ) {

                        return;

                    }


                    sendPacket({

                        type:
                            "heartbeat",

                        timestamp:
                            Date.now()

                    });

                },
                3000
            );

    }


    function stopHeartbeat() {

        if (
            ESP32.heartbeatTimer
        ) {

            clearInterval(
                ESP32.heartbeatTimer
            );


            ESP32.heartbeatTimer =
                null;

        }

    }


    /* =====================================================
       SEND PACKET
       ===================================================== */

    function sendPacket(
        packet
    ) {

        if (
            !ESP32.socket ||
            ESP32.socket.readyState !==
                WebSocket.OPEN
        ) {

            return false;

        }


        try {

            ESP32.socket.send(
                JSON.stringify(
                    packet
                )
            );


            return true;

        } catch (error) {

            console.error(
                "[RIK] Send failed:",
                error
            );


            return false;

        }

    }


    /* =====================================================
       SEND ROBOT COMMAND
       ===================================================== */

    function sendCommand(
        command
    ) {

        if (
            !state.connected
        ) {

            console.warn(
                "[RIK] Robot is offline."
            );


            return false;

        }


        const id =
            ++ESP32.commandId;


        const packet = {

            type:
                "command",

            id,

            command,

            speed:
                state.speed,

            timestamp:
                Date.now()

        };


        if (
            !sendPacket(
                packet
            )
        ) {

            return false;

        }


        console.log(
            "[RIK → ESP32]",
            packet
        );


        const timeout =
            setTimeout(
                () => {

                    ESP32.pending.delete(
                        id
                    );

                },
                2500
            );


        ESP32.pending.set(
            id,
            {
                command,
                timeout
            }
        );


        return true;

    }


    /* =====================================================
       HANDLE ESP32 MESSAGE
       ===================================================== */

    function handleESP32Message(
        raw
    ) {

        let data;


        try {

            data =
                JSON.parse(
                    raw
                );

        } catch (_) {

            console.warn(
                "[RIK] Invalid ESP32 data:",
                raw
            );


            return;

        }


        if (
            data.type ===
            "ack"
        ) {

            const pending =
                ESP32.pending.get(
                    Number(
                        data.id
                    )
                );


            if (pending) {

                clearTimeout(
                    pending.timeout
                );


                ESP32.pending.delete(
                    Number(
                        data.id
                    )
                );

            }


            return;

        }


        if (
            data.type ===
                "telemetry" ||

            data.type ===
                "status"
        ) {

            updateTelemetry(
                data
            );

        }

    }


    /* =====================================================
       TELEMETRY
       ===================================================== */

    function updateTelemetry(
        data
    ) {

        if (
            data.soil !==
            undefined
        ) {

            state.soil =
                data.soil;

        }


        if (
            data.air !==
            undefined
        ) {

            state.air =
                data.air;

        }


        const soil =
            $("#islandSoilValue");


        if (soil) {

            soil.textContent =
                `${state.soil}%`;

        }


        const air =
            $("#islandAirValue");


        if (air) {

            air.textContent =
                state.air;

        }

    }


    /* =====================================================
       PENDING COMMANDS
       ===================================================== */

    function rejectPending() {

        ESP32.pending.forEach(
            item => {

                clearTimeout(
                    item.timeout
                );

            }
        );


        ESP32.pending.clear();

    }


    /* =====================================================
       MOVEMENT
       ===================================================== */

    function setDriveState(
        command
    ) {

        state.driveCommand =
            command;


        const status =
            $("#driveState");


        if (status) {

            status.textContent =
                command ||
                "STOPPED";

        }


        $$(".rik-pearl-button")
            .forEach(
                button => {

                    button.classList.toggle(
                        "command-active",
                        Boolean(
                            command
                        ) &&
                        button.dataset.command ===
                            command
                    );

                }
            );

    }


    function startDrive(
        command
    ) {

        if (
            !state.connected
        ) {

            return;

        }


        setDriveState(
            command
        );


        sendCommand(
            command
        );

    }


    function stopDrive(
        sendToESP = true
    ) {

        const wasMoving =
            Boolean(
                state.driveCommand
            );


        setDriveState(
            null
        );


        if (
            sendToESP &&
            wasMoving &&
            state.connected
        ) {

            sendCommand(
                "STOP"
            );

        }

    }


    /* =====================================================
       MOVEMENT BUTTONS
       ===================================================== */

    function setupMovementButtons() {

        $$(".rik-pearl-button")
            .forEach(
                button => {

                    const command =
                        button.dataset.command;


                    if (!command) {

                        return;

                    }


                    let pressed =
                        false;


                    button.addEventListener(
                        "pointerdown",
                        event => {

                            if (
                                event.button !==
                                    undefined &&
                                event.button !==
                                    0
                            ) {

                                return;

                            }


                            event.preventDefault();


                            if (
                                pressed
                            ) {

                                return;

                            }


                            pressed =
                                true;


                            button.classList.add(
                                "pressed"
                            );


                            startDrive(
                                command
                            );

                        }
                    );


                    button.addEventListener(
                        "pointerup",
                        event => {

                            event.preventDefault();


                            if (
                                !pressed
                            ) {

                                return;

                            }


                            pressed =
                                false;


                            button.classList.remove(
                                "pressed"
                            );


                            stopDrive();

                        }
                    );


                    button.addEventListener(
                        "pointercancel",
                        () => {

                            pressed =
                                false;


                            button.classList.remove(
                                "pressed"
                            );


                            stopDrive();

                        }
                    );

                }
            );

    }


    /* =====================================================
       ARM / CLAW
       ===================================================== */

    function setupArmClaw() {

        $$(".action-button")
            .forEach(
                button => {

                    const command =
                        button.dataset.command;


                    if (!command) {

                        return;

                    }


                    button.addEventListener(
                        "click",
                        () => {

                            if (
                                !state.connected
                            ) {

                                return;

                            }


                            sendCommand(
                                command
                            );


                            button.classList.add(
                                "pressed"
                            );


                            setTimeout(
                                () => {

                                    button.classList.remove(
                                        "pressed"
                                    );

                                },
                                180
                            );


                            if (
                                command ===
                                "ARM_UP"
                            ) {

                                state.armState =
                                    "ARM UP";

                            }


                            if (
                                command ===
                                "ARM_DOWN"
                            ) {

                                state.armState =
                                    "ARM DOWN";

                            }


                            if (
                                command ===
                                "OPEN"
                            ) {

                                state.clawState =
                                    "OPEN";

                            }


                            if (
                                command ===
                                "CLOSE"
                            ) {

                                state.clawState =
                                    "CLOSED";

                            }


                            const arm =
                                $("#armStatus");


                            if (arm) {

                                arm.textContent =
                                    state.armState;

                            }


                            const claw =
                                $("#clawStatus");


                            if (claw) {

                                claw.textContent =
                                    state.clawState;

                            }

                        }
                    );

                }
            );

    }


    /* =====================================================
       SPEED
       ===================================================== */

    function setupSpeed() {

        const slider =
            $("#speedSlider");


        const value =
            $("#speedValue");


        if (!slider) {

            return;

        }


        function update() {

            state.speed =
                Number(
                    slider.value
                );


            if (value) {

                value.textContent =
                    `${state.speed}%`;

            }

        }


        slider.addEventListener(
            "input",
            update
        );


        update();

    }


    /* =====================================================
       SETTINGS NAVIGATION
       ===================================================== */

    function setupSettingsNavigation() {

        const settingsButton =
            $("#settingsButton");


        const settingsPage =
            $("#settingsPage");


        const controlPage =
            $("#controlPage");


        const backButton =
            $("#settingsBackButton");


        settingsButton?.addEventListener(
            "click",
            () => {

                stopDrive();


                if (controlPage) {

                    controlPage.style.display =
                        "none";

                }


                if (settingsPage) {

                    settingsPage.style.display =
                        "block";

                }


                /*
                 * IMPORTANT:
                 * Create the ESP32 card
                 * when Settings is opened.
                 */

                createESP32SettingsCard();

            }
        );


        backButton?.addEventListener(
            "click",
            () => {

                if (settingsPage) {

                    settingsPage.style.display =
                        "none";

                }


                if (controlPage) {

                    controlPage.style.display =
                        "";

                }

            }
        );


        /*
         * Create immediately too,
         * so it exists even if Settings
         * starts open.
         */

        createESP32SettingsCard();

    }


    /* =====================================================
       KEYBOARD
       ===================================================== */

    function setupKeyboard() {

        const keys = {

            ArrowUp:
                "FORWARD",

            ArrowDown:
                "BACKWARD",

            ArrowLeft:
                "LEFT",

            ArrowRight:
                "RIGHT"

        };


        document.addEventListener(
            "keydown",
            event => {

                const command =
                    keys[event.key];


                if (!command) {

                    return;

                }


                const active =
                    document.activeElement;


                if (
                    active &&
                    (
                        active.tagName ===
                            "INPUT" ||

                        active.tagName ===
                            "TEXTAREA"
                    )
                ) {

                    return;

                }


                if (
                    event.repeat
                ) {

                    return;

                }


                event.preventDefault();


                startDrive(
                    command
                );

            }
        );


        document.addEventListener(
            "keyup",
            event => {

                if (
                    keys[event.key]
                ) {

                    event.preventDefault();

                    stopDrive();

                }

            }
        );

    }


    /* =====================================================
       SAFETY
       ===================================================== */

    function setupSafety() {

        window.addEventListener(
            "blur",
            () => {

                stopDrive();

            }
        );


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.hidden
                ) {

                    stopDrive();

                }

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    stopDrive();

                }

            }
        );

    }


    /* =====================================================
       BACKGROUND PERFORMANCE
       ===================================================== */

    function setupBackgroundPerformance() {

        /*
         * Pause expensive animated
         * background work when the tab
         * is not visible.
         */

        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.hidden
                ) {

                    document.body.classList.add(
                        "rik-tab-hidden"
                    );

                } else {

                    document.body.classList.remove(
                        "rik-tab-hidden"
                    );

                }

            }
        );

    }


    /* =====================================================
       INIT
       ===================================================== */

    function init() {

        console.log(
            "=============================="
        );


        console.log(
            "RIK ROBOT IN KONTROL"
        );


        console.log(
            "Initializing..."
        );


        console.log(
            "=============================="
        );


        /*
         * IMPORTANT:
         * Build ESP32 Settings UI.
         */

        createESP32SettingsCard();


        setupSettingsNavigation();


        setupMovementButtons();


        setupArmClaw();


        setupSpeed();


        setupKeyboard();


        setupSafety();


        setupBackgroundPerformance();


        /*
         * Initial connection state.
         */

        state.connected =
            false;


        updateConnectionUI();


        /*
         * Automatically connect
         * to saved IP.
         */

        const settings =
            getESP32Settings();


        if (
            settings.ip
        ) {

            console.log(
                "[RIK] Saved ESP32:",
                `${settings.ip}:${settings.port}`
            );


            connectESP32();

        } else {

            console.log(
                "[RIK] No ESP32 IP configured."
            );


            setESP32Status(
                "ENTER ESP32 IP",
                "offline"
            );

        }


        /*
         * Public API.
         */

        window.RIK = {

            state,

            connectESP32,

            disconnectESP32,

            sendCommand,

            stopDrive,

            getESP32Settings,

            saveESP32Settings,

            getESP32URL

        };


        console.log(
            "[RIK] READY"
        );

    }


    /* =====================================================
       START
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );

    } else {

        init();

    }

})();