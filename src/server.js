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
        self.emit("request", request.method, request.url);
        
        var isCopy = request.method == "POST" && request.url == "/copy";
        var isStat = request.method == "GET" && request.url.match(/^\/status\/[0-9a-fA-F]{8}$/);
        var isDetail = request.method == "GET" && request.url.match(/^\/detail\/[0-9a-fA-F]{8}$/);
        
        if (isCopy) {
            var buf = "";
            request.on("data", function(chunk) {
                buf += chunk.toString();
            });
            request.on("end", function() {
                requestCopy(request, response, buf);
            });
        } else if (isStat || isDetail) {
            writeResponse(response, 500, {error: "method not implemented"});
        } else {
            writeResponse(response, 400, {
                error: "bad request",
                method: request.method,
                url: request.url
            });
        }
    }
    
    function requestCopy(request, response, data) {
        var result = copyService.copy(data);
        writeResponse(response, 200, result);
    }
    
    function writeResponse(response, status, data) {
        response.writeHead(status, {
            "Content-Type": "application/json"
        });
        response.end(JSON.stringify(data));
    }
    
    var server = null;
    var copyService = new CopyService();
    
    events.EventEmitter.call(self);
}

Server.prototype.__proto__ = events.EventEmitter.prototype
