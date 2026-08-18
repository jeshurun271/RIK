const WebSocket = require("ws");

const PORT = 81;

const wss = new WebSocket.Server({
    port: PORT
});

let state = {
    drive: "STOP",
    arm: "READY",
    claw: "OPEN",
    soil: 64,
    mq135: 312,
    rssi: -48,
    connected: true
};


console.log("=================================");
console.log("RIK ESP32 SIMULATOR");
console.log("=================================");
console.log(`WebSocket server: ws://localhost:${PORT}`);
console.log("Waiting for RIK app...\n");


wss.on("connection", (socket) => {

    console.log("RIK APP CONNECTED");


    state.connected = true;


    sendState(socket);


    socket.on("message", (message) => {

        const command =
            message.toString().trim();


        console.log(
            "RIK COMMAND:",
            command
        );


        handleCommand(
            command,
            socket
        );

    });


    socket.on("close", () => {

        console.log(
            "RIK APP DISCONNECTED"
        );

        state.connected = false;

    });


    socket.on("error", (error) => {

        console.error(
            "WebSocket error:",
            error.message
        );

    });

});


function handleCommand(command, socket) {

    switch (command) {

        case "FORWARD":
            state.drive = "FORWARD";
            break;


        case "BACKWARD":
            state.drive = "BACKWARD";
            break;


        case "LEFT":
            state.drive = "LEFT";
            break;


        case "RIGHT":
            state.drive = "RIGHT";
            break;


        case "STOP":
            state.drive = "STOP";
            state.arm = "READY";
            break;


        case "ARM_UP":
            state.arm = "RAISING";
            break;


        case "ARM_DOWN":
            state.arm = "LOWERING";
            break;


        case "CLAW_OPEN":
            state.claw = "OPEN";
            break;


        case "CLAW_CLOSE":
            state.claw = "CLOSED";
            break;


        default:

            console.log(
                "UNKNOWN COMMAND:",
                command
            );

            return;
    }


    sendState(socket);

}


function sendState(socket) {

    const packet = {

        type: "robot_state",

        drive:
            state.drive,

        arm:
            state.arm,

        claw:
            state.claw,

        soil:
            state.soil,

        mq135:
            state.mq135,

        rssi:
            state.rssi,

        connected:
            state.connected

    };


    socket.send(
        JSON.stringify(packet)
    );

}


/* =========================================================
   SIMULATED SENSOR CHANGES
========================================================= */

setInterval(() => {

    state.soil +=
        Math.floor(
            Math.random() * 3
        ) - 1;


    state.mq135 +=
        Math.floor(
            Math.random() * 11
        ) - 5;


    state.rssi =
        -45 -
        Math.floor(
            Math.random() * 12
        );


    state.soil =
        Math.max(
            0,
            Math.min(
                100,
                state.soil
            )
        );


    state.mq135 =
        Math.max(
            0,
            state.mq135
        );


    wss.clients.forEach(
        client => {

            if (
                client.readyState ===
                WebSocket.OPEN
            ) {

                sendState(client);

            }

        }
    );

}, 1000);