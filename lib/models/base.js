var util = require("util");

var couch = undefined;

var resources = [];

var pluralize = function(str) {
    var lastchar = str[str.length - 1];
    if(lastchar === 'y') {
	    return str.substring(0, str.length - 1) + "ies";
    } else if(lastchar === 'h') {
	    return str + "es";
    } else {
	    return str + "s";
    }
};

exports.init = function(couchdb) {
    couch = couchdb;
};

exports.Base = function() {
    // TODO check a config document and see if we're up to date, and run installDesignDocuments for all models
    var config = this.config;

    this.pluralized_name = pluralize(config.name);

    var instancePrototype = {
        save: function(done, error) {
            if(this.id === undefined) {
                throw new Error("Instances must have an ID set before saving.  This isn't an RDBMS with a sequence.");
            }
            var save_hash = {};
            for(var property in this) {
                if(this.hasOwnProperty(property)) {
                    save_hash[property] = this[property];
                }
            }
            save_hash.type = config.name;
            couch.save(this.id, save_hash, function(err, res) {
                if(err) {
                    error();
                } else {
                    done();
                }
            });
        },
        destroy: function(done, error) {
            couch.remove(this.id, function(err, res) {
                if(err) {
                    error();
                } else {
                    done();
                }
            });
        }
    };

    this.newInstance = function(bare_object) {
        // TODO need a better instance system than this
        var instance = bare_object || {};
        instance.type = this;
        instance.__proto__= instancePrototype;
        return instance;
    };

    this.handleViewError = function(error) {
        console.log(util.inspect(error));
        if(error.error === "not_found") {
            console.log("not_found error while attempting to evaluate view; perhaps you need to run ./pump-house.js -i?");
        }
        return error.error + ": " + error.reason;
    };

    this.updateDesignDocuments = function(done, error) {
        console.log("Doing design document update for '" + config.name + "'.");
        
        // add some of my own builtin views
        var localviews = {
            "all": {
                "map": function(doc) {
                    if(doc["type"] === $MODEL_NAME) {
                        emit(doc["_id"], doc);
                    }
                }
            }
        };

        if(config.views !== undefined) {
            for(var view_name in config.views) {
                if(config.hasOwnProperty(view_name)) {
                    localviews[view_name] = config.views[view_name];
                }
            }
        }

        // now, iterate through all the view methods to do a bit of replacement
        // neat that we can coerce a Function into a String, no?
        for(var view_name in localviews) {
            if(localviews.hasOwnProperty(view_name)) {
                var view = localviews[view_name];
                var regex = new RegExp("\\$MODEL_NAME", "g");
                if(view.map !== undefined) {
                    var old_source = String(view.map); // convert function into string
                    view.map = old_source.replace(regex, '"' + config.name + '"');
                }
                if(view.reduce !== undefined) {
                    var old_source = String(view.map); // convert function into string
                    view.reduce = old_source.replace(regex, '"' + config.name + '"');
                }
            }
        }

        var design = {"views": localviews};

        couch.save("_design/" + this.pluralized_name,
                   design, function(err, res) {
                       if(!err) {
                           done();
                           console.log("... done!");
                       } else {
                           error(err);
                       }
                   });
    };

    this.find = function(id, success, error) {
        // TODO build model instance object around result
        couch.get(id, function(err, doc) {
            if(err) {
                error(err.error + ": " + err.reason);
            } else {
                if(doc.type !== config.name) {
                    cb(doc["_id"] + " isn't a " + config.name);
                } else {
                    doc.__proto__ = instancePrototype;
                    success(doc);
                }
            }
        }.bind(this));
    };

    this.findAll = function(cb) {
        // TODO build model instance objects around results
        couch.view(this.pluralized_name + "/all", function(err, res) {
            if(err) {
                cb(this.handleViewError(err));
            } else {
                cb(false, res);
            }
        }.bind(this));
    };

    return this;
};

// maybe I need some more generic flow control logic...
exports.Base.updateAllDesignDocuments = function(done, error) {
    var still_to_iterate = resources.slice(0);
    var doNext = function() {
        if(still_to_iterate.length === 0) {
            done();
            return;
        }
        var r = still_to_iterate.pop();
        r.updateDesignDocuments(function() {
            doNext();
        }, function(e) {
            error(e);
        });
    };
    doNext();
};

exports.register = function(model) {
    resources.push(exports.Base.apply(model));
};
