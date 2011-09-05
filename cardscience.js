#!/usr/bin/env node
var util = require("util");

var cradle = require("cradle");

var zombie = require("zombie");

var url = require('url');

var Scraper = function() {
    var browser = new zombie.Browser({debug: true});
    browser.runScripts = false;

    // http://gatherer.wizards.com/Pages/Search/Default.aspx?page=0&output=standard&special=true&format=%5B%22Standard%22%5D
    this.scrapePage = function(page_no, success, failure) {
        fetchurl = { protocol: "http",
                host: "gatherer.wizards.com",
                pathname: "/Pages/Search/Default.aspx",
                query: {
                    page: page_no,
                    output: "standard",
                    special: "true", // what's this for?
                    format: '["Standard"]'
                }
              };

        browser.visit(url.format(fetchurl), function(err, browser, status) {
            if(err) {
                console.log("Shit, couldn't fetch page from Gatherer.");
                // TODO if it failed, try again at least a few times before emitting error
                throw(err.message);
            }

            var verifyElements = function(element) {
                if(element === undefined) {
                    throw new Error("Attempt to find an element failed!");
                }
                return element;
            }

            var card_item_table = verifyElements(browser.document.querySelector(".cardItemTable"));
            var card_items = verifyElements(card_item_table.querySelectorAll("tr.cardItem"));
            card_items.update().forEach(function(card_item) {
                var title = card_item.querySelector("span.cardTitle a").innerHTML;
                var set_versions = verifyElements(card_item.querySelector("td.setVersions"));
                var set_hyperlink_element = verifyElements(set_versions.querySelector('div[id$="cardSetCurrent"] > a'));
                var set_hyperlink = url.parse(set_hyperlink_element.href, true);
                var mid = set_hyperlink.query.multiverseid;
                console.log(mid + ": " + title);
            });

            var page_links = browser.document.querySelector('div.pagingControls')

            var second_last = page_links.childNodes[page_links.childNodes.length - 1];

            if(second_last.tagName === "A") {
                console.log("More to do!");
                this.scrapePage(page_no + 1, success, failure);
            } else {
                console.log("On last page!");
                success();
            }
        }.bind(this));
    };

    this.scrapePage(0);
};

var CardScience = function() {
    console.log("Welcome to CardScience.");
    var connection = new cradle.Connection();
    var db = connection.database("cardscience");

    var initialize = function() {
        var scraper = new Scraper();
    };

    db.exists(function(err, exists) {
        if(err) {
            console.log('error', "Yikes, problem connecting to CouchDB: " + err);
        } else if(exists) {
            console.log("Database is ready.");
            initialize();
        } else {
            console.log("Database does not yet exist, creating it.");
            db.create();
            initialize();
        }
    });
};

new CardScience(function() {
    // success
    console.log("Success!");
}, function() {
    // failure
    console.log("Problems fetching the pages, giving up.");
});
