module.exports = Item;

var fs = require("fs")

const BUFLEN = 1024 * 1024 * 16;

function Item(request, readyCallback) {
    var self = this;
    self.info = {
        status: null,
        message: null,
        done: false,
        history: []
    };
    
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
            process.nextTick(openRead);
        }

        function openRead() {
            self.setStatus("copy", "copy file contents");
            fs.open(self.info.src.path, "r", function(err, fd) {
                if (err) {
                    workFail("open source", err);
                } else {
                    fds.r = fd;
                    process.nextTick(openWrite);
                }
            });
        }

        function openWrite() {
            fs.open(self.info.dst.path, "w", function(err, fd) {
                if (err) {
                    workFail("open destination", err);
                } else {
                    fds.w = fd;
                    process.nextTick(read);
                }
            });
        }

        function read() {
            var buf = new Buffer(BUFLEN);
            fs.read(fds.r, buf, 0, BUFLEN, null, function(err, bytesRead, buffer) {
                if (err) {
                    workFail("read", err);
                } else {
                    fds.totalRead += bytesRead;
                    self.info.detailed = fds.totalRead + " bytes";
                    process.nextTick(function() {
                        write(buf, bytesRead);
                    });
                }
            });
        }

        function write(buffer, bytesRead) {
            fs.write(fds.w, buffer, 0, bytesRead, null, function(err, bytesWritten) {
                if (err) {
                    workFail("write", err);
                } else if (bytesRead === BUFLEN) {
                    // read more
                    process.nextTick(read);
                } else {
                    // write done
                    fs.close(fds.r);
                    fds.r = null;
                    process.nextTick(sync);
                }
            });
        }

        function sync() {
            self.setStatus("sync", "sync destination file to disk");
            fs.fsync(fds.w, function(err) {
                if (err) {
                    workFail("sync", err);
                } else {
                    fs.close(fds.w);
                    fds.w = null;
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
            if (fds.r) fs.close(fds.r);
            if (fds.w) fs.close(fds.w);

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
