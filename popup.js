// inspiration: https://github.com/MartinMouritzen/segment-chromeextension/blob/master/popup.js

let settings = {};

$(document).ready( function () {


    let busyBtn =  $("#busyBtn");
    let notBusyBtn =  $("#notBusyBtn");

    let port = chrome.extension.connect({
        name: "WebRTC Presence popup"
    });

    port.onMessage.addListener((msg) => {
        console.log(msg);

        if (msg.type === "update") {

            if(msg.data.status) {
                if (msg.data.status === "on") {
                    console.log("turn busy button on");
                    busyBtn.removeClass("hidden");
                    notBusyBtn.addClass("hidden");
                } else if (msg.data.status === "off") {
                    //busyBtn.addClass("hidden");
                    busyBtn.addClass("hidden");
                    notBusyBtn.removeClass("hidden");
                }
            }

            if(msg.data.presences){
                let table = "<table><th>url</th><th>Streams</th>";
                msg.data.presences.forEach((item) => {
                    table += "<tr>" +
                        "<td>" + item.url + "</td>" +
                        "<td>" + item.streamCount + "</td>" +
                        "</tr>"
                });
                table += "</table>";
                document.getElementById("data").innerHTML = table;
            }
        }
    });


    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        port.postMessage({type: "request", id: tabs[0].id});
    });

    $("button.busy").on("click", (e)=>{
        busyBtn.toggleClass("hidden");
        notBusyBtn.toggleClass("hidden");

        if(e.target.innerText==="Busy"){
            console.log("on button clicked; turning off");
            port.postMessage({type: "command", command:"off"});
        }
        else if(e.target.innerText==="Not busy"){
            console.log("off button clicked; turning on");
            port.postMessage({type: "command", command:"on"});
        }
        else{
            console.log("on/off button handler error", e);
        }

    });

    // Function for sending the form data back to background.js
    function sendSettings(){

        $.each($(".settingsForm").serializeArray() , function(i, field){
            settings[field.name] = field.value;
        });
        settings.onMethod = $("#onGetSwitch")[0].checked ? "GET" : "POST";
        settings.offMethod = $("#offGetSwitch")[0].checked ? "GET" : "POST";

        console.log(settings);

        port.postMessage({type: "settings", data: settings});
    }

    let onForm = $("#onSettingsForm")[0];
    let offForm = $("#offSettingsForm")[0];


    // Get settings data from a localStorage and populate the forms
    let formData = JSON.parse(localStorage.getItem("settings"));
    console.log("saved settings:", formData);

    // Update the forms if we have saved settings
    if(formData){

        onForm["onUrl"].value = formData["onUrl"] || "";
        onForm["onHeaders"].value = formData["onHeaders"] || "";
        onForm["onPostBody"].value = formData["onPostBody"] || "";
        onForm["onGetSwitch"].checked = formData["onMethod"] === "GET";
        if(onForm["onGetSwitch"].checked)
            $(".onPostBody").hide();


        offForm["offUrl"].value = formData["offUrl"] || "";
        offForm["offHeaders"].value = formData["offHeaders"] || "";
        offForm["offGetSwitch"].checked = formData["offMethod"] === "GET";
        offForm["offPostBody"].value = formData["offPostBody"] || "";
        if(offForm["offGetSwitch"].checked)
            $(".offPostBody").hide();

    }

    $("#settingsToggle").click(() => {
        $("#settings").toggle()
    });

    $("#onGetSwitch").change(()=>{
        $(".onPostBody").toggle();
    });
    $("#offGetSwitch").change(()=>{
        $(".offPostBody").toggle();
    });

    $("#saveButton").click(()=>{
        sendSettings();
        localStorage.setItem("settings", JSON.stringify(settings));
    });

});
