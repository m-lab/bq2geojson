# bq2geojson
This is small Node.js application which aims to make it relatively easy for
just about anyone to fetch M-Lab data from Google BigQuery and convert it into
a format (GeoJSON) that is easily usable by mapping software, Leaflet in this
particular case.

## Dependencies
Several [Node.js](https://nodejs.org/) modules are required.

* [csv2geojson](https://github.com/mapbox/csv2geojson)
* [Turf.js](http://turfjs.org/)
* [async](https://www.npmjs.com/package/async)

These should be automatically installed in the local directory ./node_modules/
when you run "npm insall" later.

You will also need to have the [Google Cloud
SDK](https://cloud.google.com/sdk/) installed.  Most importantly, the SDK
contains the "bq" command, which is the tool used to query BigQuery.  There are
versions of the SDK for all major OSs.  Once installed, you need to make sure
that the "bq" command is in your path.

## Getting started
Assuming you already have Node.js and npm installed on your system, and both
the "node" and "npm" commands are in your PATH, then the following should get 
you started:

* $ git clone https://github.com/m-lab/bq2geojson.git
* cd bq2geojson
* npm install
* # Edit index.js, changing configuration variables as necessary.
* $ cd bigquery
* $ cp bq_download-dist bq_download
* $ cp bq_upload-dist bq_upload
* # Edit bq_download and bq_upload as necessary
* $ node index.js year [month month month ...]

The script index.js requires a year argument, and of course it must be a year
for which M-Lab data exists in BigQuery.  You can figure out which years
exist by inspecting the "m_lab" data set in the [BigQuery Web
interface](https://bigquery.cloud.google.com/project/measurement-lab).  You may
also pass a series of months, and with leading zeros for months with only one
number (e.g., 01 03 08 11).  If you don't pass a month argument, then the
script assumes you want all twelve months. 

index.js will create three directories: ./bigquery/csv/, ./html/geojson/,
and ./tmp/. The csv/ directory will contain the CSV data from BigQuery, the
the geojson/ directory will contain the GeoJSON files processed by Turf.js,
and the tmp/ directory will contain various intermediate files based on the
various steps between CSV and GeoJSON.  Files in the tmp/ directory may be
useful for debugging and may perhaps be used at some point to avoid rerunning
the same lengthy operations on some data if the overall process gets interrupted
for some reason before the final GeoJSON file is written.  Some of the Turf.js
operations can take quite a long time to complete, especially if your bounding
box is large and your cellWidth is small.

## Publishing on the Web
Edit ./html/index.html as necessary.  It should hopefully be fairly intuitive what
needs changing in that file, and there are helpful comments as well. In theory,
you should be able to copy (or symlink to) the ./html/ directory to your
webroot and having working maps, assuming you properly edit the
'defaultDataUrl' variable appropriately in index.html.

