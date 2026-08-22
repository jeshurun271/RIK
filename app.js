/* =========================================================
   RIK — ROBOT IN KONTROL
   FULL APP.JS
   ---------------------------------------------------------
   Includes:
   - Animated bending background lines
   - Performance-friendly SVG animation
   - Pearl-style buttons
   - Movement controls
   - Arm & claw controls
   - Speed control
   - Timer
   - ESP32 IP settings
   - WebSocket communication
   - Reconnection
   - Telemetry
   - Keyboard controls
   - Safety stop
   ========================================================= */

"use strict";


/* =========================================================
   GLOBAL STATE
   ========================================================= */

const RIK = {

    connected: false,

    socket: null,

    reconnectTimer: null,

    heartbeatTimer: null,

    reconnectDelay: 1500,

    maxReconnectDelay: 10000,

    speed: 65,

    driveCommand: null,

    armState: "READY",

    clawState: "READY",

    timerSeconds: 0,

    timerInterval: null,

    commandId: 0,

    pageHidden: false,

    backgroundAnimation: true

};


/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE = {

    ip: "rik_esp32_ip",

    port: "rik_esp32_port"

};


const DEFAULT_ESP32_PORT = 81;


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector, parent = document) {

    return parent.querySelector(selector);

}


function $$(selector, parent = document) {

    return Array.from(
        parent.querySelectorAll(selector)
    );

}


/* =========================================================
   ESP32 SETTINGS
   ========================================================= */

function getESP32Settings() {

    return {

        ip:
            localStorage.getItem(
                STORAGE.ip
            ) || "",

        port:
            localStorage.getItem(
                STORAGE.port
            ) || String(
                DEFAULT_ESP32_PORT
            )

    };

}


