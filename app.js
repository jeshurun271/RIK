// ==========================================
// RIK — ROBOT IN KONTROL
// ==========================================


// ==========================================
// ROBOT COMMAND SYSTEM
// ==========================================

let activeCommand = null;


// ==========================================
// ESP32 / SIMULATOR CONNECTION
// ==========================================

let esp32Socket = null;
let esp32Connected = false;
let esp32ReconnectTimer = null;


function connectESP32() {

    if (
        esp32Socket &&
        (
            esp32Socket.readyState === WebSocket.OPEN ||
            esp32Socket.readyState === WebSocket.CONNECTING
        )
    ) {

        return;

    }


    console.log(
        "RIK: Connecting to ESP32 simulator..."
    );


    try {

        esp32Socket =
            new WebSocket(
                "ws://localhost:81"
            );

    } catch (error) {

        console.error(
            "RIK: Could not create WebSocket:",
            error
        );

        scheduleESP32Reconnect();

        return;

    }


    esp32Socket.addEventListener(
        "open",
        () => {

            esp32Connected = true;

            console.log(
                "RIK: ESP32 simulator connected"
            );

        }
    );


    esp32Socket.addEventListener(
        "message",
        event => {

            console.log(
                "RIK ← ESP32:",
                event.data
            );


            try {

                const data =
                    JSON.parse(
                        event.data
                    );


                handleESP32Data(
                    data
                );

            } catch (error) {

                console.error(
                    "Invalid ESP32 data:",
                    error
                );

            }

        }
    );


    esp32Socket.addEventListener(
        "close",
        () => {

            esp32Connected = false;

            console.log(
                "RIK: ESP32 simulator disconnected"
            );

            scheduleESP32Reconnect();

        }
    );


    esp32Socket.addEventListener(
        "error",
        error => {

            esp32Connected = false;

            console.error(
                "RIK: ESP32 connection error:",
                error
            );

        }
    );

}


function scheduleESP32Reconnect() {

    if (
        esp32ReconnectTimer !== null
    ) {

        return;

    }


    esp32ReconnectTimer =
        setTimeout(
            () => {

                esp32ReconnectTimer =
                    null;

                connectESP32();

            },
            2000
        );

}


function handleESP32Data(
    data
) {

    console.log(
        "RIK ESP32 DATA:",
        data
    );


    const soilValue =
        document.getElementById(
            "soilValue"
        );


    if (
        soilValue &&
        typeof data.soil === "number"
    ) {

        soilValue.textContent =
            `${data.soil}%`;

    }


    const airValue =
        document.getElementById(
            "airValue"
        );


    if (
        airValue &&
        typeof data.mq135 === "number"
    ) {

        airValue.textContent =
            data.mq135;

    }


    const signalValue =
        document.getElementById(
            "signalValue"
        );


    if (
        signalValue &&
        typeof data.rssi === "number"
    ) {

        signalValue.textContent =
            `${data.rssi} dBm`;

    }

}


// ==========================================
// RIK HAPTICS
// ==========================================

let hapticInterval = null;


function startHaptics() {

    if (
        !("vibrate" in navigator)
    ) {

        return;

    }


    if (
        hapticInterval !== null
    ) {

        return;

    }


    navigator.vibrate(
        100
    );


    hapticInterval =
        setInterval(
            () => {

                navigator.vibrate(
                    100
                );

            },
            100
        );

}


function stopHaptics() {

    if (
        hapticInterval !== null
    ) {

        clearInterval(
            hapticInterval
        );

        hapticInterval =
            null;

    }


    if (
        "vibrate" in navigator
    ) {

        navigator.vibrate(
            0
        );

    }

}


// ==========================================
// SEND ROBOT COMMAND
// ==========================================

function sendCommand(
    command
) {

    console.log(
        "RIK COMMAND:",
        command
    );


    const robotStatus =
        document.getElementById(
            "robotStatus"
        );


    if (
        robotStatus
    ) {

        robotStatus.textContent =
            command;


        robotStatus.classList.remove(
            "ready"
        );

    }


    updateDriveState(
        command
    );


    updateArmState(
        command
    );


    // ==========================================
    // SEND COMMAND TO ESP32 / SIMULATOR
    // ==========================================

    if (
        esp32Socket &&
        esp32Socket.readyState ===
            WebSocket.OPEN
    ) {

        esp32Socket.send(
            command
        );


        console.log(
            "RIK → ESP32:",
            command
        );

    } else {

        console.warn(
            "RIK: ESP32 is not connected"
        );

    }

}


