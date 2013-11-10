module.exports = {
    diskSpace: diskSpace
};

var spawn = require("child_process").spawn;

function diskSpace(path, callback) {
    var df = spawn("df", ["--output=avail", path]);
    var stdout = "";
    df.stdout.on("data", function(data) {
        stdout += data.toString();
    });
    df.on("close", function(exitCode) {
        if (exitCode) {
            callback(new Error("df exited with code " + exitCode));
        } else {
            var matches = stdout.match(/^.*\n(\d+)\n$/);
            if (!matches) {
                callback(new Error("invalid df output: " + stdout));
            } else {
                callback(null, parseInt(matches[1]) * 1024);
            }
        }
    });
}

