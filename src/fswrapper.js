module.exports = {
    buflen: 16 * 1024 * 1024,
    diskSpace: diskSpace,
    openRead: openRead,
    openWrite: openWrite,
    readBuffer: readBuffer,
    writeBuffer: writeBuffer
};

var spawn = require("child_process").spawn,
    fs = require("fs");

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

function openRead(path, fds, fail, next) {
    fs.open(path, "r", function(err, fd) {
        if (err) {
            fail("open source", err);
        } else {
            fds.r = fd;
            process.nextTick(next);
        }
    });
}

function openWrite(path, fds, fail, next) {
    fs.open(path, "w", function(err, fd) {
        if (err) {
            fail("open destination", err);
        } else {
            fds.w = fd;
            process.nextTick(next);
        }
    });
}

function readBuffer(fds, info, buflen, fail, next) {
    var buf = new Buffer(buflen);
    fs.read(fds.r, buf, 0, buflen, null, function(err, bytesRead, buffer) {
        if (err) {
            fail("read", err);
        } else {
            fds.totalRead += bytesRead;
            info.detailed = fds.totalRead + " bytes";
            process.nextTick(function() {
                next(buf, bytesRead);
            });
        }
    });
}

function writeBuffer(fds, buffer, bytesRead, callback) {
    fs.write(fds.w, buffer, 0, bytesRead, null, callback);
}