// ==========================================
// STOP ROBOT
// ==========================================

function stopRobot() {

    if (
        activeCommand !== null
    ) {

        console.log(
            "RIK COMMAND: STOP"
        );


        activeCommand =
            null;

    }


    const robotStatus =
        document.getElementById(
            "robotStatus"
        );


    if (
        robotStatus
    ) {

        robotStatus.textContent =
            "READY";


        robotStatus.classList.add(
            "ready"
        );

    }


    updateDriveState(
        "STOP"
    );


    updateArmState(
        "STOP"
    );


    // ==========================================
    // SEND STOP TO ESP32 / SIMULATOR
    // ==========================================

    if (
        esp32Socket &&
        esp32Socket.readyState ===
            WebSocket.OPEN
    ) {

        esp32Socket.send(
            "STOP"
        );


        console.log(
            "RIK → ESP32: STOP"
        );

    }


    stopHaptics();

}


// ==========================================
// DRIVE STATE
// ==========================================

function updateDriveState(command) {

    const driveDot =
        document.getElementById("driveDot");

    const driveState =
        document.getElementById("driveState");

    const movementCommands = [
        "FORWARD",
        "BACKWARD",
        "LEFT",
        "RIGHT"
    ];

    const driving =
        movementCommands.includes(command);

    if (driveState) {

        driveState.textContent =
            driving ? command : "STOPPED";

    }

    const driveStateBox =
        document.querySelector(".drive-state");

    if (driveStateBox) {

        driveStateBox.classList.toggle(
            "active",
            driving
        );

    }

    if (driveDot) {

        driveDot.style.background =
            driving ? "#35c759" : "#aaa";

    }

}


// ==========================================
// ARM STATE
// ==========================================

function updateArmState(command) {

    const armPosition =
        document.getElementById("armPosition");

    if (!armPosition) {
        return;
    }

    if (command === "ARM_UP") {

        armPosition.textContent = "RAISING";

    }

    else if (command === "ARM_DOWN") {

        armPosition.textContent = "LOWERING";

    }

    else if (command === "STOP") {

        armPosition.textContent = "READY";

    }

}


// ==========================================
// PRESS CONTROL BUTTON
// ==========================================

function pressButton(button) {

    const command =
        button.dataset.command;

    if (!command) {
        return;
    }

    activeCommand = command;

    button.classList.add("pressed");

    sendCommand(command);

    startHaptics();

}


// ==========================================
// RELEASE CONTROL BUTTON
// ==========================================

function releaseButton(button) {

    button.classList.remove("pressed");

    stopRobot();

}


// ==========================================
// CONTROL BUTTONS
// ==========================================

const buttons =
    document.querySelectorAll(
        ".control-button, .action-button"
    );


buttons.forEach(button => {

    // Mouse down
    button.addEventListener(
        "mousedown",
        event => {

            event.preventDefault();

            pressButton(button);

        }
    );


    // Mouse up
    button.addEventListener(
        "mouseup",
        event => {

            event.preventDefault();

            releaseButton(button);

        }
    );


    // Mouse leave
    button.addEventListener(
        "mouseleave",
        () => {

            if (activeCommand !== null) {

                releaseButton(button);

            }

        }
    );


    // Touch start
    button.addEventListener(
        "touchstart",
        event => {

            event.preventDefault();

            pressButton(button);

        },
        {
            passive: false
        }
    );


    // Touch end
    button.addEventListener(
        "touchend",
        event => {

            event.preventDefault();

            releaseButton(button);

        },
        {
            passive: false
        }
    );


    // Touch cancel
    button.addEventListener(
        "touchcancel",
        event => {

            event.preventDefault();

            releaseButton(button);

        },
        {
            passive: false
        }
    );

});


// ==========================================
// SAFETY
// ==========================================

window.addEventListener(
    "blur",
    () => {

        buttons.forEach(button => {

            button.classList.remove("pressed");

        });

        stopRobot();

    }
);


document.addEventListener(
    "visibilitychange",
    () => {

        if (document.hidden) {

            buttons.forEach(button => {

                button.classList.remove("pressed");

            });

            stopRobot();

        }

    }
);


// ==========================================
// SPEED CONTROL
// ==========================================

const speedSlider =
    document.getElementById("speedSlider");


const speedValue =
    document.getElementById("speedValue");


