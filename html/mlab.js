// Global variables
var hexLayer,
	plotLayer;

function addLegend() {

	var legend = L.control({position: 'bottomright'});

	legend.onAdd = function(map) {
	    var div = L.DomUtil.create('div', 'info legend'),
	        grades = [0, 5, 10, 25, 50];

	    for ( var i = 0; i < grades.length; i++ ) {
	        div.innerHTML +=
	            '<i style="background:' + getHexColor(grades[i] + 1) + '"></i> ' +
				(i == 0 ? '0' : grades[i])  + (grades[i + 1] ? '&ndash;' + grades[i + 1] + ' mb/s<br>' : '+ mb/s');
	    }
	    return div;
	};
	legend.addTo(map);

}

function addControls(dates) {

	var controls = L.control({position: 'bottomleft'});

	controls.onAdd = function(map) {
		var controls = L.DomUtil.create('div', 'info controls');
		var selectDate = L.DomUtil.create('select', 'mapControls', controls);
		var selectMetric = L.DomUtil.create('select', 'mapControls', controls);
		var selectRes = L.DomUtil.create('select', 'mapControls', controls);
		var checkHex = L.DomUtil.create('div', 'mapControls', controls);
		var checkPlot = L.DomUtil.create('div', 'mapControls', controls);

		var date_options = '';
		for ( year in dates ) {
			for ( i = 0; i < dates[year].length; i++ ) {
				date_options += '<option value="geojson/' + year + '_' + dates[year][i] + '-PLACEHOLDER.geojson">' + dates[year][i] + '/' + year + '</option>';
			}
		}

		selectDate.innerHTML = date_options;
		selectDate.setAttribute('id', 'selectDate');

		selectMetric.innerHTML = '<option value="download_avg">DL throughput</option><option value="upload_avg">UL throughput</option>';
		selectMetric.setAttribute('id', 'selectMetric');

		selectRes.innerHTML = '<option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>';
		selectRes.setAttribute('id', 'selectRes');

		[selectDate, selectMetric, selectRes, checkHex].forEach( function(element) {
			element.addEventListener('change', function() {
				updateHexLayer(
					document.getElementById('selectDate').value,
					document.getElementById('selectMetric').value,
					document.getElementById('selectRes').value
				);
			}, false);
		});

		checkHex.innerHTML = '<input id="checkHex" type="checkbox" checked="checked"> Show hex layer';

		checkPlot.innerHTML = '<input id="checkPlot" type="checkbox"> Show scatter plot';
		checkPlot.addEventListener('change', function() {
			updatePlotLayer(document.getElementById('selectDate').value);
		});

		return controls;
	};
	controls.addTo(map);
}

function getHexColor(val) {
    return val > 50 ? 'blue' :
           val > 25  ? 'green' :
           val > 10  ? 'purple' :
           val > 5  ? 'yellow' :
           val > 0   ? 'red' : 'transparent';
}

function setHexLayer(urlBase, metric, resolution) {

	// Replace resolution placeholder in URL, if necessary.
	var hex_url = urlBase.replace('PLACEHOLDER', resolution);

	document.getElementById('spinner').style.display = 'block';

	getLayerData(hex_url, function(response) {
		showHexLayer(response, metric);
	});

}

function setPlotLayer(urlBase) {

	if ( ! document.getElementById('checkPlot').checked ) {
		return false;
	}

	var plot_url = urlBase.replace('PLACEHOLDER', 'plot');

	document.getElementById('spinner').style.display = 'block';

	getLayerData(plot_url, function(response) {
		showPlotLayer(response);
	});

}

function getLayerData(url, callback) {

	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function () {
		if ( xhr.readyState === 4 ) {
			if ( xhr.status === 200 ) {
				callback(JSON.parse(xhr.responseText));
				console.log(url + ': ' + xhr.statusText);
			} else {
				console.log(url + ': ' + xhr.statusText);
			}
		}
	}
	xhr.open('GET', url);
	xhr.send();

}


// Display a scatter plot of all data points.
function showPlotLayer(geoJson) {

	plotLayer = L.geoJson(geoJson, {
		pointToLayer: function(feature, latlon) {
			return L.circleMarker(latlon, {
				radius: 0.5,
				fillColor: '#000000',
				fillOpacity: 1,
				stroke: false
			});
		}
	});

	document.getElementById('spinner').style.display = 'none';

	map.addLayer(plotLayer);

}


function showHexLayer(geoJson, metric) {

	geoJson.features.forEach( function(cell) {

		var value = cell.properties[metric];
		var hexStyle = cell.hexStyle = {};

		hexStyle.weight = 1;
		hexStyle.fillOpacity = 0.3;

		if ( ! value ) {
			hexStyle.weight = 0;
			hexStyle.fillOpacity = 0;
		} else {
			hexStyle.color = getHexColor(value);
		}

	});

	hexLayer = L.geoJson(geoJson).eachLayer( function(l) {
		l.bindPopup(make_popup(l.feature.properties));
		l.setStyle(l.feature['hexStyle']);
	});

	document.getElementById('spinner').style.display = 'none';

	map.addLayer(hexLayer);

}


function make_popup(props) {

	var popup = 'DL throughput: ' + Math.round(props.download_avg * 10) / 10 + '<br/>';
	popup += 'DL data points: ' + Math.round(props.download_count * 10) / 10 + '<br/>';
	popup += 'UL throughput: ' + Math.round(props.upload_avg * 10) / 10 + '<br/>';
	popup += 'UL data points: ' + Math.round(props.upload_count * 10) / 10 + '<br/>';
	popup += 'Average RTT: ' + Math.round(props.rtt_avg);

	return popup;

}


function updateHexLayer(url, metric, resolution) {

	// Don't try to remove a layer that doesn't yet exist
	if ( typeof hexLayer != 'undefined' ) {
		map.removeLayer(hexLayer);
	}

	// If the checkbox for this layer isn't checked, then just remove the layer
	// and return
	if ( document.getElementById('checkHex').checked === false ) {
		return;
	}

	setHexLayer(url, metric, resolution);
}


function updatePlotLayer(url) {

	// Don't try to remove a layer that doesn't yet exist
	if ( typeof plotLayer != 'undefined' ) {
		map.removeLayer(plotLayer);
	}

	// If the checkbox for this layer isn't checked, then just remove the layer
	// and return
	if ( document.getElementById('checkPlot').checked === false ) {
		return;
	}

	setPlotLayer(url);

}

