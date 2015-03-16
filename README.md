# bq2geojson
This is a collection of scripts and HTML which aims to make it relatively easy
for just about anyone to fetch M-Lab data from Google BigQuery and convert it
into a format (GeoJSON) that is easily usable by mapping software, Leaflet in
this particular case.

## Dependencies
Several [Node.js](https://nodejs.org/) modules are required to convert the CSV 
files from BigQuery into GeoJSON files usable by Leaflet:

* [csv2geojson](https://github.com/mapbox/csv2geojson)
* [Turf.js](http://turfjs.org/)

These should be automatically installed in the local directory when you run
"npm insall" later.

You will also need to have the [Google Cloud
SDK](https://cloud.google.com/sdk/) installed.  Most importantly, the SDK
contains the "bq" command, which is the tool used to query BigQuery.  There are
versions of the SDK for all major OSs, though it's rather expected that most
people will be using some variant of GNU/Linux or Mac OS.  Once installed, you
need to make sure that the "bq" command is in your path, else edit
bq2geojson.sh and put in an absolute path to the utility.

## Getting started
Assuming you already have Node.js and npm installed on your system, and both
the "node" and "npm" commands are in your PATH, then the following should get 
you started:

* $ git clone https://github.com/m-lab/bq2geojson.git
* cd bq2geojson
* npm install
* # Edit index.js, changing the "bbox" and "cellWidth" variables as appropriate
* # Edit the file bigquery as necessary
* $ ./bq2geojson.sh year ["month [month month ...]"]

The bq2geojson.sh script requires a year argument, and of course it must be a
year for which M-Lab data exists in BigQuery.  You can figure out which years
exist by inspecting the "m_lab" data set in the [BigQuery Web
interface](https://bigquery.cloud.google.com/project/measurement-lab).  You may
also pass a list of months in enclosed in double quotes, and with leading zeros
for months with only one number (e.g., "01 03 08 11").  If you don't pass a
month argument, then the script assumes you want all twelve months. 

bq2geojson.sh will create two directories: "csv" and "geojson".  The "csv"
directory will contain the CSV data from BigQuery and the "geojson" directory
will contain the GeoJSON files that csv2geojson and Turf.js have processed.

## Publishing on the Web
Edit index.html as necessary.  It should hopefully be fairly intuitive what
needs changing in that file, and there are helpful comments as well.  If you
then drop index.html, mlab.css, mlab.js and the geojson/ directory in the
webroot of your server, then you should have some nice maps displaying M-Lab
data hexbinned.

