module.exports = Item;

var fs = require("fs"),
    defaultify = require("defaultify"),
    fsw = require("./fswrapper");

function Item(request, readyCallback) {
    var self = this;
    self.info = {
        status: null,
        message: null,
        done: false,
        history: []
    };
    var funcs = defaultify(request ? request.funcs : {}, fsw, true).value;

    self.fail = function(message, detailed) {
        self.setStatus("failed", message, true);
        if (detailed)
            self.info.detailed = detailed;
    }

    self.setStatus = function(status, message, isDone) {
        self.info.status = status;
        self.info.message = message;
        self.info.history.push({
            status: status,
            date: new Date()
        });
        if (isDone) {
            self.info.done = true;
            self.info.detailed = null;
        }
    }

    self.work = function(callback) {
        var fds = {
            r: null,
            w: null,
            totalRead: 0
        };

        if (self.info.dst.device == self.info.src.device && self.info.move) {
            process.nextTick(moveOnly);
        } else {
            process.nextTick(prepareCopy);
        }

        function prepareCopy() {
            self.setStatus("prepare", "get disk space, open files");
            funcs.diskSpace(self.info.dst.dir, function(err, bytes) {
                if (err) {
                    workFail("df", err);
                } else if (bytes < self.info.src.size) {
                    workFail("not enough space on destination");
                } else {
                    process.nextTick(openFiles);
                }
            });
        }

        function openFiles() {
            funcs.openRead(self.info.src.path, fds, workFail, function() {
                funcs.openWrite(self.info.dst.path, fds, workFail, copyNextBlock);
            });
        }

        function copyNextBlock() {
            self.setStatus("copy", "copy file contents");
            funcs.readBuffer(fds, self.info, funcs.buflen, workFail, function(buffer, bytesRead) {
                funcs.writeBuffer(fds, buffer, bytesRead, function(err, bytesWritten) {
                    if (err) {
                        workFail("write", err);
                    } else if (bytesRead === funcs.buflen) {
                        // read more
                        process.nextTick(copyNextBlock);
                    } else {
                        // write done
                        funcs.closeFds(fds, true);
                        process.nextTick(sync);
                    }
                });
            });
        }

        function sync() {
            self.setStatus("sync", "sync destination file to disk");
            fs.fsync(fds.w, function(err) {
                if (err) {
                    workFail("sync", err);
                } else {
                    funcs.closeFds(fds, false);
                    process.nextTick(syncDone);
                }
            });
        }

        function syncDone() {
            if (self.info.move) {
                move();
            } else {
                done();
            }
        }

        function move() {
            self.setStatus("move", "remove source file");
            fs.unlink(self.info.src.path, function(err) {
                if (err) {
                    workFail("move", err);
                } else {
                    process.nextTick(done);
                }
            });
        }

        function moveOnly() {
            self.setStatus("move", "move source file to destination file (same device)");
            fs.rename(self.info.src.path, self.info.dst.path, function(err) {
                if (err) {
                    workFail("move", err);
                } else {
                    process.nextTick(done);
                }
            });
        }

        function done() {
            self.setStatus("done", "all done", true);
            process.nextTick(callback);
        }

        function workFail(step, err) {
            self.fail(step, err);
            funcs.closeFds(fds);
            process.nextTick(callback);
        }
    }

    function validateRequest() {
        if (!request || !request.source || !request.dest) {
            self.fail("bad request");
            return;
        }

        fs.stat(request.source, function(err, srcStat) {
            if (err) {
                self.fail("source stat failed", err);
            } else if (!srcStat.isFile()) {
                self.fail("source is not a file");
            } else {
                self.info.src = {
                    path: request.source,
                    device: srcStat.dev,
                    size: srcStat.size
                };
                process.nextTick(validateDestination);
            }
        });
    }

    function validateDestination() {
        var re = /^(.*)\/.*$/;
        var destDir = request.dest.match(re);
        destDir = destDir ? destDir[1] : ".";

        if (fs.existsSync(request.dest)) {
            self.fail("destination already exist");
            return;
        }

        fs.stat(destDir, function(err, destStat) {
            if (err) {
                self.fail("dest stat failed", err);
            } else if (!destStat.isDirectory()) {
                self.fail("dest's directory stat is not a directory", destDir);
            } else {
                self.info.dst = {
                    path: request.dest,
                    dir: destDir,
                    device: destStat.dev
                };
                process.nextTick(validationFinalize);
            }
        });
    }

    function validationFinalize() {
        self.info.move = request.move === true;
        self.setStatus("queue", "queued on device");
        readyCallback();
    }

    self.setStatus("pending", "preparing");
    process.nextTick(validateRequest);
}
