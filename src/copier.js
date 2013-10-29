module.exports = CopyService;

var fs = require("fs");

function CopyService() {
    var self = this;
    
    var devices = [];
    var items = {};
    
    self.copy = function(request) {
        var id = createId();
        items[id] = new Item(request, function() {
            
        });
        return id;
    }
    
    self.status = function(id) {
        return items[id].info;
    }
}

function Item(request, readyCallback) {
    var self = this;
    self.info = {
        status: "pending",
        message: "preparing"
    };
    
    self.fail = function(message, detailed) {
        self.setStatus("failed", message);
        if (detailed)
            self.info.detailed = detailed;
    }
    
    self.setStatus = function(status, message) {
        self.info.status = status;
        self.info.message = message;
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
                process.nextTick(validationDone);
            }
        });
    }
    
    function validationDone() {
        self.setStatus("queue", "queued on device");
        readyCallback();
    }
    
    process.nextTick(validateRequest);

}

function createId() {
    // create a number 0x100000000 -> 0x1FFFFFFFF, convert to hex, drop the first digit
    return Math.floor((1 + Math.random()) * 0x100000000)
        .toString(16)
        .substring(1);
}