if (
    speedSlider &&
    speedValue
) {

    speedSlider.addEventListener(
        "input",
        () => {

            const speed =
                Number(speedSlider.value);

            speedValue.textContent =
                `${speed}%`;

            console.log(
                "RIK SPEED:",
                speed
            );

        }
    );

}


// ==========================================
// TIMER
// ==========================================

const timerButton =
    document.getElementById("timerButton");


const timerOverlay =
    document.getElementById("timerOverlay");


const closeTimer =
    document.getElementById("closeTimer");


const startTimer =
    document.getElementById("startTimer");


const resetTimer =
    document.getElementById("resetTimer");


const minutesInput =
    document.getElementById("timerMinutes");


const secondsInput =
    document.getElementById("timerSeconds");


const timerDisplay =
    document.getElementById("timerDisplay");


const timerBigDisplay =
    document.getElementById("timerBigDisplay");


let timerInterval = null;

let remainingSeconds = 0;


// ==========================================
// OPEN TIMER
// ==========================================

if (
    timerButton &&
    timerOverlay
) {

    timerButton.addEventListener(
        "click",
        () => {

            timerOverlay.classList.add("show");

            updateTimerDisplay();

        }
    );

}


// ==========================================
// CLOSE TIMER
// ==========================================

if (
    closeTimer &&
    timerOverlay
) {

    closeTimer.addEventListener(
        "click",
        () => {

            timerOverlay.classList.remove("show");

        }
    );

}


// ==========================================
// CLICK OUTSIDE TIMER
// ==========================================

if (timerOverlay) {

    timerOverlay.addEventListener(
        "click",
        event => {

            if (
                event.target === timerOverlay
            ) {

                timerOverlay.classList.remove(
                    "show"
                );

            }

        }
    );

}


// ==========================================
// FORMAT TIMER
// ==========================================

function formatTime(totalSeconds) {

    const minutes =
        Math.floor(
            totalSeconds / 60
        );

    const seconds =
        totalSeconds % 60;

    return (
        String(minutes).padStart(2, "0")
        +
        ":"
        +
        String(seconds).padStart(2, "0")
    );

}


// ==========================================
// UPDATE TIMER DISPLAY
// ==========================================

function updateTimerDisplay() {

    const formattedTime =
        formatTime(
            remainingSeconds
        );

    if (timerDisplay) {

        timerDisplay.textContent =
            formattedTime;

    }

    if (timerBigDisplay) {

        timerBigDisplay.textContent =
            formattedTime;

    }

}


// ==========================================
// START TIMER
// ==========================================

if (startTimer) {

    startTimer.addEventListener(
        "click",
        () => {

            if (
                !minutesInput ||
                !secondsInput
            ) {

                return;

            }

            let minutes =
                Number(
                    minutesInput.value
                ) || 0;

            let seconds =
                Number(
                    secondsInput.value
                ) || 0;


            minutes =
                Math.max(
                    0,
                    Math.min(
                        59,
                        minutes
                    )
                );


            seconds =
                Math.max(
                    0,
                    Math.min(
                        59,
                        seconds
                    )
                );


            remainingSeconds =
                (minutes * 60) + seconds;


            if (
                remainingSeconds <= 0
            ) {

                return;

            }


            clearInterval(
                timerInterval
            );


            timerInterval = null;


            updateTimerDisplay();


            if (timerOverlay) {

                timerOverlay.classList.remove(
                    "show"
                );

            }


            timerInterval =
                setInterval(
                    () => {

                        remainingSeconds--;

                        updateTimerDisplay();


                        if (
                            remainingSeconds <= 0
                        ) {

                            clearInterval(
                                timerInterval
                            );

                            timerInterval = null;

                            remainingSeconds = 0;

                            updateTimerDisplay();

                            timerFinished();

                        }

                    },
                    1000
                );

        }
    );

}


// ==========================================
// TIMER FINISHED
// ==========================================

function timerFinished() {

    console.log(
        "RIK TIMER: COMPLETE"
    );


    const robotStatus =
        document.getElementById(
            "robotStatus"
        );


    if (robotStatus) {

        robotStatus.textContent =
            "TIMER DONE";

    }


    if (
        "vibrate" in navigator
    ) {

        navigator.vibrate([
            200,
            100,
            200
        ]);

    }


    if (
        "Notification" in window &&
        Notification.permission === "granted"
    ) {

        new Notification(
            "RIK Timer",
            {
                body:
                    "The operation timer has finished."
            }
        );

    }

}


