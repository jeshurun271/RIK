"use strict";

/* ============================================================
   RIK — ROBOT IN KONTROL
   FULL APP.JS

   INCLUDED:
   ------------------------------------------------------------
   ✓ Animated bending background lines
   ✓ Performance-friendly line animation
   ✓ Pearl-style movement buttons
   ✓ Pearl-style ARM + CLAW buttons
   ✓ Haptic feedback
   ✓ Haptic Settings toggle
   ✓ Self-adjusting movement controls
   ✓ Button-size setting
   ✓ Responsive / orientation adjustment
   ✓ ESP32 IP + WebSocket port
   ✓ WebSocket connection / reconnect
   ✓ Telemetry
   ✓ Keyboard controls
   ✓ Safety STOP
   ✓ Speed control
   ✓ Timer
   ✓ Settings navigation
   ✓ Ambient-motion toggle
   ============================================================ */


/* ============================================================
   GLOBAL STATE
   ============================================================ */

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

    commandId: 0,

    timerSeconds: 0,

    timerInterval: null,

    hapticsEnabled: true,

    ambientMotion: true,

    buttonScale: 1,

    hapticTimer: null,

    pageHidden: false,

    resizeTimer: null

};


/* ============================================================
   STORAGE
   ============================================================ */

const STORAGE = {

    ip: "rik_esp32_ip",

    port: "rik_esp32_port",

    haptics: "rik_haptics_enabled",

    ambient: "rik_ambient_motion",

    buttonSize: "rik_button_size"

};


const DEFAULT_PORT = 81;


/* ============================================================
   DOM HELPERS
   ============================================================ */

function $(selector, parent = document) {

    return parent.querySelector(selector);

}


function $$(selector, parent = document) {

    return Array.from(
        parent.querySelectorAll(selector)
    );

}


/* ============================================================
   SAFE LOCAL STORAGE
   ============================================================ */

function storageGet(key, fallback = null) {

    try {

        const value =
            localStorage.getItem(key);

        return value === null
            ? fallback
            : value;

    } catch (_) {

        return fallback;

    }

}


function storageSet(key, value) {

    try {

        localStorage.setItem(
            key,
            String(value)
        );

    } catch (_) {}

}


/* ============================================================
   LOAD SETTINGS
   ============================================================ */

function loadRIKSettings() {

    const haptics =
        storageGet(
            STORAGE.haptics,
            "true"
        );

    const ambient =
        storageGet(
            STORAGE.ambient,
            "true"
        );

    const buttonSize =
        Number(
            storageGet(
                STORAGE.buttonSize,
                "100"
            )
        );


    RIK.hapticsEnabled =
        haptics !== "false";


    RIK.ambientMotion =
        ambient !== "false";


    RIK.buttonScale =
        Number.isFinite(buttonSize)
            ? Math.max(
                0.8,
                Math.min(
                    1.3,
                    buttonSize / 100
                )
            )
            : 1;

}


/* ============================================================
   ESP32 SETTINGS
   ============================================================ */

function getESP32Settings() {

    return {

        ip:
            storageGet(
                STORAGE.ip,
                ""
            ),

        port:
            storageGet(
                STORAGE.port,
                String(DEFAULT_PORT)
            )

    };

}


