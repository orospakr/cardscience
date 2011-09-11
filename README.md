CardScience
===========

Magic the Gathering card database. Scrapes card data from Gatherer and
store sit in CouchDB. It will gain a REST interface and possibly a
deck builder/browser web interface in the near future.

This has been a fun little project to try out some of the CouchDB
abstraction logic in, to see just how effective I can be with Node and
CouchDB for writing distributed data systems.  Also, I get to try out
Zombie.js.

There is more to come!

Usage
-----

You'll need node and npm.

Install dependencies:

    npm install

Install CouchDB design documents:

    ./cardscience.js -i

Run scrape job:

    ./cardscience.js

Bring up interactive REPL with CardScience data model available:

    ./cardscience.js -c
