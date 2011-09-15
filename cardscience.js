#!/usr/bin/env node
var util = require("util");

csutil = require("./lib/util");

cradle = require("cradle");
nomnom = require("nomnom");
zombie = require("zombie");

log = require("./lib/logging");

url = require('url');

base = require("./lib/models/base");
card = require("./lib/models/card");
format = require("./lib/models/format");

scraper = require("./lib/scraper");

var c = "Main";

var CardScience = function() {
    console.log("Welcome to CardScience.");
    var options = nomnom.opts({
        installdb: {
            abbr: "i",
            help: "Install design documents into CouchDB",
            flag: true
        },
        console: {
            abbr: "c",
            help: "Start a REPL with CardScience's data model gaunch loaded",
            flag: true
        }
    }).parseArgs();
    var connection = new cradle.Connection();
    var db = connection.database("cardscience");
    

    var initialize = function() {
        base.init(db);
        
        if(options.console) {
            var repl = require("repl");
            repl.start("CS> ");
        } else if(options.installdb) {
            base.Base.updateAllDesignDocuments(function() {
                log.info(c, "Updated all design docs successfully.");
                // now that data model is properly initialized, do initial loads from DB, etc
                process.exit(0);
            }.bind(this), function(e) {
                log.error(c, "Problem updating design documents: " + e.reason);
                process.exit(-1);
            });
        } else {
            var s = new scraper.Scraper();
            s.fullScrape();
        }
    };

    db.exists(function(err, exists) {
        if(err) {
            log.error(c, "Yikes, problem connecting to CouchDB: " + err);
        } else if(exists) {
            log.debug(c, "Database is ready.");
            initialize();
        } else {
            log.info(c, "Database does not yet exist, creating it.");
            db.create();
            initialize();
        }
    });
};

new CardScience(function() {
    // success
    log.info(c, "Success!");
}, function() {
    // failure
    log.error(c, "Problems fetching the pages, giving up.");
});
