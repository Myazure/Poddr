const BrowserWindow = require("electron").BrowserWindow;
const log = require("electron-log");

(function () {
    var mainWindow = BrowserWindow.getAllWindows()[0];

    async function registerDbus(desktop, bus) {
        var object = await bus.getProxyObject("org." + desktop + ".SettingsDaemon", "/org/" + desktop + "/SettingsDaemon/MediaKeys");
        var mediaKeys = object.getInterface("org." + desktop + ".SettingsDaemon.MediaKeys");
        mediaKeys.on("MediaPlayerKeyPressed", function (interface, key, error) {
            if (error) log.error(error);
            switch (key) {
                case "Next":
                    log.info("next");
                    return;
                case "Previous":
                    log.info("prev");
                    return;
                case "Play":
                    mainWindow.webContents.send('toggle-play');
                    return;
                case "Stop":
                    log.info("stop");
                    return;
                default: return;
            }
        });
        mediaKeys.GrabMediaPlayerKeys("org." + desktop + ".SettingsDaemon.MediaKeys", 0);
    }

    try {
        log.info("Registering mediakey bindings.");
        var dbus = require("dbus-next");
        var bus = dbus.sessionBus();
        registerDbus("gnome", bus);
        registerDbus("mate", bus);
    } catch (e) {
        log.error(e);
    }
}());