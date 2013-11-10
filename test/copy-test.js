var vows = require("vows"),
    assert = require("assert"),
    fs = require("fs"),
    cs = require("../");

function waitDone(info, callback) {
    var stat = info.service.status(info.id);
    if (stat.done) {
        info.status = stat;
        callback(null, info);
    } else {
        setTimeout(function() {
            waitDone(info, callback);
        }, 50);
    }
}

function FsMock() {
    var self = this;
    self.calls = [];

    self.funcs = {
        diskSpace: function(path, callback) {
            self.calls.push({
                func: "diskSpace",
                path: path
            });
            callback(null, 1024 * 1024 * 1024);
        }
    };
}

vows.describe("copying a file").addBatch({
    "given a file to be copied": {
        topic: function() {
            var path = "./test-copy.dat";
            fs.writeFileSync(path, new Buffer(16 * 1024 * 1024));
            return {
                source: path,
                dest: path + ".copy"
            };
        },
        "when copy is called": {
            topic: function(item) {
                var service = new cs.CopyService();
                var mock = new FsMock();
                item.funcs = mock.funcs;
                var id = service.copy(item);
                return {
                    service: service,
                    mock: mock,
                    id: id,
                    item: item
                };
            },
            "an 8 hex digit number is returned": function(info) {
                assert.isDefined(info.id);
                assert.equal(typeof(info.id), "string");
                assert(info.id.match(/[0-9a-fA-F]{8}/) != null);
            },
            "the file is eventually copied": {
                topic: function(info) {
                    waitDone(info, this.callback);
                },
                "the destination can be removed": function(e, info) {
                    fs.unlinkSync(info.item.dest);
                },
                "the source can be removed": function(e, info) {
                    fs.unlinkSync(info.item.source);
                },
                "the status is *done*": function(e, info) {
                    assert.equal("done", info.status.status, "done");
                },
                "the message is *completed*": function(e, info) {
                    assert.equal("all done", info.status.message);
                },
                "and the mocked function": {
                    topic: function(info) {
                        return info.mock;
                    },
                    "*diskSpace* is called first": function(mock) {
                        assert.equal(mock.calls[0].func, "diskSpace");
                    }
                }
            }
        }
    }
}).export(module);
