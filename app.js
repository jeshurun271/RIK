// ==========================================
// RIK — ROBOT IN KONTROL
// ==========================================


// ==========================================
// ROBOT COMMAND SYSTEM
// ==========================================

let activeCommand = null;


function sendCommand(command) {

    console.log("RIK COMMAND:", command);

    const robotStatus =
        document.getElementById("robotStatus");

    if (robotStatus) {

        robotStatus.textContent =
            command;

        robotStatus.classList.remove(
            "ready"
        );

    }


    updateDriveState(command);

    updateArmState(command);

}


function stopRobot() {

    if (activeCommand !== null) {

        console.log(
            "RIK COMMAND: STOP"
        );

        activeCommand = null;

    }


    const robotStatus =
        document.getElementById("robotStatus");


    if (robotStatus) {

        robotStatus.textContent =
            "READY";

        robotStatus.classList.add(
            "ready"
        );

    }


    updateDriveState("STOP");

}


// ==========================================
// DRIVE STATE
// ==========================================

function updateDriveState(command) {

    const driveDot =
        document.getElementById(
            "driveDot"
        );

    const driveState =
        document.getElementById(
            "driveState"
        );


    const movementCommands = [

        "FORWARD",
        "BACKWARD",
        "LEFT",
        "RIGHT"

    ];


    const driving =
        movementCommands.includes(
            command
        );


    if (driveState) {

        driveState.textContent =
            driving
                ? command
                : "STOPPED";

    }


    const driveStateBox =
        document.querySelector(
            ".drive-state"
        );


    if (driveStateBox) {

        driveStateBox.classList.toggle(
            "active",
            driving
        );

    }


    if (driveDot) {

        driveDot.style.background =
            driving
                ? "#35c759"
                : "#aaa";

    }

}


// ==========================================
// ARM STATE
// ==========================================

function updateArmState(command) {

    const armPosition =
        document.getElementById(
            "armPosition"
        );


    if (!armPosition) return;


    if (command === "ARM_UP") {

        armPosition.textContent =
            "RAISING";

    }

    else if (
        command === "ARM_DOWN"
    ) {

        armPosition.textContent =
            "LOWERING";

    }

    else if (
        command === "STOP"
    ) {

        armPosition.textContent =
            "READY";

    }

}


// ==========================================
// PRESS BUTTON
// ==========================================

function pressButton(button) {

    const command =
        button.dataset.command;


    if (!command) return;


    activeCommand =
        command;


    button.classList.add(
        "pressed"
    );


    sendCommand(
        command
    );

}


// ==========================================
// RELEASE BUTTON
// ==========================================

function releaseButton(button) {

    button.classList.remove(
        "pressed"
    );


    stopRobot();

}


// ==========================================
// CONTROL BUTTONS
// ==========================================

const buttons =
    document.querySelectorAll(
        ".control-button, .action-button"
    );


buttons.forEach(
    button => {


        // ------------------------------
        // MOUSE DOWN
        // ------------------------------

        button.addEventListener(
            "mousedown",
            event => {

                event.preventDefault();

                pressButton(
                    button
                );

            }
        );


        // ------------------------------
        // MOUSE UP
        // ------------------------------

        button.addEventListener(
            "mouseup",
            event => {

                event.preventDefault();

                releaseButton(
                    button
                );

            }
        );


        // ------------------------------
        // MOUSE LEAVE
        // ------------------------------

        button.addEventListener(
            "mouseleave",
            () => {

                if (
                    activeCommand !== null
                ) {

                    releaseButton(
                        button
                    );

                }

            }
        );


        // ------------------------------
        // TOUCH START
        // ------------------------------

        button.addEventListener(
            "touchstart",
            event => {

                event.preventDefault();

                pressButton(
                    button
                );

            },
            {
                passive: false
            }
        );


        // ------------------------------
        // TOUCH END
        // ------------------------------

        button.addEventListener(
            "touchend",
            event => {

                event.preventDefault();

                releaseButton(
                    button
                );

            },
            {
                passive: false
            }
        );


        // ------------------------------
        // TOUCH CANCEL
        // ------------------------------

        button.addEventListener(
            "touchcancel",
            event => {

                event.preventDefault();

                releaseButton(
                    button
                );

            },
            {
                passive: false
            }
        );


    }
);


