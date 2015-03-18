var turf = require('turf');
var csv2geojson = require('csv2geojson');
var fs = require('fs');

// Where the CSV files from BigQuery will be written.
var indir = "./csv/";

// Where to write GeoJSON files.
var outdir = "./geojson/";

var min_test_cnt = 30;

// Create the bounding box for the grid.  This should be set according to the
// region you are expecting data for http://boundingbox.klokantech.com/
// Be careful setting cellWidth.  If you set it too small over too large an
// area, then it will take Turf.js a _long_ time to process the data. A
// suitable cellWidth at the country level could be around 0.5, state level
// around .1, and city level around 0.3

// USA
var bbox = [-132.5390604, 21.0770910032, -63.281248, 54.2381742779];
var cellWidth = 0.5;

// Create the intial grid of hexagons within our bounding box.
var hexgrid = turf.hex(bbox, cellWidth, 'miles');

csv_files = fs.readdirSync(indir);

for ( i = 0; i < csv_files.length; i++ ) {
	var fname = csv_files[i].split('.')[0];
	console.log('Loading file ' + indir + csv_files[i]);
	var csv_data = fs.readFileSync('./csv/' + csv_files[i], encoding="utf8");
	csv2geojson.csv2geojson(csv_data, function(err, geoJson) {
		if (err) {
			console.log(err);
			throw err;
		}
		// Add a property for how many tests occur in each cell
		var turfgrid = turf.count(hexgrid, geoJson, 'test_cnt');

		// Remove cells ("features") where the test count is less than a
		// predefined minumum number.
		// While we're looping through the object, also take the opportunity to
		// covert download_throughput to a number so that Turf.js can perform
		// math on it properly: https://github.com/mapbox/csv2geojson/issues/31
		for ( idx = 0; idx < geoJson.features.length; idx++ ) {
			if ( geoJson.features[idx].properties['test_cnt'] < min_test_cnt ) {
				geoJson.features.splice(idx, 1);
			} else {
				var throughput = Number(geoJson.features[idx].properties['download_throughput']);
				geoJson.features[idx].properties['download_throughput'] = throughput;
			}
		};

		// Add a property for the average download through put in each cell
		var turfgrid = turf.average(hexgrid, geoJson, 'download_throughput', 'download_avg');

		// Serialize the GeoJSON so we can write it to a file.
		var turfgrid_serial = JSON.stringify(turfgrid);
		fs.writeFileSync(outdir + fname + '.geojson', turfgrid_serial);
		console.log('Wrote file ' + outdir + fname + '.geojson');
	});
}
