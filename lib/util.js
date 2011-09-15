Number.prototype.times = function(cb) {
    for(var c = 0; c < this.valueOf(); c++) {
        cb(c);
    }
};

// erm, this implementation noms a stack frame for every iteration
Array.prototype.eachWait = function(callback, done, error) {
    var position = -1;
    
    var cbdone = function() {
        position += 1;
        if(position == this.length - 1) {
            done();
        } else {
            callback(this[position], cbdone, error);
        }
    }.bind(this);
    cbdone();
};

exports.pluralize = function(str) {
    var lastchar = str[str.length - 1];
    if(lastchar === 'y') {
	    return str.substring(0, str.length - 1) + "ies";
    } else if(lastchar === 'h') {
	    return str + "es";
    } else {
	    return str + "s";
    }
};

// http://stackoverflow.com/questions/1418050/string-strip-for-javascript
String.prototype.strip = function() {
    return String(this).replace(/^\s+|\s+$/g, '');
};

/**
 * Transform text into a URL slug: spaces turned into dashes, remove
 * non alnum
 *
 * @param string text
 *
 * http://milesj.me/snippets/javascript/slugify
 */
exports.slugify = function(text) {
	text = text.replace(/[^-a-zA-Z0-9,&\s]+/ig, '');
	text = text.replace(/-/gi, "_");
	text = text.replace(/\s/gi, "-");
    text = text.toLowerCase();
	return text;
}
