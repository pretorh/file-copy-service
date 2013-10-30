var cs = require("../"),
    http = require("http");

var buf = new Buffer(1024*1024*64);

var server = cs.server.create(8080);
server.start();

server.on("listen", function() {
    console.log("server started, requesting");
    makeRequest("/copy", {
        source: "./test-server.dat",
        dest: "./test-server-dest.dat"
    },
    function(id) {
        console.log("request id: %s", id);
        process.nextTick(server.stop);
    });
});
server.on("request", function(method, url) {
    console.log("got request %s %s", method, url);
});

function makeRequest(url, data, callback) {
    var req = http.request({
        hostname: "localhost",
        port: 8080,
        method: "POST",
        path: url
    },
    function(response) {
        response.on("data", function(d) {
            callback(JSON.parse(d));
        });
    });
    req.on("error", function(e) {
        console.log("req error");
        console.log(e);
    });
    req.write(JSON.stringify(data));
    req.end();
}
