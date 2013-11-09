#!/usr/bin/env node

if (process.argv == 2 || isNaN(process.argv[2])) {
    console.log("need the port to listen on as first argument");
    process.exit(1);
}

var port = process.argv[2];
var server = require("../").server.create(port);
server.on("request", function(method, url) {
    console.log("%s %s", method, url);
});
server.start();

