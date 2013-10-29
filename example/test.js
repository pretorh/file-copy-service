var cs = require("../");

var copyService = new cs.CopyService();

require("fs").writeFileSync("./test.dat", "some data in the file");

var id1 = copyService.copy({
    source: "test.dat",
    dest: "./test-copy.dat"
});
var id2 = copyService.copy();
var id3 = copyService.copy({
    source: "test.dat",
    dest: "./test-copy2.dat"
});
var id4 = copyService.copy({
    source: "test.dat",
    dest: "/tmp/test-copy2.dat"
});

console.log(id1);
console.log(copyService.status(id1));

process.nextTick(function() {
    console.log(copyService.status(id1));
    console.log(copyService.status(id2));
    
    function wait() {
        var stat1 = copyService.status(id1);
        var stat3 = copyService.status(id3);
        var stat4 = copyService.status(id4);
        if (stat1.status === "pending" || stat3.status === "pending" || stat4.status === "pending") {
            setTimeout(wait, 10);
            require("fs").unlinkSync("./test.dat");
        } else {
            console.log(stat1);
            console.log(stat3);
            console.log(stat4);
        }
    }
    
    wait();
});
