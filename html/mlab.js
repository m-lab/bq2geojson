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
		var selectYear = L.DomUtil.create('select', 'mapControls', controls);
		var selectMetric = L.DomUtil.create('select', 'mapControls', controls);
		var selectRes = L.DomUtil.create('select', 'mapControls', controls);
		var sliderMonth = L.DomUtil.create('div', 'mapControls', controls);
		var checkAnimate = L.DomUtil.create('div', 'mapControls', controls);

		var date_options = '';
		for ( year in dates ) {
			date_options += '<option value="' + year + '">' + year + '</option>';
		}

		checkAnimate.innerHTML = '<input id="checkAnimate" type="checkbox" />Animate map';
		
		sliderMonth.setAttribute('id', 'sliderMonth');
		// Prevent the entire map from dragging when the slider is dragged.
		L.DomEvent.disableClickPropagation(sliderMonth);

		selectYear.innerHTML = date_options;
		selectYear.setAttribute('id', 'selectYear');

		selectMetric.innerHTML = '<option value="download_avg">DL throughput</option><option value="upload_avg">UL throughput</option>';
		selectMetric.setAttribute('id', 'selectMetric');

		selectRes.innerHTML = '<option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>';
		selectRes.setAttribute('id', 'selectRes');

		[selectYear, selectMetric, selectRes].forEach( function(element) {
			element.addEventListener('change', function() {
				setHexLayer(
					document.getElementById('selectYear').value,
					$('#sliderMonth').slider('value') < 10 ? '0' + $('#sliderMonth').slider('value') : $('#sliderMonth').slider('value'),
					document.getElementById('selectMetric').value,
					document.getElementById('selectRes').value,
					'update'
				);
				setPlotLayer(
					document.getElementById('selectYear').value,
					$('#sliderMonth').slider('value') < 10 ? '0' + $('#sliderMonth').slider('value') : $('#sliderMonth').slider('value'),
					'update'
				);
			}, false);
		});

		return controls;
	};

	controls.addTo(map);

	var clearId;
	document.getElementById('checkAnimate').addEventListener('change', function() {
		if ( document.getElementById('checkAnimate').checked == true ) {
			var i = $('#sliderMonth').slider('value');
			clearId = setInterval( function() {
				$('#sliderMonth').slider('value', i + 1);
				i = (i + 1) % dates[year].length;
			}, 2000);
		} else {
			clearInterval(clearId);
		}
	});

	// Can't instantiate the slider until after "controls" is actually added to
	// the map.
	$('#sliderMonth').slider({
		min: 1,
		max: 12,
		change: function(event, ui) {
			setHexLayer(
				document.getElementById('selectYear').value,
				ui.value < 10 ? '0' + ui.value : ui.value,
				document.getElementById('selectMetric').value,
				document.getElementById('selectRes').value,
				'update'
			);
			setPlotLayer(
				document.getElementById('selectYear').value,
				ui.value < 10 ? '0' + ui.value : ui.value,
				'update'
			);
		}
	});

	// Add Pips and labels to slider
	// https://simeydotme.github.io/jQuery-ui-Slider-Pips/
	$('#sliderMonth').slider().slider('pips');

}


function getHexColor(val) {
    return val > 50 ? 'blue' :
           val > 25  ? 'green' :
           val > 10  ? 'purple' :
           val > 5  ? 'yellow' :
           val > 0   ? 'red' : 'transparent';
}


function setHexLayer(year, month, metric, resolution, mode) {

	document.getElementById('spinner').style.display = 'block';

	var hex_url = 'geojson/' + year + '_' + month + '-' + resolution + '.geojson';

	if ( mode == 'update' ) {
		overlays.removeLayer(hexLayer);
	}

	getLayerData(hex_url, function(response) {
		response.features.forEach( function(cell) {

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

		if ( map.hasLayer(hexLayer) ) {
			map.removeLayer(hexLayer);
			var hexLayerVisible = true;
		}

		hexLayer = L.geoJson(response).eachLayer( function(l) {
			l.bindPopup(make_popup(l.feature.properties));
			l.setStyle(l.feature['hexStyle']);
		});

		overlays.addOverlay(hexLayer, 'Hex layer');
		if ( hexLayerVisible || mode == 'new' ) {
			map.addLayer(hexLayer);
		}

		document.getElementById('spinner').style.display = 'none';

	});

}


function setPlotLayer(year, month, mode) {

	document.getElementById('spinner').style.display = 'block';

	var plot_url = 'geojson/' + year + '_' + month + '-plot.geojson';

	if ( mode == 'update' ) {
		overlays.removeLayer(plotLayer);
	}

	getLayerData(plot_url, function(response) {

		if ( map.hasLayer(plotLayer) ) {
			map.removeLayer(plotLayer);
			var plotLayerVisible = true;
		}

		plotLayer = L.geoJson(response, {
			pointToLayer: function(feature, latlon) {
				return L.circleMarker(latlon, {
					radius: 1,
					fillColor: '#000000',
					fillOpacity: 1,
					stroke: false
				});
			}
		});

		overlays.addOverlay(plotLayer, 'Scatter plot');
		if ( plotLayerVisible ) {
			map.addLayer(plotLayer);
		}

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


function make_popup(props) {

	var popup = 'DL throughput: ' + Math.round(props.download_avg * 10) / 10 + '<br/>';
	popup += 'DL data points: ' + Math.round(props.download_count * 10) / 10 + '<br/>';
	popup += 'UL throughput: ' + Math.round(props.upload_avg * 10) / 10 + '<br/>';
	popup += 'UL data points: ' + Math.round(props.upload_count * 10) / 10 + '<br/>';
	popup += 'Average RTT: ' + Math.round(props.rtt_avg);

	return popup;

}
