// Stream Pump - Live video stream reflector written in Node.js
// Copyright (C) 2010-2011  Government of Canada
// Written by Andrew Clunis <aclunis@credil.org>
// See COPYING for license terms.

exports.Resource = function() {
    /* When you derive from this object, add this method:
     *   this.consumeRequest = function(path_elements, req, response, nohitcb) { ... } */

    this.route = function(path_elements, name, cb) {
	if(path_elements.length === 0) {
            if(name === "") {
                cb([]);
		return;
            } else {
                return;
            }
        }

        if(path_elements[0].match("^" + name + "$", "i")) {
            var remaining_elements = path_elements.splice(1, path_elements.length - 1);
            cb(remaining_elements);
        }
    };    
};
