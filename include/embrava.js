async function glow(rgb) {
    let device = await openDevice();
    await colorize(device, rgb );
}

async function handleDisconnectClick() {
    let device = await openDevice();
    if( !device ) return;
    let acolor = [ 0, 0, 0 ]; // off
    await colorize(device, acolor);
    await device.close();
}

async function openDevice() {
    const vendorId = 0x2c0d; // embrava.com
    const productId = 0x000c;  // blynclight standard
    const device_list = await navigator.hid.getDevices();
    let device = device_list.find(d => d.vendorId === vendorId && d.productId === productId);

    if (!device) {
        let devices = await navigator.hid.requestDevice({
            filters: [{ vendorId, productId }],
        });
        console.log("devices:", devices);
        device = devices[0];
        if( !device ) return null;
    }
    if (!device.opened) {
        await device.open();
    }
    console.log("device opened:",device);
    return device;
}

async function colorize(device, [r, g, b] ) {
    if(!device) return;
    const data = Uint8Array.from([ r,b,g, 0x00, 0x00, 0x40, 0x02, 0xFF22 ]);
    // 4th parameter is light control, 0 is stable, 70 is fast blink?, 100 is medium blink?
    try {
        await device.sendReport(0, data);    //If the HID device does not use report IDs, set reportId to 0.
    } catch (error) {
        console.error(error);
    }
}