function saveESP32Settings(ip, port) {

    ip =
        String(ip || "")
            .trim();

    port =
        String(
            port ||
            DEFAULT_ESP32_PORT
        ).trim();


    if (!ip) {

        return false;

    }


    localStorage.setItem(
        STORAGE.ip,
        ip
    );


    localStorage.setItem(
        STORAGE.port,
        port
    );


    return true;

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


/* =========================================================
   CONNECTION STATUS UI
   ========================================================= */

function updateConnectionUI() {

    const connected =
        RIK.connected;


    const statusElements = [

        $("#connectionText"),

        $("#connectionStatus"),

        $("#robotStatus")

    ];


    statusElements.forEach(
        element => {

            if (!element) {

                return;

            }


            if (
                element.id ===
                "robotStatus"
            ) {

                element.textContent =
                    connected
                        ? "CONNECTED"
                        : "OFFLINE";

            } else {

                element.textContent =
                    connected
                        ? "CONNECTED"
                        : "OFFLINE";

            }


            element.classList.toggle(
                "connected",
                connected
            );


            element.classList.toggle(
                "offline",
                !connected
            );

        }
    );


    const dots = [

        $("#connectionDot"),

        $("#driveDot")

    ];


    dots.forEach(
        dot => {

            if (!dot) {

                return;

            }


            dot.classList.toggle(
                "connected",
                connected
            );


            dot.classList.toggle(
                "offline",
                !connected
            );

        }
    );


    /*
     * Safety:
     * If ESP32 disconnects, stop movement.
     */

    if (!connected) {

        stopDrive(
            false
        );

    }

}


/* =========================================================
   ESP32 SETTINGS UI
   ---------------------------------------------------------
   Creates the IP input automatically.
   ========================================================= */

function createESP32Settings() {

    if (
        $("#esp32ConnectionCard")
    ) {

        loadESP32Settings();

        return;

    }


    const settingsPage =
        $(
            "#settingsPage"
        );


    if (!settingsPage) {

        console.warn(
            "RIK: #settingsPage not found."
        );

        return;

    }


    /*
     * CSS for dynamically-created settings card.
     */

    if (
        !$("#rik-esp32-settings-style")
    ) {

        const style =
            document.createElement(
                "style"
            );


        style.id =
            "rik-esp32-settings-style";


        style.textContent = `

            #esp32ConnectionCard {

                width: 100%;

                margin: 0 0 26px;

                padding: 24px;

                box-sizing: border-box;

                border-radius: 20px;

                border:
                    1px solid
                    rgba(255,255,255,.14);

                background:
                    rgba(20,20,22,.72);

                box-shadow:
                    inset 0 1px 0
                    rgba(255,255,255,.08),
                    0 18px 45px
                    rgba(0,0,0,.25);

                backdrop-filter:
                    blur(20px);

                -webkit-backdrop-filter:
                    blur(20px);

                color: white;

            }


            .rik-esp32-heading {

                display: flex;

                justify-content:
                    space-between;

                align-items:
                    center;

                margin-bottom: 7px;

            }


            .rik-esp32-heading h3 {

                margin: 0;

                font-size: 14px;

                font-weight: 800;

                letter-spacing:
                    .1em;

            }


            .rik-esp32-description {

                margin:
                    0 0 20px;

                color:
                    rgba(255,255,255,.45);

                font-size: 11px;

            }


            .rik-esp32-fields {

                display: grid;

                grid-template-columns:
                    minmax(0,1fr)
                    130px;

                gap: 12px;

                margin-bottom: 14px;

            }


            .rik-esp32-field {

                display: flex;

                flex-direction: column;

                gap: 7px;

            }


            .rik-esp32-field label {

                font-size: 9px;

                font-weight: 800;

                letter-spacing:
                    .1em;

                color:
                    rgba(255,255,255,.45);

            }


            .rik-esp32-field input {

                width: 100%;

                height: 44px;

                box-sizing: border-box;

                padding:
                    0 13px;

                border-radius: 10px;

                border:
                    1px solid
                    rgba(255,255,255,.13);

                background:
                    rgba(255,255,255,.055);

                color: white;

                outline: none;

                font-family:
                    inherit;

            }


            .rik-esp32-field input:focus {

                border-color:
                    rgba(30,235,120,.65);

                box-shadow:
                    0 0 0 3px
                    rgba(30,235,120,.08);

            }


            .rik-esp32-buttons {

                display: flex;

                gap: 9px;

                flex-wrap: wrap;

            }


            .rik-esp32-btn {

                height: 40px;

                padding:
                    0 16px;

                border-radius: 10px;

                border:
                    1px solid
                    rgba(255,255,255,.13);

                background:
                    rgba(255,255,255,.06);

                color: white;

                font-family:
                    inherit;

                font-size: 9px;

                font-weight: 800;

                letter-spacing:
                    .08em;

                cursor: pointer;

                transition:
                    .18s ease;

            }


            .rik-esp32-btn:hover {

                background:
                    rgba(255,255,255,.12);

                transform:
                    translateY(-1px);

            }


            .rik-esp32-btn.primary {

                color: #001509;

                border-color:
                    rgba(0,255,120,.4);

                background:
                    linear-gradient(
                        135deg,
                        #35f58b,
                        #08c965
                    );

            }


            .rik-esp32-status-row {

                display: flex;

                justify-content:
                    space-between;

                gap: 10px;

                padding-top: 15px;

                margin-top: 15px;

                border-top:
                    1px solid
                    rgba(255,255,255,.08);

            }


            #rikEsp32Status {

                font-size: 9px;

                font-weight: 800;

                letter-spacing:
                    .08em;

            }


            #rikEsp32Address {

                color:
                    rgba(255,255,255,.35);

                font-size: 9px;

            }


            @media(max-width:700px) {

                .rik-esp32-fields {

                    grid-template-columns:
                        1fr;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    const card =
        document.createElement(
            "section"
        );


    card.id =
        "esp32ConnectionCard";


    card.innerHTML = `

        <div class="rik-esp32-heading">

            <h3>
                ESP32 CONNECTION
            </h3>

            <span
                id="rikEsp32Status"
            >
                OFFLINE
            </span>

        </div>


        <p class="rik-esp32-description">

            Enter the IP address of your ESP32
            robot controller.

        </p>


        <div class="rik-esp32-fields">

            <div class="rik-esp32-field">

                <label>
                    ESP32 IP ADDRESS
                </label>

                <input
                    id="esp32IpInput"
                    type="text"
                    inputmode="decimal"
                    placeholder="192.168.1.100"
                    autocomplete="off"
                >

            </div>


            <div class="rik-esp32-field">

                <label>
                    WEBSOCKET PORT
                </label>

                <input
                    id="esp32PortInput"
                    type="number"
                    min="1"
                    max="65535"
                    value="81"
                >

            </div>

        </div>


        <div class="rik-esp32-buttons">

            <button
                id="saveESP32Button"
                class="rik-esp32-btn primary"
                type="button"
            >
                SAVE & CONNECT
            </button>


            <button
                id="testESP32Button"
                class="rik-esp32-btn"
                type="button"
            >
                TEST CONNECTION
            </button>


            <button
                id="disconnectESP32Button"
                class="rik-esp32-btn"
                type="button"
            >
                DISCONNECT
            </button>

        </div>


        <div class="rik-esp32-status-row">

            <span
                id="rikEsp32StatusMessage"
            >
                No ESP32 configured.
            </span>

            <span
                id="rikEsp32Address"
            >
                —
            </span>

        </div>

    `;


    /*
     * Put card near top of Settings.
     */

    settingsPage.prepend(
        card
    );


    bindESP32Settings();

    loadESP32Settings();

}


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


    updateESP32SettingsUI();

}


function updateESP32SettingsUI() {

    const settings =
        getESP32Settings();


    const status =
        $("#rikEsp32Status");


    const message =
        $("#rikEsp32StatusMessage");


    const address =
        $("#rikEsp32Address");


    if (address) {

        address.textContent =
            settings.ip
                ? `${settings.ip}:${settings.port}`
                : "—";

    }


    if (status) {

        status.textContent =
            RIK.connected
                ? "CONNECTED"
                : settings.ip
                    ? "OFFLINE"
                    : "NOT CONFIGURED";

        status.style.color =
            RIK.connected
                ? "#20e878"
                : "#999";

    }


    if (message) {

        message.textContent =
            RIK.connected
                ? "ESP32 connection active."
                : settings.ip
                    ? "Saved ESP32 address."
                    : "Enter ESP32 IP address.";

    }

}


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


    saveButton?.addEventListener(
        "click",
        () => {

            const saved =
                saveESP32Settings(
                    ipInput?.value,
                    portInput?.value
                );


            if (!saved) {

                alert(
                    "Please enter the ESP32 IP address."
                );

                return;

            }


            disconnectESP32();


            updateESP32SettingsUI();


            setTimeout(
                connectESP32,
                150
            );

        }
    );


    testButton?.addEventListener(
        "click",
        () => {

            const saved =
                saveESP32Settings(
                    ipInput?.value,
                    portInput?.value
                );


            if (!saved) {

                alert(
                    "Please enter the ESP32 IP address."
                );

                return;

            }


            disconnectESP32();


            updateESP32SettingsUI();


            setTimeout(
                connectESP32,
                150
            );

        }
    );


    disconnectButton?.addEventListener(
        "click",
        () => {

            disconnectESP32();

            updateESP32SettingsUI();

        }
    );


    ipInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                saveButton?.click();

            }

        }
    );


    portInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                saveButton?.click();

            }

        }
    );

}


/* =========================================================
   ESP32 WEBSOCKET
   ========================================================= */

function connectESP32() {

    const url =
        getESP32URL();


    if (!url) {

        updateESP32SettingsUI();

        return;

    }


    if (
        RIK.socket &&
        (
            RIK.socket.readyState ===
                WebSocket.OPEN ||

            RIK.socket.readyState ===
                WebSocket.CONNECTING
        )
    ) {

        return;

    }


    console.log(
        "RIK → ESP32:",
        url
    );


    const socket =
        new WebSocket(
            url
        );


    RIK.socket =
        socket;


    socket.addEventListener(
        "open",
        () => {

            RIK.connected =
                true;


            RIK.reconnectDelay =
                1500;


            updateConnectionUI();

            updateESP32SettingsUI();


            console.log(
                "RIK: ESP32 CONNECTED"
            );


            startHeartbeat();


            sendPacket({

                type:
                    "hello",

                client:
                    "RIK",

                version:
                    1,

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

            if (
                RIK.socket === socket
            ) {

                RIK.socket =
                    null;

            }


            RIK.connected =
                false;


            stopHeartbeat();


            updateConnectionUI();

            updateESP32SettingsUI();


            scheduleReconnect();

        }
    );


    socket.addEventListener(
        "error",
        error => {

            console.warn(
                "RIK ESP32 WebSocket error:",
                error
            );


            RIK.connected =
                false;


            updateConnectionUI();

            updateESP32SettingsUI();

        }
    );

}


function disconnectESP32() {

    if (
        RIK.reconnectTimer
    ) {

        clearTimeout(
            RIK.reconnectTimer
        );


        RIK.reconnectTimer =
            null;

    }


    stopHeartbeat();


    if (RIK.socket) {

        try {

            RIK.socket.close();

        } catch (_) {}

    }


    RIK.socket =
        null;


    RIK.connected =
        false;


    stopDrive(
        false
    );


    updateConnectionUI();

}


function scheduleReconnect() {

    if (
        RIK.reconnectTimer
    ) {

        return;

    }


    if (
        !getESP32URL()
    ) {

        return;

    }


    RIK.reconnectTimer =
        setTimeout(
            () => {

                RIK.reconnectTimer =
                    null;


                connectESP32();


                RIK.reconnectDelay =
                    Math.min(
                        RIK.reconnectDelay * 1.8,
                        RIK.maxReconnectDelay
                    );

            },
            RIK.reconnectDelay
        );

}


function startHeartbeat() {

    stopHeartbeat();


    RIK.heartbeatTimer =
        setInterval(
            () => {

                if (
                    !RIK.connected
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
            5000
        );

}


function stopHeartbeat() {

    if (
        RIK.heartbeatTimer
    ) {

        clearInterval(
            RIK.heartbeatTimer
        );


        RIK.heartbeatTimer =
            null;

    }

}


/* =========================================================
   SEND PACKET
   ========================================================= */

function sendPacket(
    packet
) {

    if (
        !RIK.socket ||
        RIK.socket.readyState !==
            WebSocket.OPEN
    ) {

        return false;

    }


    try {

        RIK.socket.send(
            JSON.stringify(
                packet
            )
        );


        return true;

    } catch (error) {

        console.error(
            "RIK send error:",
            error
        );


        return false;

    }

}


/* =========================================================
   ROBOT COMMAND PROTOCOL
   ========================================================= */

function sendCommand(
    command
) {

    if (
        !RIK.connected
    ) {

        console.warn(
            "RIK: ESP32 is offline."
        );

        return false;

    }


    RIK.commandId++;


    const packet = {

        type:
            "command",

        id:
            RIK.commandId,

        command,

        speed:
            RIK.speed,

        timestamp:
            Date.now()

    };


    console.log(
        "RIK → ESP32:",
        packet
    );


    return sendPacket(
        packet
    );

}


/* =========================================================
   RECEIVE ESP32 DATA
   ========================================================= */

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
            "RIK: Non-JSON ESP32 message:",
            raw
        );

        return;

    }


    console.log(
        "RIK ← ESP32:",
        data
    );


    if (
        data.type ===
        "telemetry"
    ) {

        updateTelemetry(
            data
        );

    }


    if (
        data.type ===
        "status"
    ) {

        updateTelemetry(
            data
        );

    }


    if (
        data.type ===
        "ack"
    ) {

        console.log(
            "RIK: Command acknowledged:",
            data
        );

    }

}


function updateTelemetry(
    data
) {

    /*
     * Soil moisture
     */

    const soil =
        data.soil ??
        data.soilMoisture;


    if (
        soil !== undefined
    ) {

        const elements = [

            $("#soilValue"),

            $("#islandSoilValue")

        ];


        elements.forEach(
            element => {

                if (element) {

                    element.textContent =
                        `${soil}%`;

                }

            }
        );

    }


    /*
     * Air quality
     */

    const air =
        data.air ??
        data.mq135 ??
        data.aqi;


    if (
        air !== undefined
    ) {

        const elements = [

            $("#airValue"),

            $("#islandAirValue")

        ];


        elements.forEach(
            element => {

                if (element) {

                    element.textContent =
                        air;

                }

            }
        );

    }


    /*
     * RSSI
     */

    if (
        data.rssi !== undefined
    ) {

        const signal =
            $("#signalValue");


        if (signal) {

            signal.textContent =
                `${data.rssi} dBm`;

        }

    }

}


/* =========================================================
   MOVEMENT
   ========================================================= */

function startDrive(
    command
) {

    if (
        !RIK.connected
    ) {

        return;

    }


    RIK.driveCommand =
        command;


    updateDriveUI(
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
            RIK.driveCommand
        );


    RIK.driveCommand =
        null;


    updateDriveUI(
        null
    );


    if (
        sendToESP &&
        wasMoving &&
        RIK.connected
    ) {

        sendCommand(
            "STOP"
        );

    }

}


function updateDriveUI(
    command
) {

    const driveState =
        $("#driveState");


    if (driveState) {

        driveState.textContent =
            command ||
            "STOPPED";

    }


    $$(".control-button, .rik-pearl-button")
        .forEach(
            button => {

                const active =
                    command &&
                    button.dataset.command ===
                        command;


                button.classList.toggle(
                    "command-active",
                    Boolean(
                        active
                    )
                );

            }
        );

}


/* =========================================================
   MOVEMENT BUTTONS
   ========================================================= */

function setupMovementButtons() {

    const buttons =
        $(
            ".control-button, .movement-button"
        );


    const movementButtons =
        buttons
            ? [ ...$(
                ".control-button, .movement-button"
            ) ]
            : [];


    movementButtons.forEach(
        button => {

            const command =
                button.dataset.command;


            if (!command) {

                return;

            }


            let held =
                false;


            button.addEventListener(
                "pointerdown",
                event => {

                    event.preventDefault();


                    if (
                        held
                    ) {

                        return;

                    }


                    held =
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


                    if (!held) {

                        return;

                    }


                    held =
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

                    held =
                        false;


                    button.classList.remove(
                        "pressed"
                    );


                    stopDrive();

                }
            );


            button.addEventListener(
                "pointerleave",
                () => {

                    if (
                        held
                    ) {

                        held =
                            false;


                        button.classList.remove(
                            "pressed"
                        );


                        stopDrive();

                    }

                }
            );

        }
    );

}


/* =========================================================
   ARM & CLAW
   ========================================================= */

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
                    event => {

                        event.preventDefault();


                        if (
                            !RIK.connected
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


                        updateArmClawState(
                            command
                        );

                    }
                );

            }
        );

}


function updateArmClawState(
    command
) {

    if (
        command ===
        "ARM_UP"
    ) {

        RIK.armState =
            "ARM UP";

    }


    if (
        command ===
        "ARM_DOWN"
    ) {

        RIK.armState =
            "ARM DOWN";

    }


    if (
        command ===
        "OPEN"
    ) {

        RIK.clawState =
            "OPEN";

    }


    if (
        command ===
        "CLOSE"
    ) {

        RIK.clawState =
            "CLOSED";

    }


    const arm =
        $("#armPosition");


    if (arm) {

        arm.textContent =
            RIK.armState;

    }


    const claw =
        $("#clawPosition");


    if (claw) {

        claw.textContent =
            RIK.clawState;

    }

}


/* =========================================================
   SPEED
   ========================================================= */

function setupSpeed() {

    const slider =
        $("#speedSlider");


    const value =
        $("#speedValue");


    if (!slider) {

        return;

    }


    RIK.speed =
        Number(
            slider.value
        ) || 65;


    function update() {

        RIK.speed =
            Number(
                slider.value
            );


        if (value) {

            value.textContent =
                `${RIK.speed}%`;

        }

    }


    slider.addEventListener(
        "input",
        update
    );


    update();

}


/* =========================================================
   KEYBOARD CONTROL
   ========================================================= */

function setupKeyboard() {

    const commands = {

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
                commands[
                    event.key
                ];


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
                commands[
                    event.key
                ]
            ) {

                event.preventDefault();


                stopDrive();

            }

        }
    );

}


/* =========================================================
   SAFETY
   ========================================================= */

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

            RIK.pageHidden =
                document.hidden;


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


/* =========================================================
   TIMER
   ========================================================= */

function setupTimer() {

    const timerButton =
        $("#timerButton");


    const overlay =
        $("#timerOverlay");


    const close =
        $("#closeTimer");


    const start =
        $("#startTimer");


    const reset =
        $("#resetTimer");


    const minutes =
        $("#timerMinutes");


    const seconds =
        $("#timerSeconds");


    const display =
        $("#timerDisplay");


    function render() {

        const mins =
            Math.floor(
                RIK.timerSeconds /
                60
            );


        const secs =
            RIK.timerSeconds %
            60;


        const formatted =
            `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;


        if (display) {

            display.textContent =
                formatted;

        }


        const displays =
            $$(".timer-value");


        displays.forEach(
            element => {

                element.textContent =
                    formatted;

            }
        );

    }


    timerButton?.addEventListener(
        "click",
        () => {

            overlay?.classList.add(
                "show"
            );

        }
    );


    close?.addEventListener(
        "click",
        () => {

            overlay?.classList.remove(
                "show"
            );

        }
    );


    overlay?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                overlay
            ) {

                overlay.classList.remove(
                    "show"
                );

            }

        }
    );


    start?.addEventListener(
        "click",
        () => {

            const mins =
                Math.max(
                    0,
                    Number(
                        minutes?.value
                    ) || 0
                );


            const secs =
                Math.max(
                    0,
                    Math.min(
                        59,
                        Number(
                            seconds?.value
                        ) || 0
                    )
                );


            RIK.timerSeconds =
                mins * 60 +
                secs;


            if (
                RIK.timerSeconds <=
                0
            ) {

                return;

            }


            clearInterval(
                RIK.timerInterval
            );


            render();


            overlay?.classList.remove(
                "show"
            );


            RIK.timerInterval =
                setInterval(
                    () => {

                        RIK.timerSeconds--;


                        render();


                        if (
                            RIK.timerSeconds <=
                            0
                        ) {

                            clearInterval(
                                RIK.timerInterval
                            );


                            RIK.timerInterval =
                                null;


                            timerFinished();

                        }

                    },
                    1000
                );

        }
    );


    reset?.addEventListener(
        "click",
        () => {

            clearInterval(
                RIK.timerInterval
            );


            RIK.timerInterval =
                null;


            RIK.timerSeconds =
                0;


            render();

        }
    );


    render();

}