// ==========================================
// RESET TIMER
// ==========================================

if (resetTimer) {

    resetTimer.addEventListener(
        "click",
        () => {

            clearInterval(
                timerInterval
            );

            timerInterval = null;

            remainingSeconds = 0;

            updateTimerDisplay();


            if (minutesInput) {

                minutesInput.value = 0;

            }


            if (secondsInput) {

                secondsInput.value = 30;

            }

        }
    );

}


// ==========================================
// AUTO-HIDE NAVIGATION
// ==========================================

const rikNavigation =
    document.getElementById(
        "rikNavigation"
    );


const navRevealZone =
    document.getElementById(
        "navRevealZone"
    );


let navHideTimer = null;


const TOUCH_REVEAL_DISTANCE = 35;


// ==========================================
// SHOW NAVIGATION
// ==========================================

function showNavigation() {

    if (!rikNavigation) {
        return;
    }

    clearTimeout(navHideTimer);

    rikNavigation.classList.add(
        "nav-visible"
    );

    navHideTimer =
        setTimeout(
            () => {

                hideNavigation();

            },
            2200
        );

}


// ==========================================
// HIDE NAVIGATION
// ==========================================

function hideNavigation() {

    if (!rikNavigation) {
        return;
    }

    if (
        rikNavigation.matches(":hover")
    ) {

        return;

    }

    rikNavigation.classList.remove(
        "nav-visible"
    );

}


// ==========================================
// DELAYED NAV HIDE
// ==========================================

function scheduleNavHide() {

    clearTimeout(navHideTimer);

    navHideTimer =
        setTimeout(
            () => {

                hideNavigation();

            },
            900
        );

}


// ==========================================
// NAV REVEAL ZONE
// ==========================================

if (navRevealZone) {

    navRevealZone.addEventListener(
        "mouseenter",
        () => {

            showNavigation();

        }
    );

}


// ==========================================
// NAV MOUSE EVENTS
// ==========================================

if (rikNavigation) {

    rikNavigation.addEventListener(
        "mouseenter",
        () => {

            clearTimeout(navHideTimer);

            rikNavigation.classList.add(
                "nav-visible"
            );

        }
    );


    rikNavigation.addEventListener(
        "mouseleave",
        () => {

            scheduleNavHide();

        }
    );

}


// ==========================================
// MOUSE NAV REVEAL
// ONLY VERY CLOSE TO BOTTOM CENTRE
// ==========================================

document.addEventListener(
    "pointermove",
    event => {

        if (
            event.pointerType === "touch"
        ) {

            return;

        }


        const bottomDistance =
            window.innerHeight -
            event.clientY;


        const screenCenter =
            window.innerWidth / 2;


        const distanceFromCenter =
            Math.abs(
                event.clientX -
                screenCenter
            );


        const isBottom =
            bottomDistance <= 25;


        const isCenter =
            distanceFromCenter <= 100;


        if (
            isBottom &&
            isCenter
        ) {

            showNavigation();

        }

    },
    {
        passive: true
    }
);


// ==========================================
// TOUCH NAV REVEAL
// ONLY VERY CLOSE TO BOTTOM CENTRE
// ==========================================

document.addEventListener(
    "touchstart",
    event => {

        const touch =
            event.touches[0];


        if (!touch) {
            return;
        }


        const distanceFromBottom =
            window.innerHeight -
            touch.clientY;


        const screenCenter =
            window.innerWidth / 2;


        const distanceFromCenter =
            Math.abs(
                touch.clientX -
                screenCenter
            );


        const isBottom =
            distanceFromBottom <=
            TOUCH_REVEAL_DISTANCE;


        const isCenter =
            distanceFromCenter <= 110;


        if (
            isBottom &&
            isCenter
        ) {

            showNavigation();

        }

    },
    {
        passive: true
    }
);


// ==========================================
// PAGE ELEMENTS
// ==========================================

const controlPage =
    document.getElementById(
        "controlPage"
    );


const settingsPage =
    document.getElementById(
        "settingsPage"
    );


const demoPage =
    document.getElementById(
        "demoPage"
    );


const labPage =
    document.getElementById(
        "labPage"
    );


// ==========================================
// PAGE SWITCHING
// ==========================================

