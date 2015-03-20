/**
 * Copyright © 2015 Measurement Lab, Nathan Kinkade
 * 
 * This code is released into the public domain under a CC0 waiver.  You may
 * read more about this waiver on the Creative Commons website:
 * https://creativecommons.org/publicdomain/zero/1.0/
 */

var turf = require('turf');
var csv2geojson = require('csv2geojson').csv2geojson;
var fs = require('fs');
var async = require('async');
var exec = require('child_process').execSync;

// Options passed to the bq client.
// -n: defines arbitrarily high number of results to return that we should
// never surpass in practice, and just makes sure we get everything.
// --format csv: output format should be CSV.
// --quiet: don't output status messages, since they'd end up in the CSV.
// --headless: don't know what effect this has, but seems good since this may
// possibly be automated in some way.
var bq_opts='-n 1000000 --format csv --quiet --headless';

// Where the CSV files from BigQuery will be written. By defaul they will go in
// the bigquery/ directory since, well, it is BigQuery data.
var csv_dir = './bigquery/csv/';

// Where to write GeoJSON files. By default they will go in the html/ directory
// since they will be consumed by a browser.
var geojson_dir = './html/geojson/';

// Minimun tests per cell.  If the number of tests in a given hex cell is less
// than this, then remove data for the cell.  This should be used to make sure
// that very small sample sizes for given hex cell don't skew or distort the
// overall picture on the map with misleading results.
var min_test_cnt = 30;

// Create the bounding box for the grid.  This should be set according to the
// region you are expecting data for http://boundingbox.klokantech.com/
// Be careful setting cellWidth.  If you set it too small over too large an
// area, then it will take Turf.js a _long_ time to process the data. A
// suitable cellWidth at the country level could be around 0.5, state level
// around .1, and city level around 0.3
var bbox = [-132.5390604, 21.0770910032, -63.281248, 54.2381742779]; // USA
var cellWidth = 0.5;


//
// STOP
//
// All user defined variables are set above.  You probably shouldn't edit below
// this line unless you want to modify the overall behavior of the program.
//


// Validate the year passed, minimally.
if ( process.argv[2] ) {
	if ( process.argv[2].match('^[0-9]{4}$') ) {
		var year = process.argv[2];
	} else {
		console.log('The first argument does not appear to be a year.');
		process.exit(1);
	}
} else {
	console.log('The first argument must be a year.');
	process.exit(1);
}

// Validate the month arguments passed, else populate months[] with 01-12.
var months = [];
if ( process.argv[3] ) {
	process.argv.slice(3).forEach( function(month) {
		if ( month.match('[0-9]{2}') ) {
			months.push(month);
		} else {
			console.log('Month arguments must be two digits.');
			process.exit(1);
		}
	});
} else {
	for ( var i = 1; i <= 12; i++ ) { 
		var val = i > 9 ? i : '0' + i;
		months.push(val);
	}
}

// Make the necessary base directories for CSV and GeoJSON files.
try {
	fs.mkdirSync(csv_dir);
	fs.mkdirSync(geojson_dir);
} catch(err) {
	if ( err.code != 'EEXIST' ) {
		throw err;
	}
}
	
// Create the intial grid of hexagons within our bounding box.
var hexgrid = turf.hex(bbox, cellWidth, 'miles');

//  The year will never change for a given run, so loop through all the months
//  and use the year_month combination to determine which tables to query in
//  BigQuery, and also use it for the directory structure that gets created.
for ( var i = 0; i < months.length; i++ ) {

	// Some convenient variables to have on hand
	var sub_dir = year + '_' + months[i];
	var csv_path = csv_dir + sub_dir;

	// Make the 
	try {
		fs.mkdirSync(csv_path); 
	} catch(err) {
		if ( err.code != 'EEXIST' ) {
			throw err;
		}
	}

	// Calculate CSV file paths for convenience
	var down_path = csv_path + '/download.csv';
	var up_path = csv_path + '/upload.csv';

	// Read in query files and substitute the table placeholder with the actual
	// table named, based on the current month/year of the loop
	var down_query = fs.readFileSync('bigquery/bq_download', encoding='utf8')
		.replace('TABLENAME', sub_dir);
	var up_query = fs.readFileSync('bigquery/bq_upload', encoding='utf8')
		.replace('TABLENAME', sub_dir);

	// Get CSV from BigQuery
	var csv_down = get_csv(down_path, down_query);
	var csv_up = get_csv(up_path, up_query);

	// Convert CSV to GeoJSON and then process with Turf
	async.parallel({
		'download' : function(callback) {
			csv2geojson(csv_down, function(err, geojson) {
				console.log('Converting download throughput CSV data to GeoJSON.');
				callback(null, geojson);
			});
		},
		'upload' : function(callback) {
			csv2geojson(csv_up, function(err, geojson) {
				console.log('Converting upload throughput CSV data to GeoJSON.');
				callback(null, geojson);
			});
		}
	},
		function (err, results) {
			console.log('Turfizing download throughput data.');
			hexgrid = turfize(hexgrid, results.download, ['download_throughput', 'rtt_average']);
			console.log('Turfizing upload throughput data.');
			hexgrid = turfize(hexgrid, results.upload, ['upload_throughput']);
	});

	// Stringify GeoJSON and write it to the file system
	var hexgrid_serial = JSON.stringify(hexgrid);
	fs.writeFileSync(geojson_dir + sub_dir + '.geojson', hexgrid_serial);
	console.log('Wrote file ' + geojson_dir + sub_dir + '.geojson');

}


/*
 * Do the actual fetching of data from BigQuery
 */
function get_csv(path, query) {
	try {
		fs.statSync(path).isFile();
		console.log('CSV file ' + path + ' already exists. Skipping ...'); 
		return fs.readFileSync(path, encoding='utf8');
	} catch(err) {
		if ( ! err.code == 'ENOENT' ) {
			throw err;
		}
	}
	console.log('Querying BigQuery for ' + months[i] + '/' + year + '.');
	var result = exec('bq query ' + bq_opts + ' "' + query + '"', {'encoding' : 'utf8'});
	fs.writeFileSync(path, result);
	console.log('Wrote CSV file ' + down_path + '.');
	return result;
}


/*
 * Analyze the BigQuery data with Turf.js, adding various properties to the
 * GeoJSON
 */
function turfize(hexgrid, geojson, fields) {

	console.log('  * Counting points in each cell.');
	// Add a property for how many tests occur in each cell
	var turfgrid = turf.count(hexgrid, geojson, 'count');
		
	console.log('  * Normalizing GeoJSON data.');
	turfgrid = normalize_geojson(turfgrid, fields);

	fields.forEach( function (field) {
		console.log('  * Averaging ' + field + '.');
		turfgrid = turf.average(hexgrid, geojson, field, field + '_avg');
	});

	return turfgrid;

}


/*
 * Remove cells where the test count is less than a predefined minumum number.
 * While we're looping through the object, also take the opportunity to covert
 * any any values to a number so that Turf.js can perform math on it properly:
 * https://github.com/mapbox/csv2geojson/issues/31
 */
function normalize_geojson(geojson, fields) {
	for ( var i = 0; i < geojson.features.length; i++ ) {
		if ( geojson.features[i].properties['count'] < min_test_cnt ) {
			geojson.features.splice(i, 1);
		} else {
			fields.forEach( function (field) {
				if ( geojson.features[i].properties[field] ) {
					var numeric_val = Number(geojson.features[i].properties[field]);
					geojson.features[i].properties[field] = numeric_val;
				}
			});
		}
	};
	return geojson
}
