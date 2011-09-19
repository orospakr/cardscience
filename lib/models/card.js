var base = require("./base");

exports.config = {
    name: "card",
    views: {
        // actually emits rows for each facet.
        by_title: {
            map: function(doc) {
                // TODO use include_docs instead...
                for(var property in doc.facets) {
                    if(doc.facets.hasOwnProperty(property)) {
                        emit(doc.facets[property].title, doc);
                    }
                }
            }
        }
    }
};

base.register(exports);
