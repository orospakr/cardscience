var scraper = require('../lib/scraper');
var jsdom = require("jsdom");

describe("Scraper", function() {
    it("should instantiate", function() {
        var s = new scraper.Scraper();

        var x = jsdom.env("<p>butts</p>", [], function(errors, window) {
            console.log(window.document);
        });
        // s.scrapePage();
        
    });
});