function showPage(page) {

    // Hide all pages
    if (controlPage) {

        controlPage.style.display =
            "none";

    }


    if (settingsPage) {

        settingsPage.style.display =
            "none";

    }


    if (demoPage) {

        demoPage.style.display =
            "none";

    }


    if (labPage) {

        labPage.style.display =
            "none";

    }


    // Show requested page
    if (
        page === "control" &&
        controlPage
    ) {

        controlPage.style.display =
            "block";

    }


    else if (
        page === "settings" &&
        settingsPage
    ) {

        settingsPage.style.display =
            "block";

    }


    else if (
        page === "demo" &&
        demoPage
    ) {

        demoPage.style.display =
            "block";

    }


    else if (
        page === "lab" &&
        labPage
    ) {

        labPage.style.display =
            "block";

    }


    console.log(
        "RIK PAGE:",
        page
    );

}


// ==========================================
// NAVIGATION BUTTONS
// ==========================================

if (rikNavigation) {

    const navItems =
        rikNavigation.querySelectorAll(
            ".nav-item"
        );


    navItems.forEach(
        item => {

            item.addEventListener(
                "click",
                () => {

                    navItems.forEach(
                        button => {

                            button.classList.remove(
                                "active"
                            );

                        }
                    );


                    item.classList.add(
                        "active"
                    );


                    const page =
                        item.dataset.page;


                    showPage(page);


                    showNavigation();

                }
            );

        }
    );

}


// ==========================================
// BUTTON SIZE SETTING
// ==========================================

const buttonSizeSlider =
    document.getElementById(
        "buttonSizeSlider"
    );


const buttonSizeValue =
    document.getElementById(
        "buttonSizeValue"
    );


function updateButtonSize() {

    if (!buttonSizeSlider) {

        return;

    }


    const size =
        Number(
            buttonSizeSlider.value
        );


    if (buttonSizeValue) {

        buttonSizeValue.textContent =
            `${size}%`;

    }


    document.documentElement.style
        .setProperty(
            "--rik-button-scale",
            size / 100
        );

}


if (buttonSizeSlider) {

    buttonSizeSlider.addEventListener(
        "input",
        updateButtonSize
    );


    updateButtonSize();

}


// ==========================================
// SENSOR DEMO
// ==========================================

function updateDemoSensors() {

    const soilValue =
        document.getElementById(
            "soilValue"
        );


    const soilProgress =
        document.getElementById(
            "soilProgress"
        );


    const soilStatus =
        document.getElementById(
            "soilStatus"
        );


    if (soilValue) {

        soilValue.textContent =
            "--%";

    }


    if (soilProgress) {

        soilProgress.style.width =
            "0%";

    }


    if (soilStatus) {

        soilStatus.textContent =
            "Waiting for sensor";

    }

}


// ==========================================
// INITIALIZE
// ==========================================

updateDemoSensors();

updateTimerDisplay();


// Start on Controller

showPage("control");


// Make Control active

if (rikNavigation) {

    const navItems =
        rikNavigation.querySelectorAll(
            ".nav-item"
        );


    navItems.forEach(
        item => {

            item.classList.toggle(
                "active",
                item.dataset.page === "control"
            );

        }
    );


    rikNavigation.classList.remove(
        "nav-visible"
    );

}


/* =========================================================
   RIK PWA SERVICE WORKER
   ========================================================= */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register("./sw.js")
                .then(
                    registration => {

                        console.log(
                            "RIK Service Worker registered:",
                            registration.scope
                        );

                    }
                )
                .catch(
                    error => {

                        console.error(
                            "RIK Service Worker registration failed:",
                            error
                        );

                    }
                );

        }
    );

}


/* =========================================================
   RIK PWA INSTALL
   ========================================================= */

let deferredInstallPrompt = null;


/* =========================================================
   INSTALL ELEMENTS
   ========================================================= */

const installCard =
    document.getElementById("installCard");

const installButton =
    document.getElementById("installAppButton");


/* =========================================================
   KEEP INSTALL CARD VISIBLE
   ========================================================= */

if (installCard) {

    installCard.style.display = "flex";

}


/* =========================================================
   BROWSER INSTALL PROMPT
   ========================================================= */

window.addEventListener(
    "beforeinstallprompt",
    event => {

        console.log(
            "RIK: Install prompt available."
        );


        event.preventDefault();


        deferredInstallPrompt = event;

    }
);


/* =========================================================
   INSTALL BUTTON
   ========================================================= */

