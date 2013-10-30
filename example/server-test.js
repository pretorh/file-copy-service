var cs = require("../"),
    http = require("http");

var buf = new Buffer(1024*1024*64);

var server = cs.server.create(8080);
server.start();

server.on("listen", function() {
    console.log("server started, requesting");
    makeRequest({
        source: "./test-server.dat",
        dest: "./test-server-dest.dat"
    },
    function(id) {
        console.log("request id: %s", id);
    });
});
server.on("request", function() {
    console.log("got request, ending");
    process.nextTick(server.stop);
});

function makeRequest(data, callback) {
    var req = http.request({
        hostname: "localhost",
        port: 8080,
        method: "POST"
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
