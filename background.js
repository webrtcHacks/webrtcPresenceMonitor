// global vars
let presences = [];
let totalStreams = 0;
let ledStatus = "off";
let settings = JSON.parse(localStorage.getItem("settings"));

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

    // console.log(settings);
    let url = state==="on" ? settings.onUrl : settings.offUrl;
    if (url===""){
        console.log("No "+ state + " url set");
        return
    }

    let fetchParams = {
        method: settings.method || 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (fetchParams.method === "POST" && settings.postBody !== "")
        fetchParams.body = JSON.stringify(settings.postBody);

    fetch(url, fetchParams)
        // In case we care about the response someday
        .then(
            response =>
                console.log("webhook sent. Response code: " + response.status)
            )
        .catch(function (error) {
            console.log('Request failed', error);
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
}


function statusControl(port) {

    totalStreams = presences.reduce((total, p) => total + p.streamCount, 0);
    let liveTabs = presences.reduce((total, p) => total + p.live(), 0);

    console.log("total stream count is: " + totalStreams);
    console.log("active tab count is: " + liveTabs);

    // Update the badge text
    chrome.browserAction.setBadgeText({text: liveTabs.toString()});

    // Turn the LED off
    if (totalStreams === 0 && ledStatus === 'on') {
        ledChange("off");
        ledStatus = "off";
    }
    // Turn the LED On
    else if (totalStreams > 0 && ledStatus === 'off') {
        ledChange("on");
        ledStatus = "on";
    }
    // For debugging
    else if (totalStreams === 0 && ledStatus === 'off') {
        console.log("No WebRTC streams")
    } else if (totalStreams > 0 && ledStatus === 'on') {
        console.log("LED already on");
    }
    // Something went wrong if we get here
    else {
        console.error("unhandled condition: ", totalStreams, ledStatus)
    }

    // Update the pop-up text
    port.postMessage({
              type: 'update',
              data: presences
          });

}

chrome.runtime.onConnect.addListener(function (port) {

    // Check periodically to see if any tabs have been closed, needed if onunload missed
    setInterval(() => {

        if (presences.length === 0)
            return;

        presences.forEach((p) => {
            let change = false; // to minimize calls statusControl
            if (p.tabStatus === "open") {   //Only check open tabs

                // Check Chrome to see if the tab is still open
                chrome.tabs.get(p.tabId, () => {
                    if (chrome.runtime.lastError){
                        console.log("tab " + p.tabId + " is no longer open");
                        p.streamCount = 0;
                        p.tabStatus = "closed";
                        change = true;
                    }
                });
            }

            if (change)
                statusControl(port);
        });
    }, 1000);


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
                data: presences
            });
        }

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
                if (message.data.postBody)
                    settings.postBody = JSON.parse(message.data.postBody) || null;
            }

            console.log("webhook settings:", settings);

        }

    })
});

// ToDo: get setting here on load

// This never fires
chrome.tabs.onRemoved.addListener(function (tabid, removed) {
/*    let i = tabIds.indexOf(tabid);
    if (i === -1)
        return;

    streamCounts[i] = 0;*/

    console.log("tab " + tabid + " closed.");
});

chrome.runtime.onSuspend.addListener(function (message) {
    console.log("Extension port disconnected " + message);
});

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log('Reached Background.js');
        console.log('onMessage', request, sender, sendResponse)
    });