function timerFinished() {

    /*
     * Stop robot when timer finishes.
     */

    stopDrive();


    /*
     * Browser notification/sound can
     * be added later.
     */

    console.log(
        "RIK: TIMER FINISHED"
    );

}


/* =========================================================
   PEARL BUTTON EFFECT
   ---------------------------------------------------------
   Keeps existing buttons and upgrades them.
   ========================================================= */

function setupPearlButtons() {

    if (
        $("#rik-pearl-style")
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "rik-pearl-style";


    style.textContent = `

        .control-button,
        .movement-button,
        .action-button {

            position: relative;

            overflow: hidden;

            isolation: isolate;

            cursor: pointer;

            transition:
                transform .18s ease,
                box-shadow .18s ease,
                filter .18s ease;

        }


        .control-button::before,
        .movement-button::before,
        .action-button::before {

            content: "";

            position: absolute;

            left: 6%;

            right: 6%;

            top: 8%;

            height: 42%;

            border-radius:
                999px 999px 35% 35%;

            background:
                linear-gradient(
                    180deg,
                    rgba(255,255,255,.42),
                    rgba(255,255,255,.08),
                    transparent
                );

            pointer-events: none;

            z-index: -1;

            transition:
                transform .25s ease,
                opacity .25s ease;

        }


        .control-button::after,
        .movement-button::after,
        .action-button::after {

            content: "";

            position: absolute;

            width: 130%;

            height: 100%;

            left: -15%;

            bottom: -65%;

            border-radius: 50%;

            background:
                rgba(255,255,255,.09);

            pointer-events: none;

            z-index: -1;

            transition:
                transform .3s ease;

        }


        .control-button:hover,
        .movement-button:hover,
        .action-button:hover {

            transform:
                translateY(-2px);

            filter:
                brightness(1.08);

        }


        .control-button:hover::before,
        .movement-button:hover::before,
        .action-button:hover::before {

            transform:
                translateY(-6%);

        }


        .control-button:hover::after,
        .movement-button:hover::after,
        .action-button:hover::after {

            transform:
                translateY(-7%);

        }


        .control-button:active,
        .movement-button:active,
        .action-button:active,
        .control-button.pressed,
        .movement-button.pressed,
        .action-button.pressed,
        .command-active {

            transform:
                translateY(3px)
                scale(.985);

            filter:
                brightness(1.18);

        }


        .control-button.pressed::before,
        .movement-button.pressed::before,
        .action-button.pressed::before {

            opacity:
                .65;

        }

    `;


    document.head.appendChild(
        style
    );

}


/* =========================================================
   ANIMATED BENDING BACKGROUND
   ---------------------------------------------------------
   IMPORTANT:
   This is the background we were building.

   It uses ONE SVG with multiple paths instead of
   dozens of DOM elements.

   This keeps the animation lightweight.
   ========================================================= */

function createAnimatedBackground() {

    /*
     * Don't duplicate it.
     */

    if (
        $("#rikFlowBackground")
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.textContent = `

        #rikFlowBackground {

            position:
                fixed;

            inset:
                0;

            width:
                100%;

            height:
                100%;

            z-index:
                0;

            pointer-events:
                none;

            overflow:
                hidden;

            background:
                #000;

        }


        #rikFlowBackground svg {

            position:
                absolute;

            width:
                125%;

            height:
                125%;

            left:
                -12.5%;

            top:
                -12.5%;

            overflow:
                visible;

        }


        #rikFlowBackground
        .flow-line {

            fill:
                none;

            stroke:
                rgba(180,190,205,.28);

            stroke-width:
                0.8;

            vector-effect:
                non-scaling-stroke;

            stroke-linecap:
                round;

            stroke-dasharray:
                900 1400;

            animation:
                rikFlow
                18s
                linear
                infinite;

            will-change:
                stroke-dashoffset;

        }


        #rikFlowBackground
        .flow-line:nth-child(2n) {

            animation-duration:
                22s;

        }


        #rikFlowBackground
        .flow-line:nth-child(3n) {

            animation-duration:
                27s;

        }


        #rikFlowBackground
        .flow-line:nth-child(4n) {

            animation-duration:
                31s;

        }


        #rikFlowBackground
        .flow-line.bright {

            stroke:
                rgba(220,225,235,.45);

            stroke-width:
                1;

        }


        @keyframes rikFlow {

            from {

                stroke-dashoffset:
                    0;

            }

            to {

                stroke-dashoffset:
                    -2300px;

            }

        }


        /*
         * When tab is hidden:
         * remove animation work.
         */

        body.rik-tab-hidden
        #rikFlowBackground
        .flow-line {

            animation-play-state:
                paused;

        }


        /*
         * Make sure your actual UI
         * remains ABOVE the lines.
         */

        body > *:not(#rikFlowBackground) {

            position:
                relative;

            z-index:
                1;

        }


        /*
         * Existing main containers
         * should stay above background.
         */

        main,
        #app,
        #root,
        .app,
        .page,
        .dashboard,
        .controller,
        .settings-page,
        #controlPage,
        #settingsPage {

            position:
                relative;

            z-index:
                1;

        }

    `;


    document.head.appendChild(
        style
    );


    const background =
        document.createElement(
            "div"
        );


    background.id =
        "rikFlowBackground";


    /*
     * Large curved/bending paths.
     *
     * These intentionally bend toward
     * the controller area instead of
     * simply moving horizontally.
     */

    const paths = [

        "M -300 80 C 80 40, 260 70, 430 180 S 780 410, 1450 360",

        "M -300 110 C 60 70, 250 100, 440 210 S 800 440, 1450 390",

        "M -300 145 C 40 105, 230 135, 450 245 S 810 470, 1450 425",

        "M -300 180 C 30 145, 210 170, 460 280 S 820 500, 1450 460",

        "M -300 220 C 40 180, 210 205, 470 315 S 830 530, 1450 500",

        "M -300 265 C 60 220, 220 245, 480 350 S 850 560, 1450 535",

        "M -300 315 C 80 260, 230 290, 490 390 S 870 590, 1450 570",

        "M -300 370 C 90 310, 240 340, 500 430 S 890 620, 1450 610",

        "M -300 430 C 100 370, 250 395, 510 470 S 910 655, 1450 650",

        "M -300 495 C 110 430, 260 455, 520 515 S 930 690, 1450 695",

        "M -300 560 C 120 495, 270 515, 530 560 S 950 720, 1450 740",

        "M -300 630 C 120 555, 280 575, 540 610 S 970 750, 1450 790",

        "M -300 705 C 130 620, 290 640, 550 665 S 990 785, 1450 835",

        "M -300 780 C 140 690, 300 710, 560 720 S 1010 820, 1450 880",

        "M -300 855 C 150 760, 310 780, 570 780 S 1030 860, 1450 925",

        "M -300 930 C 160 830, 320 850, 580 840 S 1050 900, 1450 970"

    ];


    const svg =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );


    svg.setAttribute(
        "viewBox",
        "0 0 1400 1000"
    );


    svg.setAttribute(
        "preserveAspectRatio",
        "none"
    );


    paths.forEach(
        (d, index) => {

            const path =
                document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "path"
                );


            path.setAttribute(
                "d",
                d
            );


            path.classList.add(
                "flow-line"
            );


            if (
                index === 0 ||
                index === 7 ||
                index === 14
            ) {

                path.classList.add(
                    "bright"
                );

            }


            /*
             * Slightly different
             * starting positions.
             */

            path.style.animationDelay =
                `${-index * 1.25}s`;


            svg.appendChild(
                path
            );

        }
    );


    background.appendChild(
        svg
    );


    /*
     * Put background FIRST so all
     * controls remain above it.
     */

    document.body.prepend(
        background
    );

}


