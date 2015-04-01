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


function addControls() {

	var controls = L.control({position: 'bottomleft'});

	controls.onAdd = function(map) {
		var controls = L.DomUtil.create('div', 'info controls');
		var selectYear = L.DomUtil.create('select', 'mapControls', controls);
		var selectMetric = L.DomUtil.create('select', 'mapControls', controls);
		var selectRes = L.DomUtil.create('select', 'mapControls', controls);
		var sliderMonth = L.DomUtil.create('div', 'mapControls', controls);
		var checkAnimate = L.DomUtil.create('div', 'mapControls', controls);

		var date_options = '';
		for ( var year in dates ) {
			date_options += '<option value="' + year + '">' + year + '</option>';
		}

		checkAnimate.innerHTML = '<input id="checkAnimate" type="checkbox" />Animate map';
		
		sliderMonth.setAttribute('id', 'sliderMonth');
		// Prevent the entire map from dragging when the slider is dragged.
		L.DomEvent.disableClickPropagation(sliderMonth);

		selectYear.innerHTML = date_options;
		selectYear.setAttribute('id', 'selectYear');

		selectMetric.innerHTML = '<option value="download_median">DL throughput</option><option value="upload_median">UL throughput</option>';
		selectMetric.setAttribute('id', 'selectMetric');

		selectRes.innerHTML = '<option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>';
		selectRes.setAttribute('id', 'selectRes');

		return controls;
	};

	controls.addTo(map);

	[selectYear, selectMetric, selectRes].forEach( function(elem) {
		elem.addEventListener('change', function (e) { updateLayers(e, 'update'); });
	});

	var clearId;
	$('#checkAnimate').change( function() {
		if ( $('#checkAnimate').prop('checked') ) {
			var i = $('#sliderMonth').slider('value');
			clearId = setInterval( function() {
				$('#sliderMonth').slider('value', i + 1);
				i = (i + 1) % dates[$('#selectYear').val()].length;
			}, 1000);
		} else {
			clearInterval(clearId);
		}
	});

	// Can't instantiate the slider until after "controls" is actually added to
	// the map.
	$('#sliderMonth')
		.slider({
			min: Number(dates[defaultYear][0]),
			max: Number(dates[defaultYear][dates[defaultYear].length - 1]),
			change: function (e, ui) { updateLayers(e, 'update'); }
		})
		.slider('pips', {
			rest: 'label',
			labels: monthNames.slice(0, dates[defaultYear].length)
		});;

}


function updateLayers(e, mode) {

	var year = $('#selectYear').val();
	var metric = $('#selectMetric').val();
	var resolution = $('#selectRes').val();

	// If the year was changed then we need to update the slider and set it's
	// value to the first configured month for that year.
	if ( e.target.id == 'selectYear' ) {
		$('#sliderMonth')
			.slider('option', 'min', Number(dates[year][0]))
			.slider('option', 'max', Number(dates[year][dates[year].length - 1]))
			.slider().slider('pips', {
				rest: 'label',
				labels: monthNames.slice(0, dates[year].length)
			})
			.slider('value', dates[year][0]);
	}

	var month = $('#sliderMonth').slider('value');

	setHexLayer(year, month, metric, resolution, mode);
	setPlotLayer(year, month, mode);

}


function getHexColor(val) {

    return val > 50 ? 'blue' :
           val > 25  ? 'green' :
           val > 10  ? 'purple' :
           val > 5  ? 'yellow' :
           val > 0   ? 'red' : 'transparent';

}


function setHexLayer(year, month, metric, resolution, mode) {

	// Don't display spinner if animation is happening
	if ( $('#checkAnimate').prop('checked') === false ) {
		$('#spinner').css('display', 'block');
	}

	month = month < 10 ? '0' + month : month;
	var hex_url = 'geojson/' + year + '_' + month + '-' + resolution + '.geojson';

	if ( mode == 'update' ) {
		overlays.removeLayer(hexLayer);
	}

	$.get(hex_url, function(response) {
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

		$('#spinner').css('display', 'none');

	}, 'json');

}


function setPlotLayer(year, month, mode) {

	// Don't display spinner if animation is happening
	if ( $('#checkAnimate').prop('checked') === false ) {
		$('#spinner').css('display', 'block');
	}

	month = month < 10 ? '0' + month : month;
	var plot_url = 'geojson/' + year + '_' + month + '-plot.geojson';

	if ( mode == 'update' ) {
		overlays.removeLayer(plotLayer);
	}

	$.get(plot_url, function(response) {

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

	}, 'json');

}


function make_popup(props) {

	var popup = 'DL: median:' + Math.round(props.download_median * 10) / 10;
	popup += '/mean:' + Math.round(props.download_avg * 10) / 10;
	popup += '/pts:' + Math.round(props.download_count * 10) / 10 + '<br/>';
	popup += 'UL: median:' + Math.round(props.upload_median * 10) / 10;
	popup += '/mean:' + Math.round(props.upload_avg * 10) / 10;
	popup += '/pts:' + Math.round(props.upload_count * 10) / 10 + '<br/>';
	popup += 'RTT (mean): ' + Math.round(props.rtt_avg);

	return popup;

}