function saveESP32Settings(
    ip,
    port
) {

    ip =
        String(
            ip || ""
        ).trim();


    port =
        String(
            port || DEFAULT_PORT
        ).trim();


    if (!ip) {

        return false;

    }


    const numericPort =
        Number(port);


    if (
        !Number.isInteger(
            numericPort
        ) ||
        numericPort < 1 ||
        numericPort > 65535
    ) {

        return false;

    }


    storageSet(
        STORAGE.ip,
        ip
    );


    storageSet(
        STORAGE.port,
        numericPort
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


/* ============================================================
   HAPTIC FEEDBACK
   ============================================================ */

function canVibrate() {

    return (
        "vibrate" in navigator
    );

}


function hapticPulse(
    pattern = 18
) {

    if (
        !RIK.hapticsEnabled
    ) {

        return;

    }


    if (
        !canVibrate()
    ) {

        return;

    }


    try {

        navigator.vibrate(
            pattern
        );

    } catch (_) {}

}


function startHaptics() {

    if (
        !RIK.hapticsEnabled
    ) {

        return;

    }


    hapticPulse(16);


    stopHaptics();


    /*
     * Small repeating pulse while
     * a movement button is held.
     *
     * This is intentionally slow so
     * it does not waste battery or
     * overwhelm the device.
     */

    RIK.hapticTimer =
        setInterval(
            () => {

                if (
                    RIK.hapticsEnabled &&
                    RIK.driveCommand
                ) {

                    hapticPulse(10);

                }

            },
            140
        );

}


function stopHaptics() {

    if (
        RIK.hapticTimer
    ) {

        clearInterval(
            RIK.hapticTimer
        );


        RIK.hapticTimer =
            null;

    }


    if (
        canVibrate()
    ) {

        try {

            navigator.vibrate(0);

        } catch (_) {}

    }

}


/* ============================================================
   CONNECTION UI
   ============================================================ */

function updateConnectionUI() {

    const connected =
        RIK.connected;


    const elements = [

        $("#connectionText"),

        $("#connectionStatus"),

        $("#robotStatus")

    ];


    elements.forEach(
        element => {

            if (!element) {

                return;

            }


            element.textContent =
                connected
                    ? "CONNECTED"
                    : "OFFLINE";


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
     * Never allow movement to continue
     * after a connection loss.
     */

    if (!connected) {

        stopDrive(false);

    }


    updateESP32SettingsUI();

}


/* ============================================================
   ESP32 WEBSOCKET
   ============================================================ */

function connectESP32() {

    const url =
        getESP32URL();


    if (!url) {

        updateConnectionUI();

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


    let socket;


    try {

        socket =
            new WebSocket(
                url
            );

    } catch (error) {

        console.error(
            "RIK WebSocket error:",
            error
        );


        scheduleReconnect();

        return;

    }


    RIK.socket =
        socket;


    socket.addEventListener(
        "open",
        () => {

            if (
                RIK.socket !== socket
            ) {

                return;

            }


            RIK.connected =
                true;


            RIK.reconnectDelay =
                1500;


            updateConnectionUI();

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

            stopHaptics();

            stopDrive(false);

            updateConnectionUI();


            scheduleReconnect();

        }
    );


    socket.addEventListener(
        "error",
        error => {

            console.warn(
                "RIK ESP32 error:",
                error
            );


            RIK.connected =
                false;


            updateConnectionUI();

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

    stopHaptics();


    if (
        RIK.socket
    ) {

        try {

            RIK.socket.close();

        } catch (_) {}

    }


    RIK.socket =
        null;


    RIK.connected =
        false;


    stopDrive(false);

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
                        RIK.reconnectDelay *
                            1.8,
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
                    RIK.connected
                ) {

                    sendPacket({

                        type:
                            "heartbeat",

                        timestamp:
                            Date.now()

                    });

                }

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


/* ============================================================
   SEND PACKET
   ============================================================ */

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

        console.warn(
            "RIK send error:",
            error
        );


        return false;

    }

}


/* ============================================================
   COMMAND PROTOCOL
   ============================================================ */

function sendCommand(
    command
) {

    if (
        !RIK.connected
    ) {

        return false;

    }


    RIK.commandId++;


    return sendPacket({

        type:
            "command",

        id:
            RIK.commandId,

        command,

        speed:
            RIK.speed,

        timestamp:
            Date.now()

    });

}


/* ============================================================
   ESP32 MESSAGE HANDLER
   ============================================================ */

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
            "RIK: invalid ESP32 data",
            raw
        );

        return;

    }


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
            "RIK ACK:",
            data
        );

    }

}


/* ============================================================
   TELEMETRY
   ============================================================ */

