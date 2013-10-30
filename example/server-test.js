var cs = require("../"),
    http = require("http");

var buf = new Buffer(1024*1024*64);
require("fs").writeFileSync("./test-server.dat", buf);

var server = cs.server.create(8080);
server.start();

server.on("listen", function() {
    console.log("server started, requesting");
    makeRequest("/copy", "POST", {
        source: "./test-server.dat",
        dest: "./test-server-dest.dat"
    },
    function(id) {
        console.log("request id: %s", id);
        
        makeRequest("/status/" + id, "GET", null, function(result) {
            console.log(result);
            waitDone();
            
            function waitDone() {
                makeRequest("/status/" + id, "GET", null, function(result) {
                    if (result.done) {
                        makeRequest("/detail/" + id, "GET", null, function(detailed) {
                            console.log(detailed);
                            process.nextTick(server.stop);
                        });
                        require("fs").unlinkSync("./test-server.dat");
                        require("fs").unlinkSync("./test-server-dest.dat");
                    } else {
                        setTimeout(waitDone, 250);
                    }
                });
            }
        });
    });
});
server.on("request", function(method, url) {
    console.log("got request %s %s", method, url);
});

function makeRequest(url, method, data, callback) {
    var req = http.request({
        hostname: "localhost",
        port: 8080,
        method: method,
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
