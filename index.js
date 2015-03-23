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
//
// --format csv: output format should be CSV.
//
// --quiet: don't output status messages, since they'd end up in the CSV.
//
// --headless: don't know what effect this has, but seems good since this may
// possibly be automated in some way.
var bq_opts='-n 1000000 --format csv --quiet --headless';

// 'csv': Where the CSV files from BigQuery will be written. By defaul they
// will go in the bigquery/ directory since, well, it is BigQuery data.
//
// 'geojson': Where to write GeoJSON files. By default they will go in the
// ./html/ directory since they will be consumed by a browser.
//
// 'tmp': Temporary directory where intermediate files are stored.  In case
// something fails, these won't have to be generated again, potentially.  And
// maybe useful for debugging.
var dirs = {
	csv : './bigquery/csv/',
	geojson : './html/geojson/',
	tmp : './tmp/'
}

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

// When running aggregate functions on the data, these are the various
// properties that should be added to the GeoJSON for the download and upload
// throughput tests, respectively. 'count', as the name implies, will host the
// value of how many data points per hex cell there are for that test.
// 'averages' is an array that holds the fields that need to be averaged.
var properties = {
	download : {
		count : 'download_count',
		averages : ['download_throughput', 'rtt_average']
	},
	upload : {
		count : 'upload_count',
		averages : ['upload_throughput']
	}
}

// This defines the aggregate calculations that need to happen on each data
// set: http://turfjs.org/examples/turf-aggregate/
aggregations = {
	download : [
		{
			aggregation : 'count',
			inField : 'download_throughput',
			outField : 'download_count'
		},
		{
			aggregation : 'average',
			inField : 'download_throughput',
			outField : 'download_avg'
		},
		{
			aggregation : 'average',
			inField : 'rtt_average',
			outField : 'rtt_avg'
		}
	],
	upload : [
		{
			aggregation : 'count',
			inField : 'upload_throughput',
			outField : 'upload_count'
		},
		{
			aggregation : 'average',
			inField : 'upload_throughput',
			outField : 'upload_avg'
		}
	]
}


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
		if ( month.match('^[0-9]{2}$') ) {
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

// Make the necessary base directories.
for (var dir in dirs) {
	create_dir(dirs[dir]);
}

// Create the intial grid of hexagons within our bounding box.  This variable
// will get passed around quite a few time as it steps through the process of
// creating the final GeoJSON file.
var hexgrid = turf.hex(bbox, cellWidth, 'miles');

//  The year will never change for a given run, so loop through all the months
//  and use the year_month combination to determine which tables to query in
//  BigQuery, and also use it for the directory structure that gets created.
for ( var i = 0; i < months.length; i++ ) {

	// Some convenient variables to have on hand
	var sub_dir = year + '_' + months[i];
	var csv_path = dirs.csv + sub_dir;

	create_dir(csv_path);

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
	console.log('* Querying BigQuery for download throughput data for ' + months[i] + '/' + year + '.');
	var csv_down = get_csv(down_path, down_query);
	console.log('* Querying BigQuery for upload throughput data for ' + months[i] + '/' + year + '.');
	var csv_up = get_csv(up_path, up_query);

	// Convert CSV to GeoJSON and then process with Turf
	async.parallel({
		download : function(callback) {
			console.log('* Converting download throughput CSV data to GeoJSON.');
			csv2geojson(csv_down, function(err, geojson) {
				callback(null, geojson);
			});
		},
		upload : function(callback) {
			console.log('* Converting upload throughput CSV data to GeoJSON.');
			csv2geojson(csv_up, function(err, geojson) {
				callback(null, geojson);
			});
		}
	}, function (err, results) {
		fs.writeFileSync(dirs.tmp + sub_dir + '-download.geojson', JSON.stringify(results.download));
		fs.writeFileSync(dirs.tmp + sub_dir + '-upload.geojson', JSON.stringify(results.upload));
		console.log('* Aggregating download throughput data.');
		aggregate(results.download, properties.download, aggregations.download);
		fs.writeFileSync(dirs.tmp + sub_dir + '-download-aggregate.geojson', JSON.stringify(hexgrid));
		console.log('* Aggregating upload throughput data.');
		aggregate(results.upload, properties.upload, aggregations.upload);
		fs.writeFileSync(dirs.tmp + sub_dir + '-final-aggregate.geojson', JSON.stringify(hexgrid));
	});

	// Stringify GeoJSON and write it to the file system
	var hexgrid_serial = JSON.stringify(hexgrid);
	fs.writeFileSync(dirs.geojson + sub_dir + '.geojson', hexgrid_serial);
	console.log('* Wrote file ' + dirs.geojson + sub_dir + '.geojson');

}


/*
 * Do the actual fetching of data from BigQuery
 */
function get_csv(path, query) {

	try {
		fs.statSync(path).isFile();
		console.log('* CSV file ' + path + ' already exists. Skipping ...'); 
		return fs.readFileSync(path, encoding='utf8');
	} catch(err) {
		if ( ! err.code == 'ENOENT' ) {
			throw err;
		} }
	var start = new Date();
	var result = exec('bq query ' + bq_opts + ' "' + query + '"', {'encoding' : 'utf8'});
	elapsed(start);
	fs.writeFileSync(path, result);
	console.log('* Wrote CSV file ' + path + '.');
	return result;

}


/*
 * Aggregate the various properties of the GeoJSON. hexgrid is a global
 * variable in this script so this function modified that object but doesn't
 * return anything.
 */
function aggregate(json, fields, aggs) {

	json = make_numeric(json, fields.averages);
	fs.writeFileSync(dirs.tmp + sub_dir + '-numeric.geojson', JSON.stringify(json));

	var start = new Date();
	var json = turf.aggregate(hexgrid, json, aggs);
	elapsed(start);

	hexgrid = normalize(json, fields.count);
		
}


/*
 * While we're looping through the object, also take the opportunity to covert
 * any any values to a number so that Turf.js can perform math on it properly:
 * https://github.com/mapbox/csv2geojson/issues/31
 */
function make_numeric(json, fields) {
	
	for ( var i = 0; i < json.features.length; i++ ) { 
		for ( var field in fields ) {
			var numeric_val = Number(json.features[i].properties[fields[field]]);
			json.features[i].properties[fields[field]] = numeric_val;
		}
	}
	return json;
}


/*
 * Remove cells where the test count is less than a predefined minumum number.
 */
function normalize(json, field) {

	for ( var i = json.features.length -1; i >=0; i-- ) {
		if ( json.features[i].properties[field] < min_test_cnt ) {
			json.features.splice(i, 1);
		}
	};

	return json;

}


/*
 * Simple function to return elapsed time in hours, minutes, seconds.
 */
function elapsed(start) {

	var end = new Date();
	var elapsed = (end.getTime() - start.getTime()) / 1000;
	var hours = Math.floor(elapsed / 3600) + 'h ';
	var minutes = Math.floor((elapsed % 3600) / 60) + 'm ';
	var seconds = Math.floor((elapsed % 3600) % 60) + 's';
	console.log('  ... operation completed in ' + hours + minutes + seconds); 

}

/*
 * Create a directory
 */
function create_dir(dir) {

	try {
		fs.mkdirSync(dir);
	} catch(err) {
		if ( err.code != 'EEXIST' ) {
			throw err;
		}
	}

}
