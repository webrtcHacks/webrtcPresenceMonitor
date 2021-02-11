// global vars
let presences = [];
let totalStreams = 0;
let ledStatus;
let settings = JSON.parse(localStorage.getItem("settings"));

//ToDo: Need to handle when there are no settings
console.log("Settings:", settings);
if(settings.busy)
    ledStatus = settings.busy;
else{
    settings.busy = false;
    ledStatus = "off";

}

// prototype for our presence status object
function Presence(url, streamCount, tabId, tabStatus) {
    this.url = url;
    this.streamCount = streamCount;
    this.tabId = tabId;
    this.tabStatus = tabStatus;
    this.live = () => { return this.streamCount > 0};
}

function webhook(state){
    /*
    let xhr = new XMLHttpRequest();
    xhr.open("GET", alertUrl + state, true);
    xhr.send();
    */

    let url = state==="on" ? settings.onUrl : settings.offUrl;
    let method = state==="on" ? settings.onMethod : settings.offMethod;
    let postBody = state==="on" ? settings.onPostBody : settings.offPostBody;
    let headers = state==="on" ? settings.onHeaders : settings.offHeaders;


    if (url===""){
        console.log("No "+ state + " url set");
        return
    }

    let fetchParams = {};

    if (method === 'POST'){
        fetchParams = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (postBody !== ""){
            // fetchParams.body = postBody;
            // ToDo: debug
            // window.fetchParams = fetchParams;
            fetchParams.body = JSON.stringify(postBody);    // ToDo: not sure why I need the parse all of the sudden
        }
    }

    console.log(headers);

    if (headers !== "")
        fetchParams.headers = Object.assign(fetchParams.headers, JSON.parse(headers));


    //console.log(url, fetchParams);

    fetch(url, fetchParams)
    // In case we care about the response someday
        .then(
            response => {
                console.log("fetch details:", url, fetchParams, response);
                response.text().then(text => console.log("response text: " + text))
            })
        .catch(function (error) {
            console.log("fetch request failed details:", url, fetchParams, error);
        });
}

// Changes the icon and GETs the LED URL
function ledChange(state) {
    console.log("this is where I turn the LED " + state);
    webhook(state);

    chrome.tabs.query({active: true, windowType: "normal", currentWindow: true}, function (d) {
        let tabId = d[0].id;
        chrome.browserAction.setIcon({path: "icons/" + state + '.png'});    //Add tabId: tabId to make it tab specific
    });

    // ToDo: make HID work
    //HID
    if(settings.hid){
        glow([180,0,0]).catch(err=>console.error(err));
    }
}


function statusControl(port) {


    totalStreams = presences.reduce((total, p) => total + p.streamCount, 0);
    let liveTabs = presences.reduce((total, p) => total + p.live(), 0);

    console.log("total stream count is: " + totalStreams);
    console.log("active tab count is: " + liveTabs);


    // ToDo: need to manage manual status changes from on/off button

    /*
    * When to turn ON the light:
    * Manual - err on side of being on too often
    * TURN ON: if WebRTC active and LED is off
    * TURN OFF: if WebRTC not active, not manual busy, and the LED is off
    * */

    // Update the badge text
    chrome.browserAction.setBadgeText({text: liveTabs.toString()});

    // Turn the LED off
    if (totalStreams === 0 && ledStatus === 'on' && !settings.busy) {
        ledChange("off");
        ledStatus = "off";
    }
    // Turn the LED On
    else if (totalStreams > 0 && ledStatus === 'off') {
        ledChange("on");
        ledStatus = "on";

        // Maybe switch this to start one timer per tab with gUM
        // start the timer if there isn't already one running
        if  (typeof closedTabTimer === 'undefined'){
            closedTabTimer = setInterval(closedTabChecker, 2000, port);
            console.log("closedTabChecker " + closedTabTimer + " for " + port.sender.tab.id + " started ");
        }

    }
    /*
    // ToDo: remove this if the above works; For debugging
    else if (totalStreams === 0 && ledStatus === 'off') {
        console.log("No WebRTC streams")
    } else if (totalStreams > 0 && ledStatus === 'on') {
        console.log("LED already on");
    }
    // Something went wrong if we get here
    else {
        console.error("unhandled condition: ", totalStreams, ledStatus)
    }
    */

    // Update the pop-up text
    port.postMessage({
        type: 'update',
        data: {status: ledStatus, presences: presences},
    });

}

