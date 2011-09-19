#!/usr/bin/env node

var request = require("request");
var url = require("url");

var fs = require("fs");

var log = require("./lib/logging");

var util = require("util");

var c = "FixtureGrabber";

var page_count = 0;
var grabPage = function() {
    log.info(c, "Doing fetch of: " + page_count);
    fetchurl = { protocol: "http",
                 host: "gatherer.wizards.com",
                 pathname: "/Pages/Search/Default.aspx",
                 query: {
                     page: page_count,
                     output: "standard",
                     special: "true", // what's this for?
                     format: '["Classic"]'
                 }
               };    

    request({uri: url.format(fetchurl)}, function(error, response, body) {
        if(error) {
            log.error(c, "Problem fetching page from Gatherer: " + util.inspect(error));
        } else {
            fs.writeFile("./spec/fixtures/" + page_count + ".html", body, function(err) {
                if(err) {
                    log.error(c, "Problem writing page to disk: " + util.inspect(error));
                } else {
                    if(++page_count > 40) {
                        // done!
                        log.info(c, "Done fetch of fixtures!");
                    } else {
                        grabPage();
                    }
                }
            });
        }
    });
};
grabPage();
