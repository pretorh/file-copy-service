var cs = require("../");

var copyService = new cs.CopyService();

require("fs").writeFileSync("./test.dat", "some data in the file");

var id1 = copyService.copy({
    source: "test.dat",
    dest: "./test-copy.dat"
});
var id2 = copyService.copy();

console.log(id1);
console.log(copyService.status(id1));

process.nextTick(function() {
    console.log(copyService.status(id1));
    console.log(copyService.status(id2));
    
    function wait() {
        var stat = copyService.status(id1);
        if (stat.status === "pending") {
            setTimeout(wait, 10);
            require("fs").unlinkSync("./test.dat");
        } else {
            console.log(stat);
        }
    }
    
    wait();
});
