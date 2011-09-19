var scraper = require('../lib/scraper');
var zombie = require("zombie");
var url = require("url");
var path = require("path");
var cradle = require("cradle");

var base = require("../lib/models/base");
var card = require("../lib/models/card");

describe("Scraper Integration", function() {
    var s = null;
    var db = null;

    beforeEach(function() {
        var browser = new zombie.Browser({debug: true});
        browser.runScripts = false;

        var fetch_done = false;

        // initialize Base/CouchDB
        var connection = new cradle.Connection();
        db = connection.database("cardscience-test");
        var created = false;
        db.destroy(function() {
            db.create(function() {
                base.init(db);
                base.Base.updateAllDesignDocuments(function() {
                    created = true;
                });
            });
        });

        waitsFor(function() { return created; }, "Couldn't create CouchDB test database?", 10000);

        runs(function() {
            // initialize scraper: 
            s = new scraper.Scraper();

            var pages_to_fetch = [33, 38];

            var grabAndSubmitPages = function(done) {
                var current_page = pages_to_fetch.pop();
                var p = path.join(__dirname, "fixtures", current_page + ".html");

                browser.visit( url.format({protocol: "file", pathname: "//" + p}), function(err, _browser, status) {
                    expect(err).toBeNull();
                    z = _browser;

                    s.scrapePage(z.document, "classic", function(need_to_do_more) {
                        if(pages_to_fetch.length < 1) {
                            console.log("Done fetching and loading fixtures.");
                            done();
                        } else {
                            grabAndSubmitPages(done);
                        }
                    });
                });
            };
            
            grabAndSubmitPages(function() { fetch_done = true;} );
        });

        waitsFor(function() {
            return fetch_done;
        }, "Zombie never finished loading our fixtures...?", 100000);

        runs(function() {
            console.log("Fixture loaded, ready to continue!");
        });
    });

    afterEach(function() {
        // var destroyed = false;
        // db.destroy(function() {
        //     destroyed = true;
        // });
        // waitsFor(function() { return destroyed; }, "Unable to destroy CouchDB database?", 10000);
    });

    it("should have imported Boom // Bust correctly", function() {
        var bb = null;
        card.find("mtg_card_126218", function(c) {
            bb = c;
        });
        waitsFor(function() { return bb !== null; }, "Couldn't fetch Boom // Bust?!", 10000);
        runs(function() {
            expect(bb.mid).toEqual(126218);
            expect(bb.facets.base).toBeUndefined();
            expect(bb.facets.left).toBeDefined();
            expect(bb.facets.right).toBeDefined();
            expect(bb.facets.left.title).toEqual("Boom");
            expect(bb.facets.right.converted_mana_cost).toEqual(6);
            expect(bb.facets.right.title).toEqual("Bust");
        });
    });
});
