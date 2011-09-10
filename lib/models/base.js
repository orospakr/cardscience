var util = require("util");

var putil = require('../util');
var log = require("../logging");

var c = "Base";

var couch = undefined;

var resources = [];

/**
   Call this once when initializing the whole base.js/model subsystem

   @param {Object} couchdb Your CouchDB database instance from Cradle.
*/
exports.init = function(couchdb) {
    couch = couchdb;
};

/**
   The Model base class.

   Simple ORMish abstraction built on CouchDB/Cradle.

   Instances are basically decorated CouchDB record hashes, with a
   prototype that includes some typical ActiveRecord-style methods on
   it.  Their hash hey is specified by an `_id` property, and if the
   record was fetched from the database, it will also feature the
   `rev` property.
 */
exports.Base = function() {
    // TODO check a config document and see if we're up to date, and
    // run installDesignDocuments for all models
    var config = this.config;

    this.pluralized_name = putil.pluralize(config.name);

    /**
       Prototype object for all instances of this model.
    */
    var instancePrototype = {
        /**
           Save this instance to the database.

           If this instance exists already in the database and was
           fetched from there, the revision identifier we saw will be
           specified.
         */
        save: function(done, error) {
            // TODO: when we save, we should be getting our new _rev
            // somehow (and an _id automatically assigned if we didn't
            // include one). we need to set those on our instance!
            if(this._id === undefined) {
                // TODO this is bullcrap.  however, we'll only be able
                // to take it away once we get revid back from save
                // and update ourselves with it.
                throw new Error("Instances must have an ID set before saving.  This isn't an RDBMS with a sequence.");
            }
            var save_hash = {};
            for(var property in this) {
                if(property === "_id") {
                    // skip ID, since it must be specified separately
                    continue;
                }
                if(this.hasOwnProperty(property)) {
                    save_hash[property] = this[property];
                }
            }
            save_hash.type = config.name;
            // this._id might not be set.  if so, no worries, we'll
            // pass undefined and couchdb will assign one.  also,
            // we're specifying an undefined revision here, but if our
            // instance has _rev on it, it actually will be honoured
            // by cradle.
            couch.save(this._id, undefined, save_hash, function(err, res) {
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
        },
        type: this
    };

    /**
       Create a new (unsaved) instance of this model.

       @param {Object} [bare_object] An optional object hash
         containing existing values to save in the new instance.
    */
    this.newInstance = function(bare_object) {
        // TODO need a better instance system than this
        var instance = bare_object || {};
        instance.__proto__= instancePrototype;
        return instance;
    };

    this.handleViewError = function(error) {
        console.log(util.inspect(error));
        if(error.error === "not_found") {
            console.log("not_found error while attempting to evaluate view; perhaps you need to run ./cardscience.js -i?");
        }
        return error.error + ": " + error.reason;
    };

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
            if(config.views.hasOwnProperty(view_name)) {
                localviews[view_name] = config.views[view_name];
            }
        }
    }

    /**
       Defines methods wrapping all of the views you defined in your model.
       
       Those handlers have the following signature:
       
       @param {Number|Hash} query_options View options to pass
         directly to Cradle/CouchDB.  Note that the most useful one is
         `key`, which will allow you to select a given key from the
         virtual view hash table.  If you pass a Number here instead,
         it will query for that as a key.
       @param {Function} done Callback when results are ready.
       @param {Function} error Callback when there is a problem.

       @return {Array} A list of the matched rows.
     */
    for(var view_name in localviews) {
        if(localviews.hasOwnProperty(view_name)) {
            /**
               This is the function wrapper itself.
            */
            this[view_name] = function(query_options, done, error) {
                log.debug(c, "Querying " + this.pluralized_name + "/" + view_name);
                if(query_options === undefined) {
                    query_options = {};
                } if(!isNaN(query_options) || typeof query_options === "string") { 
                    query_options = {key: query_options};
                }
                couch.view(this.pluralized_name + "/" + view_name, query_options, function(err, res) {
                    if(err) {
                        error(this.handleViewError(err));
                    } else {
                        var instances = [];
                        res.forEach(function(row) {
                            instances.push(this.newInstance(row));
                        }.bind(this));
                        done(instances);
                    }
                }.bind(this));
            };
        }
    }
    
    this.updateDesignDocuments = function(done, error) {
        console.log("Checking if '" + config.name + "' needs design document update.");

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
        couch.get(id, function(err, doc) {
            if(err) {
                error(err.error + ": " + err.reason);
            } else {
                if(doc.type !== config.name) {
                    error(doc["_id"] + " isn't a " + config.name);
                } else {
                    success(this.newInstance(doc));
                }
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
