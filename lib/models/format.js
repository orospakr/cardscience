var base = require("./base");

exports.config = {
    name: "format",
    views: {
        cards: {
            map: function(doc) {
                if(doc.type === "card" && doc.formats !== undefined) {
                    doc.formats.forEach(function(format_id) {
                        // TODO change to use include_docs
                        emit(format_id, doc);
                    });
                    
                }
            }
        },
        by_name: {
            map: function(doc) {
                if(doc.type === "format") {
                    emit(doc.name, doc);
                }
            }
        }
    },
};

base.register(exports);
