var hexLayer = "";

function addLegend() {

	var legend = L.control({position: 'bottomright'});

	legend.onAdd = function (map) {
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
				console.log('Got: ' + url + ': ' + xhr.statusText);
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

	var plotLayer = L.geoJson(geoJson, {
		pointToLayer: function(feature, latlon) {
			return L.circleMarker(latlon, {
				radius: 0.5,
				fillColor: '#000000',
				fillOpacity: 1,
				stroke: false
			});
		}
	});

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

	var hexLayer = L.geoJson(geoJson).eachLayer( function(l) {
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
	map.removeLayer(hexLayer);
	getHexLayer(url, metric, resolution);
}
