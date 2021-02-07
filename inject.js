// Inspired by webrtcNotify & adapter.js by Philipp Hancke


const inject = '(' + function () {

        const STREAM_CHECK_INTERVAL = 1000; // time between checking for track status changes

        let streams = []; //ToDo: store streams here and check them to see if they are active?
        window.streams = streams;

        setInterval(() => {
            streams.forEach((stream, index) => {
                if (!stream.active) {
                    console.log("webrtcPresence: stream inactive: " + stream.id);
                    streams.splice(index, 1);
                    window.postMessage(['webrtcPresence', window.location.href, 'off', stream.id, 'inactive'], '*');
                } else if (stream.getTracks().length === 0) {
                    console.log("webrtcPresence: " + stream.id + " has no tracks");
                    streams.splice(index, 1);
                    window.postMessage(['webrtcPresence', window.location.href, 'no tracks', stream.id], '*');
                }
            })
        }, STREAM_CHECK_INTERVAL);

        // ToDo: also do navigator.getUserMedia for anyone that still uses that??
        if (navigator.mediaDevices.getUserMedia) {
            const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

            navigator.mediaDevices.getUserMedia = function (cs) {
                return origGetUserMedia(cs).then(stream => {
                    console.log("webrtcPresence: getUserMedia shimmed", stream.id);
                    window.postMessage(['webrtcPresence', window.location.href, 'on', 'gUM request', stream.id], '*');
                    streams.push(stream);
                    console.log("webrtcPresence:", stream);

                    //ToDo: these don't work
                    stream.onremovetrack = () => {
                        //if (! stream.active)
                        console.log("webrtcPresence: onremovetrack for " + stream.id);
                        window.postMessage(['webrtcPresence', window.location.href, 'track removed', stream.id], '*');
                    };

                    stream.onaddtrack = () => {
                        //if (! stream.active)
                        console.log("webrtcPresence: onaddtrack for " + stream.id);
                        window.postMessage(['webrtcPresence', window.location.href, 'track added', stream.id], '*');
                        //ToDo: do I need to the stream back to streams here?
                    };

                    // This didn't fire until hang up on meet.jit.si
                    /*
                    stream.oninactive = () =>{
                        console.log("webrtcPresence: stream inactive: " + stream.id);
                        window.postMessage(['webrtcPresence', window.location.href, 'off', stream.id, 'inactive'], '*');
                    };*/

                    //ToDo: are the onactive and oninactive events valid (outside of Chrome)??

                    return stream;
                }, e => Promise.reject(e))
            }
        }

        window.addEventListener('beforeunload', () => {
            console.log('webrtcPresence: Before unload handler');
            window.removeEventListener('message', {passive:true});

            if(streams.length > 0)
                window.postMessage(['webrtcPresence', window.location.href, 'beforeunload'], '*');



        }, {passive: true})
    } +
    ')();';

let channel = chrome.runtime.connect();


// ToDo: debugging: "Uncaught Error: Extension context invalidated."
// Reinsert inject.js on disconnect?
channel.onDisconnect.addListener(function() {
    // clean up when content script gets disconnected
    console.log("chrome runtime disconnected");
    window.removeEventListener('message', {passive:true});
});


window.addEventListener('message', function (event) {
    // if (typeof(event.data) === 'string') return;
    //if (channel == undefined || event.data[0] !== 'webrtcPresence') return;
    //else
    if(channel && event.data[0] === 'webrtcPresence')
        channel.postMessage(event.data);
});

let script = document.createElement('script');
script.textContent = inject;
(document.head || document.documentElement).appendChild(script);
script.parentNode.removeChild(script);
