Number.prototype.times = function(cb) {
    for(var c = 0; c < this.valueOf(); c++) {
        cb(c);
    }
};

// erm, this implementation noms a stack frame for every iteration
Array.prototype.eachWait = function(callback, done, error) {
    var position = -1;
    
    var cbdone = function() {
        position += 1;
        if(position == this.length - 1) {
            done();
        } else {
            callback(this[position], cbdone, error);
        }
    }.bind(this);
    cbdone();
};