function updateTelemetry(
    data
) {

    const soil =
        data.soil ??
        data.soilMoisture;


    const air =
        data.air ??
        data.aqi ??
        data.mq135;


    const rssi =
        data.rssi;


    if (
        soil !== undefined
    ) {

        [

            $("#soilValue"),

            $("#islandSoilValue")

        ].forEach(
            element => {

                if (element) {

                    element.textContent =
                        `${soil}%`;

                }

            }
        );

    }


    if (
        air !== undefined
    ) {

        [

            $("#airValue"),

            $("#islandAirValue")

        ].forEach(
            element => {

                if (element) {

                    element.textContent =
                        air;

                }

            }
        );

    }


    if (
        rssi !== undefined
    ) {

        const signal =
            $("#signalValue");


        if (signal) {

            signal.textContent =
                `${rssi} dBm`;

        }

    }

}


/* ============================================================
   MOVEMENT
   ============================================================ */

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


    startHaptics();

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


    stopHaptics();


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

    const stateElement =
        $("#driveState");


    if (stateElement) {

        stateElement.textContent =
            command ||
            "STOPPED";

    }


    $$(".control-button")
        .forEach(
            button => {

                button.classList.toggle(
                    "command-active",
                    Boolean(
                        command &&
                        button.dataset.command ===
                            command
                    )
                );

            }
        );

}


/* ============================================================
   MOVEMENT BUTTONS
   ============================================================ */

function setupMovementButtons() {

    const buttons =
        $$(".control-button");


    buttons.forEach(
        button => {

            const command =
                button.dataset.command;


            if (!command) {

                return;

            }


            let held =
                false;


            const press =
                event => {

                    event.preventDefault();


                    if (
                        held
                    ) {

                        return;

                    }


                    held =
                        true;


                    try {

                        button.setPointerCapture(
                            event.pointerId
                        );

                    } catch (_) {}


                    button.classList.add(
                        "pressed"
                    );


                    startDrive(
                        command
                    );

                };


            const release =
                event => {

                    if (
                        event
                    ) {

                        event.preventDefault();

                    }


                    if (
                        !held
                    ) {

                        return;

                    }


                    held =
                        false;


                    button.classList.remove(
                        "pressed"
                    );


                    stopDrive();

                };


            button.addEventListener(
                "pointerdown",
                press
            );


            button.addEventListener(
                "pointerup",
                release
            );


            button.addEventListener(
                "pointercancel",
                release
            );


            button.addEventListener(
                "lostpointercapture",
                () => {

                    if (
                        held
                    ) {

                        release();

                    }

                }
            );

        }
    );

}


/* ============================================================
   ARM + CLAW
   ============================================================ */

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


                        /*
                         * Short haptic confirmation
                         * for ARM / CLAW.
                         */

                        hapticPulse(
                            [12, 30, 12]
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

    switch (command) {

        case "ARM_UP":

            RIK.armState =
                "ARM UP";

            break;


        case "ARM_DOWN":

            RIK.armState =
                "ARM DOWN";

            break;


        case "CLAW_OPEN":

        case "OPEN":

            RIK.clawState =
                "OPEN";

            break;


        case "CLAW_CLOSE":

        case "CLOSE":

            RIK.clawState =
                "CLOSED";

            break;

    }


    const arm =
        $("#armPosition");


    const claw =
        $("#clawPosition");


    if (arm) {

        arm.textContent =
            RIK.armState;

    }


    if (claw) {

        claw.textContent =
            RIK.clawState;

    }

}


/* ============================================================
   SPEED
   ============================================================ */

function setupSpeed() {

    const slider =
        $("#speedSlider");


    const value =
        $("#speedValue");


    if (!slider) {

        return;

    }


    function render() {

        RIK.speed =
            Number(
                slider.value
            ) || 0;


        if (value) {

            value.textContent =
                `${RIK.speed}%`;

        }

    }


    slider.addEventListener(
        "input",
        render
    );


    render();

}


/* ============================================================
   KEYBOARD
   ============================================================ */

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


            if (
                event.repeat
            ) {

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


    window.addEventListener(
        "blur",
        () => {

            stopDrive();

        }
    );

}


/* ============================================================
   PEARL BUTTON VISUAL SYSTEM
   ============================================================ */

