module.exports.create = create;

var http = require("http"),
    events = require("events"),
    CopyService = require("./copier");

function create(port) {
    return new Server(port);
}

function Server(port) {
    var self = this;
    
    self.start = function() {
        process.nextTick(function() {
            if (server)
                self.stop();
            server = http.createServer(requestHandler)
            server.listen(port, function() {
                self.emit("listen");
            });
        });
    }
    
    self.stop = function() {
        if (!server) return;
        process.nextTick(function() {
            server.close();
            server = null;
        });
    }
    
    function requestHandler(request, response) {
        self.emit("request");
        
        var buf = "";
        request.on("data", function(chunk) {
            buf += chunk.toString();
        });
        request.on("end", function() {
            requestCopy(request, response, buf);
        });
    }
    
    function requestCopy(request, response, data) {
        var result = copyService.copy(data);
        response.writeHead(200, {
            "Content-Type": "application/json"
        });
        response.end(JSON.stringify(result));
    }
    
    var server = null;
    var copyService = new CopyService();
    
    events.EventEmitter.call(self);
}

Server.prototype.__proto__ = events.EventEmitter.prototype
