var zombie = require('zombie');
var url = require('url');

var log = require('./logging');
var csutil = require('./util');
var base = require('./models/base');
var card = require('./models/card');

var c = "Scraper";

exports.Scraper = function() {
    var browser = new zombie.Browser({debug: true});
    browser.runScripts = false;

    var verifyElements = function(element) {
        if(element === undefined) {
            throw new Error("Attempt to find an element failed!");
        }
        return element;
    }

    // corner-case cards:
    // http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=205399
    // http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=96966
    // http://gatherer.wizards.com/Pages/Search/Default.aspx?name=+[pain]+[suffering]

    // http://gatherer.wizards.com/Pages/Search/Default.aspx?page=0&output=standard&special=true&format=%5B%22Standard%22%5D

    // TODO the "format" part of the query (which is basically
    // "legality"), is significant.  we want to remember that in our
    // database.  however, whenever we update, we'll have to be
    // mindful that cards we no longer see in that query will have to
    // be removed from that format set.

    // TODO the <img> tags inside the card text fields should be
    // distilled into semantic tags of some sort.  not necessarily
    // HTML tags.

    this.scrapeCard = function(card_item) {
        // usages of innerHTML bother me.  Entities and such
        // are not processed, but don't seem to occur (often?)
        // in the magic card titles
        var card_info_elem = verifyElements(card_item.querySelector("div.cardInfo"));
        var set_versions_elem = verifyElements(card_item.querySelector("td.setVersions"));
        var set_hyperlink_elem = verifyElements(set_versions_elem.querySelector('div[id$="cardSetCurrent"] > a'));
        var mana_cost_elem = verifyElements(card_info_elem.querySelector("span.manaCost"));
        var mana_cost_img_elems = verifyElements(mana_cost_elem.querySelectorAll("img"));

        var converted_mana_cost = verifyElements(card_info_elem.querySelector("span.convertedManaCost")).innerHTML;

        var full_title = verifyElements(card_item.querySelector("span.cardTitle a")).innerHTML;

        var mid = url.parse(set_hyperlink_elem.href, true).query.multiverseid;
        var mana_costs = {};
        // TODO this isn't good enough.
        // these are the formats:

        // TODO detect multipart cards:  the title is formatted like:
        // SideA // SideB (SideA)

        // Detect it if there's `//` in the title, and set _id
        // to be $id_$side.  however, even though they'll show
        // up separately in the query results page, their
        // share a MultiverseID.  We'll leave mid as the
        // original, although that will mean that the mid
        // field will no longer be guaranteed unique.

        // The new "innistrad" set apparently has a concept of
        // a double-sided card (seems silly to me, but there
        // it is).  We'll see how those appear on gatherer,
        // but my approach for dealing with composite cards
        // should apply to that as well.

        // in order to deal with these different types of
        // cards, it might be reasonable to have subcards
        // instead of separate cards.  this better reflects
        // the construction of the card, and returns
        // MultiverseID to its role of primary key.  these
        // subtypes could be called `facets`. For regular
        // cards, there would be one called `base`.  For
        // `//`-style dual cards, there would be two facets
        // named for the two subcards (alas, this involves a
        // bit of redundancy with the title, but alas there is
        // no other way to repeatably identify the facets.

        // It might be appropriate to add another field to
        // identify the nature of the compositing, and thus
        // the format of the keys used in as keys in the
        // facets hash.  There are the `//` split cards, the
        // Innistrad dual cards, and presumably other things.

        // how will updating work?  I do want to update the
        // documents in the DB, and not destroy them and
        // recreate them as I do now.  However, for the above
        // composite cards, I can't just naiively squish the
        // contents, because I will be updating in several
        // steps as I iterate over the HTML and encounter the
        // separate cardItems for each facet (since it's
        // Gatherer's approach to make seperate search result
        // items, even though they do still have the same MID)
        // this is awkward for deleting, because I don't want
        // to accrue removed old crufty data elements in the
        // card documents.  I could do it heuristically, where
        // I only delete things I know I can.  Gross and kind
        // of brittle, though.  Better would be to have the
        // scrape job keep track of what cards it's seen, and
        // then actually replace any old contents with the
        // aggregated new contents.

        // right now all of the faceted cards that exist
        // appear to use separate entries, so we can have
        // pretty global modality as we deal with this entry.
        // in the future, though, some of them won't.

        // TODO ideally, we should only be saving the cards once,
        // even for the multi-faceted ones.  we should actually
        // keep the updated card model instances in memory while
        // we complete the scrape job, and *then* batch save them
        // afterwards.  right now we're saving them each time they
        // get a facet update.

        var facet = "base";
        var title = undefined;
        
        if(full_title.match(/\/\//)) {
            // I am a split card.  My title is in the form of:
            //   Facet1 // Facet2 (CurrentFacet).

            // I define these cards as having two facets, left
            // and right.  if you set such a card landscape,
            // the left and right facets are the left and
            // right hand sides of the card, respectively.

            // (.*)\/\/(.*)\((.*)\)
            var parms = full_title.match(/(.*)\/\/(.*)\((.*)\)/);
            var left = parms[1].strip();
            var right = parms[2].strip();
            var selected = parms[3].strip();

            if(selected === left) {
                facet = "left";
                title = left;
            } else if(selected === right) {
                facet = "right";
                title = right;
            } else {
                throw new Error("Malformed split-card had a bogus facet selector: " + title);
            }
            log.debug(c, "Neat.  We have a split-facet card here.  Current facet: " + facet);
        } else {
            // I am a regular card, so facet stays as `base`
            title = full_title;
        }

        // * integer number, say, 1, 2, 8.  Also, for the
        //   benefit of another kind, assume English-text
        //   versions, such as One, Two, and so on) These are
        //   colorless.
        // * a name, say, Red, Blue, etc.
        // * either of the above appended with "or". These are 
        mana_cost_img_elems.update().forEach(function(mana_img) {
            if(isNaN(mana_img.alt)) {
                // it's a mana colour
                var color_name = mana_img.alt.toLowerCase();
                mana_costs[color_name] = mana_costs[color_name] || 0;
                mana_costs[color_name]++;
            } else {
                // it's colorless
                mana_costs["colourless"] = mana_costs["colourless"] || 0;
                Number(mana_img.alt).times(function() {
                    mana_costs["colourless"]++;
                });
            }
        });
        // TODO assert that length of mana_cost_list matches
        // converted_mana_cost
        
        var card_contents = {
            facets: {},
            mid: mid
        };

        card_contents["facets"][facet] = {
            title: title,
            mana_cost: mana_costs,
            converted_mana_cost: converted_mana_cost
        };
        return card_contents;
    };

    var found_cards = [];
    
    this.scrapePage = function(document, done) {
        var card_item_table = verifyElements(document.querySelector(".cardItemTable"));
        var card_items = verifyElements(card_item_table.querySelectorAll("tr.cardItem"));

        // TODO dang, with forEach() we can't process the items in
        // sequence, yet still wait on asynchronous things.  this
        // is useful mostly so we can handle errors.  with
        // eachWait(), we can do just that.  however, it means
        // that we really are processing things synchronously and
        // end up spending a lot of time waiting for each CouchDB
        // insert to complete (admittedly, I'm not sure how well
        // CouchDB parallelizes creation on a single instance on a
        // machine).  we could do even better if we ran all the
        // jobs simultaneously, but only returned once all of them
        // had completed.
        card_items.update().eachWait(function(card_item, each_done, each_error) {
            var card_contents = this.scrapeCard(card_item);
            var key = "mtg_card_" + card_contents.mid;

            log.debug(c, "Processing card: " + card_contents.mid);

            var current_card = found_cards[key];

            // We want to either load the existing instance and
            // clear it and reload it, or create a new one.
            // However, if we have already seen this MID during
            // this particular load sequence, we want to augment
            // the record we've already started making, and not
            // clear it again.
            if(current_card === undefined) {
                log.debug(c, "We haven't seen this card yet!")
                // we haven't seen this card already
                card.find(key, function(found_card) {
                    if(found_card !== undefined) {
                        // but it *does* already exist in the DB.
                        log.debug(c, "... but it does exist in the DB. Loading, but clearing.");
                        current_card = found_card;
                        // we don't want the old values to stick around, though.
                        found_card.clear();
                    } else {
                        // it doesn't even exist in the DB, we'll have to start fresh
                        log.debug(c, "... it doesn't even exist in the DB, making a fresh one.");
                        current_card = card.newInstance({_id: key});
                    }
                    current_card.update(card_contents);
                    // TODO save it!
//                    console.log(current_card);
                    current_card.save(function() {
                        // success!
                        log.debug(c, "Successfully saved card.");
                        found_cards[key] = current_card;
                        each_done();
                    }, function() {
                        log.error(c, "Problem saving card: " + card_contents.mid);
                        each_error();
                    });
                }, function() {
                    // fuck.
                    each_error();
                });
            }
        }.bind(this), function() {
            // done all
            var page_links = verifyElements(document.querySelector('div.pagingControls'));
            
            var second_last = page_links.childNodes[page_links.childNodes.length - 1];

            if(second_last.tagName === "A") {
                log.info(c, "We need to do another page!");
                done(true);
            } else {
                log.info(c, "Finished last page!");
                done(false);
            }
        }.bind(this), function() {
            throw new Error("Problem dealing with a card item.");
        });
    };
    
    // success will be given a boolean, whether or not there are more
    // pages in this query to do
    this.fetchAndScrapePage = function(page_no, success, failure) {
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
        
        log.debug(c, "Scraping page #" + page_no);
        browser.visit(url.format(fetchurl), function(err, browser, status) {
            if(err) {
                log.error(c, "Shit, couldn't fetch page from Gatherer.");
                // TODO if it failed, try again at least a few times
                // before emitting error
                throw(err.message);
            }
            this.scrapePage(browser.document, function(need_to_do_more) {
                success(need_to_do_more);
            });
        }.bind(this));
    };

    this.fullScrape = function(done) {
        var count = 0;

        var scrapeRecurse = function() {
            this.fetchAndScrapePage(count, function(need_to_do_more) {
                if(need_to_do_more) {
                    count ++;
                    scrapeRecurse(count);
                } else {
                    log.info(c, "Finished scraping!");
                    if(done !== undefined) {
                        done();
                    }
                    return;
                }
                
            }, function() {
                throw new Error("WTF!");
            });

        }.bind(this);

        scrapeRecurse(true);
    };
};
