module.exports = CopyService;

var fs = require("fs");
const BUFLEN = 1024 * 1024 * 16;

function CopyService() {
    var self = this;
    
    var devices = [];
    var items = {};
    
    self.copy = function(request) {
        var id = createId();
        items[id] = new Item(request, function() {
            var dstDev = items[id].info.dst.device;
            if (!devices[dstDev]) {
                devices[dstDev] = new DeviceQueue(dstDev);
            }
            devices[dstDev].enqueue(items[id]);
        });
        return id;
    }
    
    self.status = function(id) {
        return {
            done: items[id].info.done,
            status: items[id].info.status,
            message: items[id].info.message
        };
    }
    
    self.detailed = function(id) {
        return items[id].info;
    }
}

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
        process.nextTick(openRead);
        
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
                fail(id, "dest stat failed", err);
            } else if (!destStat.isDirectory()) {
                fail(id, "dest's directory stat is not a directory", destDir);
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
    
    var fds = {
        r: null,
        w: null,
        totalRead: 0
    };
    
    self.setStatus("pending", "preparing");
    process.nextTick(validateRequest);

}

function createId() {
    // create a number 0x100000000 -> 0x1FFFFFFFF, convert to hex, drop the first digit
    return Math.floor((1 + Math.random()) * 0x100000000)
        .toString(16)
        .substring(1);
}

function DeviceQueue(devId) {
    self = this;
    var requestNumber = 0;
    var queue = [];
    
    self.enqueue = function(item) {
        item.info.deviceRequestNumber = requestNumber++;
        queue.push(item);
        if (queue.length === 1) {
            process.nextTick(work);
        }
    }
    
    function work() {
        var item = queue.shift();
        item.work(function() {
            if (queue.length > 0) {
                process.nextTick(work);
            }
        });
    }
}