// ToDo: check this - it didn't catch a manual tab termination
//  This was eating too much CPU inside onConnect. Look into starting/stopping only when media is active
// Check periodically to see if any tabs have been closed, needed if onunload missed
let closedTabTimer = undefined; //This needs to be global?
function closedTabChecker(port) {

    // clear the timer if there are no active streams
    // ToDo: change this if I allow manual setting of ledStatus
    if (totalStreams === 0) {
        closedTabTimer = clearInterval(closedTabTimer);
        console.log("closedTabChecker for tab:" + port.sender.tab.id + " cleared");
        return;
    }

    let change = false; // to minimize calls statusControl

    presences.forEach((p) => {
        if (p.tabStatus === "open") {   //Only check open tabs

            // Check Chrome to see if the tab is still open
            chrome.tabs.get(p.tabId, () => {
                if (chrome.runtime.lastError) {
                    console.log("tab " + p.tabId + " is no longer open");
                    p.streamCount = 0;
                    p.tabStatus = "closed";
                    change = true;
                }
            });
        }
    });

    if (change)
        statusControl(port);
}

chrome.runtime.onConnect.addListener(function (port) {

    // Check for messages from inject.js
    port.onMessage.addListener(function (message) {

        if (message[0] === 'webrtcPresence') {
            console.log(Date.now() + ": " + JSON.stringify(message));

            // Make sure there is a url in the message, otherwise something is amiss
            if (!message[1]) {
                console.error("message[1] missing. ", message[1]);
                return;
            }

            let url = message[1];
            let tabId = port.sender.tab.id;

            // If the tab doesn't exist then add it to the arrays
            let newTab = presences.some(p => p.tabId === tabId);
            if (!newTab) {
                console.log("creating new presence entry");
                presences.push(new Presence(url, 0, tabId, "open"));
            }

            let i = presences.findIndex((p) => {
                if (p.tabId === tabId)
                    return p
            });

            // Handle each message
            switch (message[2]) {
                case "beforeunload":
                    presences[i].streamCount = 0;
                    presences[i].tabStatus = "closed";
                    break;
                case "off":
                    presences[i].streamCount > 0 ? presences[i].streamCount-- : 0;
                    break;
                case "on":
                    presences[i].streamCount++;
                    break;
                default:
                    console.info("unrecognized message[2]", message[2]);

            }

            console.log(presences);

            // Update the LED & badge
            statusControl(port);

        }

        // Look for message from the popup & respond with the latest data
        if (message.type === "request") {
            console.log("popup request", message);
            port.postMessage({
                type: 'update',
                data: {status: ledStatus, presences: presences},
            });
        }

        // Look for message from the popup & respond with the latest data
        if (message.type === "command") {
            console.log("popup command", message);
            if(message.command){
                    // ToDo: ***manage manual status
                    console.log("DEBUG:", message.command);
                    settings.busy = message.command === "on";
                    ledChange(message.command);
                    ledStatus = "on";

            }
        }


        // ToDo: I don't remember if this is required to load settings background.js or it is already shared from popup.js
        // Update settings data
        if (message.type === "settings") {
            console.log("popup settings", message);

            /*
            settings.onUrl = message.data.onUrl || "";
            settings.offUrl = message.data.offUrl || "";
            settings.method = message.data.method || "GET";
            settings.postBody = JSON.parse(message.data.postBody) || {};
            */
            if(message.data){
                settings = message.data;
                if (message.data.onPostBody)
                    settings.onPostBody = JSON.parse(message.data.onPostBody) || null;
                if (message.data.offPostBody)
                    settings.offPostBody = JSON.parse(message.data.offPostBody) || null;
            }

            console.log("webhook settings:", settings);

        }

    })
});

// ToDo: get setting here on load

// ToDo: investigate this - sometimes Chrome freezes on tab close, some replacement needed to check on active streams
// This seems to case problems
//chrome.tabs.onRemoved.addListener(function (tabid, removed) {
/*    let i = tabIds.indexOf(tabid);
    if (i === -1)
        return;

    streamCounts[i] = 0;*/

//    console.log("tab " + tabid + " closed.");
//});

chrome.runtime.onSuspend.addListener(function (message) {
    console.log("Extension port disconnected " + message);
});

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log('Reached Background.js');
        console.log('onMessage', request, sender, sendResponse)
    });
