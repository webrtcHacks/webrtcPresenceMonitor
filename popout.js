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

document.querySelector('button').onclick = openDevice;

//ToDo: event to check device and then close