// ==========================================
// SAFETY
// ==========================================

window.addEventListener(
    "blur",
    () => {

        buttons.forEach(
            button => {

                button.classList.remove(
                    "pressed"
                );

            }
        );


        stopRobot();

    }
);


document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden
        ) {

            buttons.forEach(
                button => {

                    button.classList.remove(
                        "pressed"
                    );

                }
            );


            stopRobot();

        }

    }
);


// ==========================================
// SPEED CONTROL
// ==========================================

const speedSlider =
    document.getElementById(
        "speedSlider"
    );


const speedValue =
    document.getElementById(
        "speedValue"
    );


if (
    speedSlider &&
    speedValue
) {

    speedSlider.addEventListener(
        "input",
        () => {

            const speed =
                Number(
                    speedSlider.value
                );


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
    document.getElementById(
        "timerButton"
    );


const timerOverlay =
    document.getElementById(
        "timerOverlay"
    );


const closeTimer =
    document.getElementById(
        "closeTimer"
    );


const startTimer =
    document.getElementById(
        "startTimer"
    );


const resetTimer =
    document.getElementById(
        "resetTimer"
    );


const minutesInput =
    document.getElementById(
        "timerMinutes"
    );


const secondsInput =
    document.getElementById(
        "timerSeconds"
    );


const timerDisplay =
    document.getElementById(
        "timerDisplay"
    );


let timerInterval =
    null;


let remainingSeconds =
    0;


// ==========================================
// OPEN TIMER
// ==========================================

timerButton.addEventListener(
    "click",
    () => {

        timerOverlay.classList.add(
            "show"
        );

    }
);


// ==========================================
// CLOSE TIMER
// ==========================================

closeTimer.addEventListener(
    "click",
    () => {

        timerOverlay.classList.remove(
            "show"
        );

    }
);


// ==========================================
// CLICK OUTSIDE TIMER
// ==========================================

timerOverlay.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            timerOverlay
        ) {

            timerOverlay.classList.remove(
                "show"
            );

        }

    }
);


// ==========================================
// FORMAT TIMER
// ==========================================

function formatTime(
    totalSeconds
) {

    const minutes =
        Math.floor(
            totalSeconds / 60
        );


    const seconds =
        totalSeconds % 60;


    return (

        String(
            minutes
        ).padStart(
            2,
            "0"
        )

        +

        ":"

        +

        String(
            seconds
        ).padStart(
            2,
            "0"
        )

    );

}


// ==========================================
// UPDATE TIMER
// ==========================================

function updateTimerDisplay() {

    if (!timerDisplay) return;


    timerDisplay.textContent =
        formatTime(
            remainingSeconds
        );

}


// ==========================================
// START TIMER
// ==========================================

startTimer.addEventListener(
    "click",
    () => {


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
            (minutes * 60)
            +
            seconds;


        if (
            remainingSeconds <= 0
        ) {

            return;

        }


        clearInterval(
            timerInterval
        );


        updateTimerDisplay();


        timerOverlay.classList.remove(
            "show"
        );


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


                        remainingSeconds =
                            0;


                        timerDisplay.textContent =
                            "DONE";


                        timerFinished();

                    }

                },
                1000
            );

    }
);


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
        navigator.vibrate
    ) {

        navigator.vibrate(
            [
                200,
                100,
                200
            ]
        );

    }


    if (
        "Notification" in window &&
        Notification.permission ===
        "granted"
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

resetTimer.addEventListener(
    "click",
    () => {

        clearInterval(
            timerInterval
        );


        remainingSeconds =
            0;


        updateTimerDisplay();


        minutesInput.value =
            0;


        secondsInput.value =
            30;

    }
);


// ==========================================
// SENSOR DEMO
//
// Temporary only.
// Later ESP32 data will replace this.
// ==========================================

function updateDemoSensors() {

    /*
       These are NOT real sensor readings.
       They simply make the UI useful
       while we are developing it.
    */

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


// Run once.

updateDemoSensors();