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
        var isShutdown = request.method == "GET" && request.url.match(/^\/shutdown$/);
        var isGracefulShutdown = request.method == "GET" && request.url.match(/^\/shutdown\/graceful$/);

        if (isCopy) {
            if (acceptCommands) {
                requestCopy(request, response);
            } else {
                writeResponse(response, 400, "server is not accepting any more commands");
            }
        } else if (isStat) {
            var id = request.url.match(/^\/status\/([0-9a-fA-F]{8})$/)[1];
            writeResponse(response, 200, copyService.status(id));
        } else if (isDetail) {
            var id = request.url.match(/^\/detail\/([0-9a-fA-F]{8})$/)[1];
            writeResponse(response, 200, copyService.detailed(id));
        } else if (isShutdown) {
            writeResponse(response, 200, "ok");
            server.close(function() {
                console.log("ended");
            });
            server = null;
            console.log("http server ended");
        } else if (isGracefulShutdown) {
            writeResponse(response, 200, "ok");
            acceptCommands = false;
            console.log("starting graceful shutdown");
        } else {
            writeResponse(response, 400, {
                error: "bad request",
                method: request.method,
                url: request.url
            });
        }
    }

    function requestCopy(request, response) {
        var data = "";
        request.on("data", function(chunk) {
            data += chunk.toString();
        });
        request.on("end", function() {
            var newId = copyService.copy(JSON.parse(data));
            writeResponse(response, 200, newId);
        });
    }

    function writeResponse(response, status, data) {
        response.writeHead(status, {
            "Content-Type": "application/json",
            "Connection": "close"
        });
        response.end(JSON.stringify(data));
    }

    var server = null;
    var acceptCommands = false;
    var copyService = new CopyService();

    events.EventEmitter.call(self);
}

Server.prototype.__proto__ = events.EventEmitter.prototype