/* =========================================================
   SETTINGS NAVIGATION
   ========================================================= */

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
                    "";

            }


            createESP32Settings();

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
     * If Settings already starts
     * visible, create the card now.
     */

    if (
        settingsPage &&
        getComputedStyle(
            settingsPage
        ).display !==
            "none"
    ) {

        createESP32Settings();

    }

}


/* =========================================================
   PERFORMANCE
   ========================================================= */

function setupPerformance() {

    /*
     * Pause background animation
     * when browser tab isn't visible.
     */

    document.addEventListener(
        "visibilitychange",
        () => {

            RIK.pageHidden =
                document.hidden;


            document.body.classList.toggle(
                "rik-tab-hidden",
                document.hidden
            );

        }
    );

}


/* =========================================================
   INITIALIZE
   ========================================================= */

function initRIK() {

    console.log(
        "================================="
    );


    console.log(
        "RIK — ROBOT IN KONTROL"
    );


    console.log(
        "Initializing..."
    );


    console.log(
        "================================="
    );


    /*
     * BACKGROUND FIRST.
     *
     * This restores the flowing
     * bending lines.
     */

    createAnimatedBackground();


    /*
     * Pearl effects.
     */

    setupPearlButtons();


    /*
     * Controls.
     */

    setupMovementButtons();

    setupArmClaw();

    setupSpeed();

    setupKeyboard();


    /*
     * Safety.
     */

    setupSafety();


    /*
     * Timer.
     */

    setupTimer();


    /*
     * Settings.
     */

    createESP32Settings();

    setupSettingsNavigation();


    /*
     * Performance.
     */

    setupPerformance();


    /*
     * Initial connection state.
     */

    RIK.connected =
        false;


    updateConnectionUI();


    /*
     * Connect automatically if
     * an ESP32 IP was already saved.
     */

    const settings =
        getESP32Settings();


    if (
        settings.ip
    ) {

        console.log(
            "RIK: Saved ESP32:",
            `${settings.ip}:${settings.port}`
        );


        connectESP32();

    } else {

        console.log(
            "RIK: No ESP32 IP configured."
        );

    }


    /*
     * Expose useful functions
     * for debugging.
     */

    window.RIK = {

        state:
            RIK,

        connectESP32,

        disconnectESP32,

        sendCommand,

        startDrive,

        stopDrive,

        getESP32Settings,

        saveESP32Settings,

        getESP32URL

    };


    console.log(
        "RIK: READY"
    );

}


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initRIK,
        {
            once: true
        }
    );

} else {

    initRIK();

}