if (installButton) {

    installButton.addEventListener(
        "click",
        async () => {


            /* -----------------------------------------
               NATIVE INSTALL PROMPT AVAILABLE
            ----------------------------------------- */

            if (deferredInstallPrompt) {

                try {

                    await deferredInstallPrompt.prompt();


                    const result =
                        await deferredInstallPrompt.userChoice;


                    console.log(
                        "RIK install result:",
                        result.outcome
                    );


                    deferredInstallPrompt = null;


                } catch (error) {

                    console.error(
                        "RIK install error:",
                        error
                    );

                }


                return;

            }



            /* -----------------------------------------
               CHECK IF ALREADY INSTALLED
            ----------------------------------------- */

            const isStandalone =
                window.matchMedia(
                    "(display-mode: standalone)"
                ).matches ||
                window.navigator.standalone === true;


            if (isStandalone) {

                alert(
                    "RIK is already installed on this device."
                );


                return;

            }



            /* -----------------------------------------
               iPHONE / iPAD
            ----------------------------------------- */

            const isIOS =
                /iphone|ipad|ipod/i.test(
                    navigator.userAgent
                );


            if (isIOS) {

                alert(
                    "To install RIK on iPhone or iPad:\n\n" +
                    "1. Open RIK in Safari.\n" +
                    "2. Tap the Share button.\n" +
                    "3. Select 'Add to Home Screen'.\n" +
                    "4. Tap 'Add'."
                );


                return;

            }



            /* -----------------------------------------
               ANDROID / DESKTOP FALLBACK
            ----------------------------------------- */

            alert(
                "RIK cannot open the automatic install prompt " +
                "in this browser right now.\n\n" +
                "Open your browser menu and look for:\n\n" +
                "• Install RIK\n" +
                "• Install app\n" +
                "• Add to Home screen"
            );

        }
    );

}


/* =========================================================
   APP INSTALLED
   ========================================================= */

window.addEventListener(
    "appinstalled",
    () => {

        console.log(
            "RIK has been installed successfully."
        );


        deferredInstallPrompt = null;

    }
);


// ==========================================
// START ESP32 CONNECTION
// ==========================================

connectESP32();// ==========================================
// RIK FORCE FULLSCREEN
// ==========================================

async function enterRIKFullscreen() {

    try {

        // Already fullscreen
        if (document.fullscreenElement) {
            return;
        }

        // Browser supports Fullscreen API
        if (document.documentElement.requestFullscreen) {

            await document.documentElement.requestFullscreen({
                navigationUI: "hide"
            });

            console.log(
                "RIK: Fullscreen enabled"
            );

        }

    } catch (error) {

        console.log(
            "RIK: Fullscreen request was blocked:",
            error
        );

    }

}


// ==========================================
// ENTER FULLSCREEN ON FIRST USER INTERACTION
// ==========================================

let rikFullscreenRequested = false;

function requestRIKFullscreen() {

    if (rikFullscreenRequested) {
        return;
    }

    rikFullscreenRequested = true;

    enterRIKFullscreen();

}


// Touch devices
document.addEventListener(
    "touchstart",
    requestRIKFullscreen,
    {
        once: true,
        passive: true
    }
);


// Mouse / desktop
document.addEventListener(
    "mousedown",
    requestRIKFullscreen,
    {
        once: true
    }
);


// Keyboard
document.addEventListener(
    "keydown",
    requestRIKFullscreen,
    {
        once: true
    }
);/* =========================================================
   RIK AUTO-FRAME ENGINE
   Dynamically sizes and centers the robot controls.
   ========================================================= */

