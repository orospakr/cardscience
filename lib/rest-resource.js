var util = require("util");

var log = require("../logging");

var resource = require("../resource");

var c = "Resource";

exports.RestResource = function(model) {
    resource.Resource.call(this);

    this.routes = {
        "": function(req, response, nohitcb, errorcb, remaining_elements) {
            model.findAll(function(err, instances) {
                if(err) {
                    errorcb(err);
                } else {
                    // I think there's a copy here, not sure how to avoid it...
                    var answer = new Buffer(JSON.stringify(instances, null, 2), "utf8");
                    response.writeHead(200, {"Content-Type": "application/json",
                                             "Content-Length": answer.length});
                    response.end(answer);
                }
            });
        }
    };

    this.consumeRequest = function(path_elements, req, response, nohitcb) {
        var hit = false;

        var onError = function(e) {
            log.error(c, "Problem: " + e);
            response.writeHead(500);
            response.end("Server trouble.");
        };

        for(var name in this.routes) {
            if(this.routes.hasOwnProperty(name)) {
                this.route(path_elements, name, function(remaining_elements) {
                    hit = true;
                    this.routes[name](req, response, nohitcb, onError, remaining_elements);
                }.bind(this));
            }
        }

        if(!hit) {
            // I'm responsible for emitting the 404; I had nowhere to direct the request.
            nohitcb();
        }
    };
};
util.inherits(exports.RestResource, resource.Resource);
