var vows = require("vows"),
    assert = require("assert"),
    fs = require("fs"),
    cs = require("../"),
    fsw = require("../src/fswrapper");

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
        buflen: 10,
        diskSpace: function(path, callback) {
            self.calls.push({
                func: "diskSpace",
                path: path
            });
            callback(null, 1024 * 1024 * 1024);
        },
        openRead: function(path, fds, fail, next) {
            self.calls.push({
                func: "openRead",
                path: path,
                fdr: fds.r,
                fdw: fds.w
            });
            fsw.openRead(path, fds, fail, next);
        },
        openWrite: function(path, fds, fail, next) {
            self.calls.push({
                func: "openWrite",
                path: path,
                fdr: fds.r,
                fdw: fds.w
            });
            fsw.openWrite(path, fds, fail, next);
        },
        readBuffer: function(fds, info, buflen, fail, next) {
            self.calls.push({
                func: "readBuffer",
                fdr: fds.r,
                fdw: fds.w,
                buflen: buflen
            });
            fsw.readBuffer(fds, info, buflen, fail, next);
        },
        writeBuffer: function(fds, buffer, bytesRead, callback) {
            self.calls.push({
                func: "writeBuffer",
                fdr: fds.r,
                fdw: fds.w
            });
            fsw.writeBuffer(fds, buffer, bytesRead, callback);
        }
    };
}

vows.describe("copying a file").addBatch({
    "given a file to be copied": {
        topic: function() {
            var path = "./test-copy.dat";
            fs.writeFileSync(path, new Buffer(11));   // 1 byte more than 10 bytes
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
                    "are called": function(mock) {
                        assert.equal(mock.calls.length, 7);
                    },
                    "*diskSpace* is called first": function(mock) {
                        assert.equal(mock.calls[0].func, "diskSpace");
                    },
                    "then *openRead* with the path of the file and no fds": function(mock) {
                        assert.equal("openRead", mock.calls[1].func);
                        assert.equal("./test-copy.dat", mock.calls[1].path);
                        assert.isNull(mock.calls[1].fdr);
                        assert.isNull(mock.calls[1].fdw);
                    },
                    "then *openWrite* with the path of the destination file and only fds.r": function(mock) {
                        assert.equal("openWrite", mock.calls[2].func);
                        assert.equal("./test-copy.dat.copy", mock.calls[2].path);
                        assert.isNotNull(mock.calls[2].fdr);
                        assert.isNull(mock.calls[2].fdw);
                    },
                    "*readBuffer*": function(mock) {
                        assert.equal("readBuffer", mock.calls[3].func);
                        assert.equal(mock.calls[2].fdr, mock.calls[3].fdr);
                        assert.isNotNull(mock.calls[3].fdw);
                        assert.equal(mock.funcs.buflen, mock.calls[3].buflen);
                    },
                    "*writeBuffer*": function(mock) {
                        assert.equal("writeBuffer", mock.calls[4].func);
                        assert.equal(mock.calls[2].fdr, mock.calls[4].fdr);
                        assert.equal(mock.calls[3].fdw, mock.calls[4].fdw);
                    },
                    "*readBuffer* again": function(mock) {
                        assert.equal("readBuffer", mock.calls[5].func);
                        assert.equal(mock.calls[2].fdr, mock.calls[5].fdr);
                        assert.isNotNull(mock.calls[5].fdw);
                        assert.equal(mock.funcs.buflen, mock.calls[3].buflen);
                    },
                    "*writeBuffer* again": function(mock) {
                        assert.equal("writeBuffer", mock.calls[6].func);
                        assert.equal(mock.calls[2].fdr, mock.calls[6].fdr);
                        assert.equal(mock.calls[3].fdw, mock.calls[6].fdw);
                    },
                }
            }
        }
    }
}).export(module);