(() => {
    "use strict";

    let frameAnimation = null;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function px(value) {
        return `${Math.round(value * 10) / 10}px`;
    }

    function getNumberVariable(name, fallback = 1) {
        const value = parseFloat(
            getComputedStyle(document.documentElement)
                .getPropertyValue(name)
        );

        return Number.isFinite(value) ? value : fallback;
    }

    function autoFitRIKControls() {
        if (frameAnimation) {
            cancelAnimationFrame(frameAnimation);
        }

        frameAnimation = requestAnimationFrame(() => {
            frameAnimation = null;

            const root = document.documentElement;

            const app = document.querySelector("#app");
            const movementPanel =
                document.querySelector(".movement-panel");

            const movementContent =
                document.querySelector(".movement-content");

            const movementPad =
                document.querySelector(".movement-pad");

            const speedControl =
                document.querySelector(".speed-control");

            const armPanel =
                document.querySelector(".arm-claw-panel");

            const armGrid =
                document.querySelector(".arm-claw-grid");

            if (
                !app ||
                !movementPanel ||
                !movementContent ||
                !movementPad
            ) {
                return;
            }

            /* ---------------------------------------------
               1. VIEWPORT
               --------------------------------------------- */

            const viewport =
                window.visualViewport;

            const viewportWidth =
                viewport?.width || window.innerWidth;

            const viewportHeight =
                viewport?.height || window.innerHeight;

            root.style.setProperty(
                "--rik-viewport-width",
                px(viewportWidth)
            );

            root.style.setProperty(
                "--rik-viewport-height",
                px(viewportHeight)
            );


            /* ---------------------------------------------
               2. MOVEMENT PANEL
               --------------------------------------------- */

            const panelRect =
                movementPanel.getBoundingClientRect();

            const contentRect =
                movementContent.getBoundingClientRect();

            if (
                panelRect.width <= 0 ||
                panelRect.height <= 0
            ) {
                return;
            }


            /* ---------------------------------------------
               3. AVAILABLE MOVEMENT SPACE
               --------------------------------------------- */

            const horizontalPadding =
                Math.max(8, contentRect.width * 0.025);

            const verticalPadding =
                Math.max(5, contentRect.height * 0.025);

            let availableWidth =
                contentRect.width -
                horizontalPadding * 2;

            let availableHeight =
                contentRect.height -
                verticalPadding * 2;


            /* Leave room for speed slider. */

            if (speedControl) {
                const speedRect =
                    speedControl.getBoundingClientRect();

                const speedHeight =
                    speedRect.height;

                availableHeight -=
                    speedHeight + 8;
            }


            /* ---------------------------------------------
               4. CALCULATE THE LARGEST SAFE SQUARE
               --------------------------------------------- */

            let movementSize =
                Math.min(
                    availableWidth,
                    availableHeight
                );


            /*
             * Never allow the pad to consume absolutely
             * everything. Keep a little breathing room.
             */

            movementSize *= 0.96;


            /*
             * Hard limits prevent absurd sizing on
             * tablets/desktops.
             */

            const maxMovementSize =
                viewportWidth < 600
                    ? viewportWidth * 0.78
                    : 460;

            movementSize =
                Math.min(
                    movementSize,
                    maxMovementSize
                );


            /*
             * Minimum prevents controls becoming tiny
             * during browser resize.
             */

            movementSize =
                Math.max(
                    movementSize,
                    170
                );


            /* ---------------------------------------------
               5. MOVEMENT PAD
               --------------------------------------------- */

            root.style.setProperty(
                "--rik-movement-size",
                px(movementSize)
            );

            movementPad.style.width =
                px(movementSize);

            movementPad.style.height =
                px(movementSize);

            movementPad.style.aspectRatio =
                "1 / 1";

            movementPad.style.margin =
                "auto";

            movementPad.style.alignSelf =
                "center";


            /* ---------------------------------------------
               6. MOVEMENT BUTTON SCALE
               --------------------------------------------- */

            const slider =
                document.querySelector(
                    "#buttonSizeSlider"
                );

            let sliderValue = 100;

            if (slider) {
                sliderValue =
                    parseFloat(slider.value) || 100;
            }

            const requestedScale =
                sliderValue / 100;


            /*
             * Calculate the actual grid cell.
             *
             * 3 columns + 2 gaps
             */

            const padStyles =
                getComputedStyle(movementPad);

            const gap =
                parseFloat(padStyles.columnGap) || 8;

            const cellSize =
                (
                    movementSize -
                    gap * 2
                ) / 3;


            /*
             * The slider can request 130%, but we NEVER
             * allow a button to escape its grid cell.
             */

            const maximumSafeScale =
                1;

            const actualScale =
                Math.min(
                    requestedScale,
                    maximumSafeScale
                );

            const buttonSize =
                cellSize * actualScale;


            root.style.setProperty(
                "--rik-cell-size",
                px(cellSize)
            );

            root.style.setProperty(
                "--rik-button-size",
                px(buttonSize)
            );

            root.style.setProperty(
                "--rik-button-scale",
                actualScale
            );


            /* ---------------------------------------------
               7. FORCE MOVEMENT BUTTON FIT
               --------------------------------------------- */

            const movementButtons =
                movementPad.querySelectorAll(
                    ".control-button"
                );

            movementButtons.forEach(button => {

                button.style.width =
                    px(buttonSize);

                button.style.height =
                    px(buttonSize);

                button.style.maxWidth =
                    px(cellSize);

                button.style.maxHeight =
                    px(cellSize);

                button.style.minWidth =
                    "0";

                button.style.minHeight =
                    "0";

                button.style.boxSizing =
                    "border-box";

                button.style.justifySelf =
                    "center";

                button.style.alignSelf =
                    "center";
            });


            /* ---------------------------------------------
               8. ARM + CLAW AUTO FIT
               --------------------------------------------- */

            if (armPanel && armGrid) {

                const armRect =
                    armPanel.getBoundingClientRect();

                const gridRect =
                    armGrid.getBoundingClientRect();

                if (
                    gridRect.width > 0 &&
                    gridRect.height > 0
                ) {

                    const armGap =
                        parseFloat(
                            getComputedStyle(armGrid)
                                .gap
                        ) || 8;

                    const armColumnWidth =
                        (
                            gridRect.width -
                            armGap
                        ) / 2;

                    const armRowHeight =
                        (
                            gridRect.height -
                            armGap
                        ) / 2;

                    /*
                     * Keep arm/claw controls within their
                     * available cells.
                     */

                    const actionSize =
                        Math.min(
                            armColumnWidth,
                            armRowHeight
                        );

                    root.style.setProperty(
                        "--rik-action-size",
                        px(actionSize)
                    );

                    armGrid
                        .querySelectorAll(
                            ".action-button"
                        )
                        .forEach(button => {

                            button.style.minWidth =
                                "0";

                            button.style.minHeight =
                                "0";

                            button.style.maxWidth =
                                "100%";

                            button.style.maxHeight =
                                "100%";

                            button.style.boxSizing =
                                "border-box";
                        });
                }
            }


            /* ---------------------------------------------
               9. CENTER EVERYTHING
               --------------------------------------------- */

            movementContent.style.alignItems =
                "center";

            movementContent.style.justifyContent =
                "center";


            /* ---------------------------------------------
               10. DEVICE CLASS
               --------------------------------------------- */

            const isLandscape =
                viewportWidth >
                viewportHeight;

            const isPhone =
                Math.min(
                    viewportWidth,
                    viewportHeight
                ) < 600;

            root.classList.toggle(
                "rik-landscape",
                isLandscape
            );

            root.classList.toggle(
                "rik-portrait",
                !isLandscape
            );

            root.classList.toggle(
                "rik-phone",
                isPhone
            );

            root.classList.toggle(
                "rik-tablet",
                !isPhone &&
                Math.min(
                    viewportWidth,
                    viewportHeight
                ) < 1000
            );
        });
    }


    /* =====================================================
       OBSERVE THE ACTUAL ELEMENTS
       This is the important part.
       ===================================================== */

    const resizeObserver =
        new ResizeObserver(() => {
            autoFitRIKControls();
        });


    function startAutoFitObserver() {

        const elements = [
            "#app",
            ".controls-area",
            ".movement-panel",
            ".movement-content",
            ".movement-pad",
            ".arm-claw-panel",
            ".arm-claw-grid"
        ];

        elements.forEach(selector => {

            const element =
                document.querySelector(selector);

            if (element) {
                resizeObserver.observe(element);
            }
        });

        autoFitRIKControls();
    }


    /* =====================================================
       SCREEN / BROWSER EVENTS
       ===================================================== */

    window.addEventListener(
        "resize",
        autoFitRIKControls,
        { passive: true }
    );

    window.addEventListener(
        "orientationchange",
        () => {
            setTimeout(
                autoFitRIKControls,
                100
            );

            setTimeout(
                autoFitRIKControls,
                500
            );
        },
        { passive: true }
    );


    if (window.visualViewport) {

        window.visualViewport.addEventListener(
            "resize",
            autoFitRIKControls,
            { passive: true }
        );

        window.visualViewport.addEventListener(
            "scroll",
            autoFitRIKControls,
            { passive: true }
        );
    }


    /* =====================================================
       START AFTER DOM IS READY
       ===================================================== */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            () => {
                startAutoFitObserver();

                setTimeout(
                    autoFitRIKControls,
                    250
                );

                setTimeout(
                    autoFitRIKControls,
                    1000
                );
            },
            { once: true }
        );

    } else {

        startAutoFitObserver();

        setTimeout(
            autoFitRIKControls,
            250
        );
    }


    /*
     * Expose it so the existing slider can force an
     * immediate recalculation if necessary.
     */

    window.autoFitRIKControls =
        autoFitRIKControls;

})();