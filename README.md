# bq2geojson
This repository consists of two parts:
* A Node.js application which aims to make it relatively easy for just about
  anyone to fetch M-Lab data from Google BigQuery and convert it into a format
  (GeoJSON) that is easily usable by mapping software.
* A prototype Web application which can ingest the GeoJSON files produced by the
  Node.js application.

## Dependencies
Several [Node.js](https://nodejs.org/) modules are required.

* [csv2geojson](https://github.com/mapbox/csv2geojson)
* [Turf.js](http://turfjs.org/)
* [async](https://www.npmjs.com/package/async)

These should be automatically installed in the local directory ./node_modules/
when you run "npm install" later.

You will also need to have the [Google Cloud SDK](https://cloud.google.com/sdk/)
installed.  Most importantly, the SDK contains the "bq" command, which is the
tool used to query BigQuery.  There are versions of the SDK for all major OSs.
Once installed, you need to make sure that the "bq" command is in your path.

## Getting started
Assuming you already have Node.js and npm installed on your system, and both
the "node" and "npm" commands are in your PATH, then the following should get 
you started:

* $ git clone https://github.com/m-lab/bq2geojson.git
* $ cd bq2geojson
* $ npm install
* # Edit index.js, changing configuration variables as necessary.
* $ cd bigquery
* $ cp bq_download-dist bq_download
* $ cp bq_upload-dist bq_upload
* # Edit bq_download and bq_upload as necessary
* $ cd ..
* $ node index.js year [month month month ...]

The script index.js requires a year argument, and of course it must be a year
for which M-Lab data exists in BigQuery.  You may also pass a series of months,
with leading zeros for months with only one number (e.g., 01 03 08 11).  If you
don't pass any month arguments, then the script assumes you want all twelve
months. 

By default index.js will create hex-binned GeoJSON files, however you can
configure it to use arbitrary polygon files (e.g., city/state districts).  The
polygon file(s) must be a flat GeoJSON FeatureCollection that Turf.js can
understand.  The first part of index.js, where user-set variable are configured,
has ample comments that hopefully obviate the need to add them here, requiring
the need to keep those comments in sync with these.

Using the default configuration, index.js will create three directories:
* ./bigquery/csv/ # Will contain CSV data from BigQuery
* ./html/geojson/ # Will contain processed GeoJSON used by front-end
* ./tmp/ # A dumping ground for intermediary files (for debugging)

## Publishing on the Web
Edit ./html/index.html as necessary.  It should hopefully be fairly intuitive
what needs changing in that file, and there are helpful comments as well. In
theory, you should be able to copy (or symlink to) the ./html/ directory to your
webroot and have working maps.
