var log = function(level, component, message) {
    var d = new Date();
    console.log(level + " (" + (d.getTime() / 1000).toFixed(3) + "): [" + component + "] " + message);
};

exports.warn = function(component, message) {
    log("WRN", component, message);
};

exports.error = function(component, message) {
    log("ERR", component, message);
};

exports.info = function(component, message) {
    log("INF", component, message);
};

exports.debug = function(component, message) {
    log("DBG", component, message);
};