function installPearlStyles() {

    if (
        $("#rikPearlRuntimeStyle")
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "rikPearlRuntimeStyle";


    style.textContent = `

        .control-button,
        .action-button {

            position: relative;

            overflow: hidden;

            isolation: isolate;

            cursor: pointer;

            -webkit-tap-highlight-color:
                transparent;

            touch-action:
                none;

            transition:
                transform .18s ease,
                filter .18s ease,
                box-shadow .18s ease;

        }


        .control-button::before,
        .action-button::before {

            content: "";

            position: absolute;

            left: 6%;

            right: 6%;

            top: 7%;

            height: 43%;

            border-radius:
                999px 999px 35% 35%;

            background:
                linear-gradient(
                    180deg,
                    rgba(255,255,255,.42),
                    rgba(255,255,255,.10),
                    transparent
                );

            pointer-events: none;

            z-index: -1;

            transition:
                transform .28s ease,
                opacity .28s ease;

        }


        .control-button::after,
        .action-button::after {

            content: "";

            position: absolute;

            left: -15%;

            width: 130%;

            height: 100%;

            bottom: -68%;

            border-radius: 50%;

            background:
                rgba(255,255,255,.10);

            pointer-events: none;

            z-index: -1;

            transition:
                transform .30s ease;

        }


        .control-button:hover,
        .action-button:hover {

            transform:
                translateY(-2px);

            filter:
                brightness(1.08);

        }


        .control-button:hover::before,
        .action-button:hover::before {

            transform:
                translateY(-7%);

        }


        .control-button:hover::after,
        .action-button:hover::after {

            transform:
                translateY(-7%);

        }


        .control-button:active,
        .action-button:active,
        .control-button.pressed,
        .action-button.pressed,
        .control-button.command-active {

            transform:
                translateY(3px)
                scale(.985);

            filter:
                brightness(1.18);

        }


        .control-button.pressed::before,
        .action-button.pressed::before {

            opacity:
                .72;

        }

    `;


    document.head.appendChild(
        style
    );

}


/* ============================================================
   ANIMATED BENDING LINES
   ============================================================ */

function installFlowBackground() {

    if (
        $("#rikFlowBackground")
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "rikFlowBackgroundStyle";


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
        .rik-flow {

            fill:
                none;

            stroke:
                rgba(190,198,212,.30);

            stroke-width:
                .8;

            vector-effect:
                non-scaling-stroke;

            stroke-linecap:
                round;

            stroke-dasharray:
                850 1450;

            animation:
                rikLineFlow
                25s
                linear
                infinite;

            will-change:
                stroke-dashoffset;

        }


        #rikFlowBackground
        .rik-flow.bright {

            stroke:
                rgba(225,230,240,.46);

            stroke-width:
                1;

        }


        #rikFlowBackground
        .rik-flow:nth-child(2n) {

            animation-duration:
                29s;

        }


        #rikFlowBackground
        .rik-flow:nth-child(3n) {

            animation-duration:
                34s;

        }


        #rikFlowBackground
        .rik-flow:nth-child(4n) {

            animation-duration:
                38s;

        }


        @keyframes rikLineFlow {

            from {

                stroke-dashoffset:
                    0;

            }

            to {

                stroke-dashoffset:
                    -2300px;

            }

        }


        body.rik-tab-hidden
        #rikFlowBackground
        .rik-flow {

            animation-play-state:
                paused;

        }


        body.rik-no-ambient-motion
        #rikFlowBackground
        .rik-flow {

            animation:
                none;

            stroke-dasharray:
                none;

        }


        #rikFlowBackground + * {

            position:
                relative;

            z-index:
                1;

        }


        main,
        header,
        #app,
        #root,
        #settingsPage,
        .app,
        .dashboard,
        .controller {

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


    /*
     * These bend toward the lower/right
     * controller area rather than moving
     * in a straight horizontal direction.
     */

    const paths = [

        "M -300 80 C 80 40 260 70 430 180 S 780 410 1450 360",

        "M -300 120 C 60 75 250 105 440 210 S 800 440 1450 395",

        "M -300 165 C 40 115 230 140 450 245 S 810 470 1450 430",

        "M -300 215 C 30 155 210 180 460 280 S 820 505 1450 470",

        "M -300 270 C 60 205 220 230 480 320 S 840 545 1450 515",

        "M -300 330 C 80 255 230 285 495 365 S 865 585 1450 560",

        "M -300 395 C 90 310 240 345 510 415 S 890 625 1450 610",

        "M -300 465 C 100 370 250 405 525 465 S 920 670 1450 660",

        "M -300 540 C 110 435 260 465 540 515 S 950 710 1450 715",

        "M -300 620 C 120 505 270 530 555 565 S 980 750 1450 775",

        "M -300 705 C 130 580 280 600 570 620 S 1010 795 1450 840",

        "M -300 790 C 140 655 290 675 585 680 S 1040 840 1450 905"

    ];


    paths.forEach(
        (pathData, index) => {

            const path =
                document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "path"
                );


            path.setAttribute(
                "d",
                pathData
            );


            path.classList.add(
                "rik-flow"
            );


            if (
                index === 0 ||
                index === 5 ||
                index === 10
            ) {

                path.classList.add(
                    "bright"
                );

            }


            path.style.animationDelay =
                `${-index * 1.7}s`;


            svg.appendChild(
                path
            );

        }
    );


    background.appendChild(
        svg
    );


    document.body.prepend(
        background
    );


    applyAmbientMotion();

}


/* ============================================================
   AMBIENT MOTION
   ============================================================ */

function applyAmbientMotion() {

    document.body.classList.toggle(
        "rik-no-ambient-motion",
        !RIK.ambientMotion
    );

}


/* ============================================================
   SELF-ADJUSTING SCREEN SYSTEM
   ============================================================ */

/*
 * This is intentionally separate from the visual styling.
 *
 * The system measures the available viewport and dynamically
 * scales the movement controls so they don't get clipped.
 */

function autoFitControls() {

    const movementPanel =
        $(
            ".movement-panel, .movement-controls, .drive-panel, #movementPanel"
        );


    const grid =
        $(
            ".movement-grid, .direction-pad, .movement-pad"
        );


    if (
        !movementPanel &&
        !grid
    ) {

        return;

    }


    const target =
        grid ||
        movementPanel;


    if (!target) {

        return;

    }


    const rect =
        target.getBoundingClientRect();


    const viewportWidth =
        window.visualViewport
            ? window.visualViewport.width
            : window.innerWidth;


    const viewportHeight =
        window.visualViewport
            ? window.visualViewport.height
            : window.innerHeight;


    /*
     * Determine available screen space.
     */

    const availableWidth =
        Math.max(
            240,
            viewportWidth - 32
        );


    const availableHeight =
        Math.max(
            240,
            viewportHeight - 180
        );


    /*
     * Base scale from the available
     * viewport.
     */

    let scale =
        Math.min(
            availableWidth / 520,
            availableHeight / 440
        );


    /*
     * Respect user's Button Size setting.
     */

    scale *=
        RIK.buttonScale;


    /*
     * Keep everything in a useful range.
     */

    scale =
        Math.max(
            0.72,
            Math.min(
                1.28,
                scale
            )
        );


    document.documentElement
        .style
        .setProperty(
            "--rik-auto-scale",
            scale.toFixed(3)
        );


    /*
     * Apply scale to the movement
     * control system only.
     *
     * The rest of the UI isn't randomly
     * resized.
     */

    document.documentElement
        .style
        .setProperty(
            "--rik-control-scale",
            scale.toFixed(3)
        );


    /*
     * Update CSS custom dimensions.
     */

    const root =
        document.documentElement;


    root.style.setProperty(
        "--rik-button-scale",
        scale
    );


    /*
     * Tell CSS about orientation.
     */

    const portrait =
        viewportHeight >
        viewportWidth;


    document.body.classList.toggle(
        "rik-portrait",
        portrait
    );


    document.body.classList.toggle(
        "rik-landscape",
        !portrait
    );

}


/* ============================================================
   BUTTON SIZE SETTING
   ============================================================ */

function setupButtonSize() {

    const slider =
        $("#buttonSizeSlider");


    const value =
        $("#buttonSizeValue");


    if (!slider) {

        return;

    }


    slider.value =
        String(
            Math.round(
                RIK.buttonScale *
                100
            )
        );


    function update() {

        const percentage =
            Number(
                slider.value
            ) || 100;


        RIK.buttonScale =
            Math.max(
                .8,
                Math.min(
                    1.3,
                    percentage / 100
                )
            );


        storageSet(
            STORAGE.buttonSize,
            percentage
        );


        if (value) {

            value.textContent =
                `${percentage}%`;

        }


        autoFitControls();

    }


    slider.addEventListener(
        "input",
        update
    );


    update();

}


/* ============================================================
   HAPTIC TOGGLE
   ============================================================ */

function setupHapticToggle() {

    const toggle =
        $("#hapticToggle");


    if (!toggle) {

        return;

    }


    toggle.checked =
        RIK.hapticsEnabled;


    toggle.addEventListener(
        "change",
        () => {

            RIK.hapticsEnabled =
                toggle.checked;


            storageSet(
                STORAGE.haptics,
                RIK.hapticsEnabled
            );


            if (
                !RIK.hapticsEnabled
            ) {

                stopHaptics();

            } else {

                hapticPulse(
                    18
                );

            }

        }
    );

}


/* ============================================================
   AMBIENT MOTION TOGGLE
   ============================================================ */

function setupAmbientToggle() {

    const toggle =
        $("#ambientMotionToggle");


    if (!toggle) {

        return;

    }


    toggle.checked =
        RIK.ambientMotion;


    toggle.addEventListener(
        "change",
        () => {

            RIK.ambientMotion =
                toggle.checked;


            storageSet(
                STORAGE.ambient,
                RIK.ambientMotion
            );


            applyAmbientMotion();

        }
    );

}


/* ============================================================
   ESP32 SETTINGS CARD
   ============================================================ */

function createESP32Settings() {

    const settingsPage =
        $("#settingsPage");


    if (
        !settingsPage
    ) {

        return;

    }


    if (
        $("#esp32ConnectionCard")
    ) {

        loadESP32SettingsUI();

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "rik-esp32-settings-style";


    style.textContent = `

        #esp32ConnectionCard {

            width: 100%;

            margin-bottom: 26px;

            padding: 24px;

            box-sizing: border-box;

            border-radius: 20px;

            border:
                1px solid
                rgba(255,255,255,.14);

            background:
                rgba(18,18,20,.74);

            backdrop-filter:
                blur(22px);

            -webkit-backdrop-filter:
                blur(22px);

            color: white;

        }


        .rik-esp32-heading {

            display: flex;

            align-items: center;

            justify-content:
                space-between;

            gap: 15px;

        }


        .rik-esp32-heading h3 {

            margin: 0;

            font-size: 14px;

            letter-spacing:
                .1em;

        }


        #rikEsp32Status {

            font-size: 9px;

            font-weight: 800;

            letter-spacing:
                .08em;

        }


        .rik-esp32-description {

            margin:
                8px 0 20px;

            font-size: 11px;

            color:
                rgba(255,255,255,.45);

        }


        .rik-esp32-fields {

            display: grid;

            grid-template-columns:
                minmax(0,1fr)
                130px;

            gap: 12px;

        }


        .rik-esp32-field {

            display: flex;

            flex-direction: column;

            gap: 7px;

        }


        .rik-esp32-field label {

            font-size: 9px;

            font-weight: 800;

            color:
                rgba(255,255,255,.45);

            letter-spacing:
                .08em;

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
                rgba(255,255,255,.14);

            background:
                rgba(255,255,255,.055);

            color: white;

            outline: none;

        }


        .rik-esp32-field input:focus {

            border-color:
                rgba(30,235,120,.7);

        }


        .rik-esp32-buttons {

            display: flex;

            flex-wrap: wrap;

            gap: 9px;

            margin-top: 15px;

        }


        .rik-esp32-btn {

            min-height: 40px;

            padding:
                0 16px;

            border-radius: 10px;

            border:
                1px solid
                rgba(255,255,255,.14);

            background:
                rgba(255,255,255,.06);

            color: white;

            cursor: pointer;

            font-size: 9px;

            font-weight: 800;

            letter-spacing:
                .07em;

        }


        .rik-esp32-btn.primary {

            color:
                #001509;

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

            margin-top: 15px;

            padding-top: 14px;

            border-top:
                1px solid
                rgba(255,255,255,.08);

            font-size: 9px;

        }


        #rikEsp32StatusMessage {

            color:
                rgba(255,255,255,.45);

        }


        #rikEsp32Address {

            color:
                rgba(255,255,255,.3);

        }


        @media(max-width:650px) {

            .rik-esp32-fields {

                grid-template-columns:
                    1fr;

            }

        }

    `;


    document.head.appendChild(
        style
    );


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

            <span id="rikEsp32Status">
                NOT CONFIGURED
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
                    autocomplete="off"
                    placeholder="192.168.1.100"
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

            <span id="rikEsp32StatusMessage">
                Enter ESP32 IP address.
            </span>

            <span id="rikEsp32Address">
                —
            </span>

        </div>

    `;


    settingsPage.prepend(
        card
    );


    bindESP32Settings();

    loadESP32SettingsUI();

}


function loadESP32SettingsUI() {

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


    const save =
        $("#saveESP32Button");


    const test =
        $("#testESP32Button");


    const disconnect =
        $("#disconnectESP32Button");


    save?.addEventListener(
        "click",
        () => {

            const valid =
                saveESP32Settings(
                    ipInput?.value,
                    portInput?.value
                );


            if (!valid) {

                alert(
                    "Enter a valid ESP32 IP address and port."
                );


                return;

            }


            disconnectESP32();


            setTimeout(
                connectESP32,
                100
            );

        }
    );


    test?.addEventListener(
        "click",
        () => {

            save?.click();

        }
    );


    disconnect?.addEventListener(
        "click",
        () => {

            disconnectESP32();

        }
    );


    ipInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                save?.click();

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

                save?.click();

            }

        }
    );

}


/* ============================================================
   SETTINGS NAVIGATION
   ============================================================ */

function setupSettingsNavigation() {

    const settingsButton =
        $("#settingsButton");


    const settingsPage =
        $("#settingsPage");


    const controlPage =
        $("#controlPage") ||
        $("#app");


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


            requestAutoFit();

        }
    );


    /*
     * Create it now if the page exists.
     */

    createESP32Settings();

}


/* ============================================================
   TIMER
   ============================================================ */

function setupTimer() {

    const button =
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


        $$(".timer-value")
            .forEach(
                element => {

                    element.textContent =
                        formatted;

                }
            );

    }


    button?.addEventListener(
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
                Math.min(
                    59,
                    Math.max(
                        0,
                        Number(
                            seconds?.value
                        ) || 0
                    )
                );


            RIK.timerSeconds =
                mins * 60 +
                secs;


            if (
                !RIK.timerSeconds
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


                            stopDrive();

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


/* ============================================================
   RESPONSIVE / SELF-ADJUSTING ENGINE
   ============================================================ */

function requestAutoFit() {

    cancelAnimationFrame(
        RIK.resizeTimer
    );


    RIK.resizeTimer =
        requestAnimationFrame(
            () => {

                autoFitControls();

            }
        );

}


function setupAutoFit() {

    window.addEventListener(
        "resize",
        requestAutoFit,
        {
            passive: true
        }
    );


    window.addEventListener(
        "orientationchange",
        () => {

            setTimeout(
                requestAutoFit,
                100
            );

        },
        {
            passive: true
        }
    );


    if (
        window.visualViewport
    ) {

        window.visualViewport.addEventListener(
            "resize",
            requestAutoFit,
            {
                passive: true
            }
        );

    }


    /*
     * ResizeObserver is more reliable
     * when panels change because of
     * browser UI / responsive layout.
     */

    if (
        "ResizeObserver" in window
    ) {

        const observer =
            new ResizeObserver(
                () => {

                    requestAutoFit();

                }
            );


        const root =
            $(
                ".movement-panel, .movement-controls, .drive-panel, #movementPanel"
            );


        if (root) {

            observer.observe(
                root
            );

        }

    }


    requestAutoFit();

}


/* ============================================================
   PERFORMANCE
   ============================================================ */

function setupPerformance() {

    document.addEventListener(
        "visibilitychange",
        () => {

            RIK.pageHidden =
                document.hidden;


            document.body.classList.toggle(
                "rik-tab-hidden",
                document.hidden
            );


            if (
                document.hidden
            ) {

                stopDrive();

            }

        }
    );


    /*
     * Respect reduced-motion preference.
     */

    if (
        window.matchMedia
    ) {

        const reduced =
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            );


        const update =
            () => {

                if (
                    reduced.matches
                ) {

                    document.body.classList.add(
                        "rik-reduced-motion"
                    );

                } else {

                    document.body.classList.remove(
                        "rik-reduced-motion"
                    );

                }

            };


        reduced.addEventListener?.(
            "change",
            update
        );


        update();

    }


    /*
     * Reduced-motion CSS.
     */

    const style =
        document.createElement(
            "style"
        );


    style.id =
        "rikPerformanceStyle";


    style.textContent = `

        body.rik-reduced-motion
        #rikFlowBackground
        .rik-flow {

            animation:
                none !important;

        }


        body.rik-reduced-motion
        .control-button,
        body.rik-reduced-motion
        .action-button {

            transition:
                none !important;

        }

    `;


    document.head.appendChild(
        style
    );

}


/* ============================================================
   FINAL RUNTIME CSS
   ------------------------------------------------------------
   The self-adjusting engine uses CSS variables so the existing
   layout isn't destroyed.
   ============================================================ */

function installRuntimeLayoutCSS() {

    if (
        $("#rikRuntimeLayoutStyle")
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "rikRuntimeLayoutStyle";


    style.textContent = `

        :root {

            --rik-control-scale:
                1;

        }


        /*
         * Only scale the movement controls.
         * The rest of the application remains untouched.
         */

        .movement-grid .control-button,
        .movement-pad .control-button,
        .direction-pad .control-button {

            transform:
                scale(
                    var(--rik-control-scale)
                );

        }


        .movement-grid .control-button:hover,
        .movement-pad .control-button:hover,
        .direction-pad .control-button:hover {

            transform:
                scale(
                    var(--rik-control-scale)
                )
                translateY(-2px);

        }


        .movement-grid .control-button.pressed,
        .movement-pad .control-button.pressed,
        .direction-pad .control-button.pressed {

            transform:
                scale(
                    calc(
                        var(--rik-control-scale)
                        * .985
                    )
                )
                translateY(3px);

        }


        /*
         * Prevent horizontal overflow on small screens.
         */

        body {

            overflow-x:
                hidden;

        }


        @media(max-width:600px) {

            .rik-esp32-status-row {

                flex-direction:
                    column;

            }

        }

    `;


    document.head.appendChild(
        style
    );

}


/* ============================================================
   INITIALIZE
   ============================================================ */

function initRIK() {

    console.log(
        "RIK — ROBOT IN KONTROL"
    );


    loadRIKSettings();


    /*
     * Background first.
     */

    installFlowBackground();


    /*
     * Pearl visual layer.
     */

    installPearlStyles();


    /*
     * Responsive system.
     */

    installRuntimeLayoutCSS();


    setupAutoFit();


    /*
     * Main controls.
     */

    setupMovementButtons();

    setupArmClaw();

    setupSpeed();

    setupKeyboard();


    /*
     * Feedback/settings.
     */

    setupButtonSize();

    setupHapticToggle();

    setupAmbientToggle();


    /*
     * Timer.
     */

    setupTimer();


    /*
     * Settings.

     */

    setupSettingsNavigation();


    /*
     * Performance.

     */

    setupPerformance();


    /*
     * Initial state.
     */

    updateConnectionUI();


    /*
     * Automatically connect if
     * an ESP32 IP was already saved.
     */

    const saved =
        getESP32Settings();


    if (
        saved.ip
    ) {

        connectESP32();

    }


    /*
     * Public debugging API.
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


    /*
     * First layout calculation.
     */

    requestAutoFit();


    console.log(
        "RIK: READY"
    );

}


/* ============================================================
   START APP
   ============================================================ */

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