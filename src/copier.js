module.exports = CopyService;

var fs = require("fs"),
    Item = require("./item");

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
        if (items[id]) {
            return {
                done: items[id].info.done,
                status: items[id].info.status,
                message: items[id].info.message
            };
        } else {
            return "invalid id";
        }
    }
    
    self.detailed = function(id) {
        if (items[id]) {
            return items[id].info;
        } else {
            return "invalid id";
        }
    }

    self.pending = function() {
        var count = 0;
        for (var id in items) {
            if (!items[id].info.done) {
                ++count;
            }
        }
        return count;
    }
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
    var current = null;

    self.enqueue = function(item) {
        item.info.deviceRequestNumber = requestNumber++;
        queue.push(item);
        if (queue.length === 1 && current === null) {
            process.nextTick(work);
        }
    }

    function work() {
        current = queue.shift();
        current.work(function() {
            if (queue.length > 0) {
                process.nextTick(work);
            } else {
                current = null;
            }
        });
    }
}
